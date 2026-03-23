import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db, initializeDatabase } from "../../src/api/db/client.ts";
import { sessions } from "../../src/api/db/schema.ts";
import {
  handleCreateMessageRoute,
  handleListMessagesRoute,
} from "../../src/api/routes/messages.ts";
import { createSession } from "../../src/core/session.ts";
import { repoPath, workspaceRootForRepo } from "../../src/lib/config.ts";

const cleanupTargets: string[] = [];
const cleanupSessionIds: string[] = [];
const originalPath = process.env.PATH ?? "";

const unique = (label: string): string =>
  `flock-test-${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const trackCleanup = (target: string): void => {
  cleanupTargets.push(target);
};

const trackSession = (sessionId: string): void => {
  cleanupSessionIds.push(sessionId);
};

const runGit = (cwd: string, args: string[]): void => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return;
  }

  throw new Error(
    `git ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.stdout || "unknown error"}`,
  );
};

const ensureRepoWithInitialCommit = async (repoName: string): Promise<string> => {
  const repoDir = repoPath(repoName);

  await mkdir(repoDir, { recursive: true });
  trackCleanup(repoDir);

  runGit(repoDir, ["init"]);
  runGit(repoDir, ["config", "user.email", "flock-tests@example.com"]);
  runGit(repoDir, ["config", "user.name", "Flock Tests"]);

  await writeFile(path.join(repoDir, "README.md"), "# test\n");
  runGit(repoDir, ["add", "README.md"]);
  runGit(repoDir, ["commit", "-m", "init"]);

  return repoDir;
};

const createFakeCommand = async (commandName: string, script: string): Promise<string> => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "flock-codex-"));
  const commandPath = path.join(binDir, commandName);

  await writeFile(commandPath, `#!/bin/sh\n${script}\n`);
  await chmod(commandPath, 0o755);
  trackCleanup(binDir);

  return binDir;
};

const createFakeCodex = async (script: string): Promise<string> =>
  await createFakeCommand("codex", script);

const createFakeClaude = async (script: string): Promise<string> =>
  await createFakeCommand("claude", script);

const waitForMessages = async (
  sessionId: string,
): Promise<{
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
  }>;
  total: number;
}> => {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const response = await handleListMessagesRoute(
      new Request(`http://localhost/sessions/${sessionId}/messages`),
      sessionId,
    );
    const payload = (await response.json()) as {
      messages: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        createdAt: number;
      }>;
      total: number;
    };

    if (payload.total >= 2) {
      return payload;
    }

    await Bun.sleep(50);
  }

  throw new Error(`Timed out waiting for assistant message in session ${sessionId}`);
};

beforeAll(async () => {
  await initializeDatabase();
});

afterEach(async () => {
  process.env.PATH = originalPath;
  delete process.env.CAPTURE_PATH;

  while (cleanupSessionIds.length > 0) {
    const sessionId = cleanupSessionIds.pop();
    if (!sessionId) {
      continue;
    }

    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  while (cleanupTargets.length > 0) {
    const target = cleanupTargets.pop();
    if (!target) {
      continue;
    }

    await rm(target, { recursive: true, force: true });
  }
});

describe("message routes", () => {
  it("returns assistant failures as normal [ERROR] messages in the API shape", async () => {
    const repoName = unique("repo");
    const repoDir = repoPath(repoName);
    const fakeCodexDir = await createFakeCodex('echo "agent failed to apply patch"\nexit 1');

    await mkdir(repoDir, { recursive: true });
    trackCleanup(repoDir);
    process.env.PATH = `${fakeCodexDir}:${originalPath}`;

    const session = await createSession({
      repo: repoName,
      type: "local",
      model: "codex",
    });
    trackSession(session.id);

    const createResponse = await handleCreateMessageRoute(
      new Request(`http://localhost/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: "fix the parser" }),
      }),
      session.id,
    );

    expect(createResponse.status).toBe(202);
    expect(await createResponse.json()).toMatchObject({
      status: "running",
      userMessage: {
        role: "user",
        content: "fix the parser",
      },
    });

    const payload = await waitForMessages(session.id);

    expect(payload.total).toBe(2);
    expect(payload.messages[0]).toMatchObject({
      role: "user",
      content: "fix the parser",
    });
    expect(payload.messages[1]).toMatchObject({
      role: "assistant",
      content: "[ERROR] agent failed to apply patch",
    });
    expect(Object.keys(payload.messages[1] ?? {}).sort()).toEqual([
      "content",
      "createdAt",
      "id",
      "role",
    ]);
  });

  it("injects branch rename instructions into the first worktree message", async () => {
    const repoName = unique("repo-worktree");
    const capturePath = path.join(os.tmpdir(), `${unique("capture")}.txt`);
    const fakeCodexDir = await createFakeCodex(
      'printf "%s" "$2" > "$CAPTURE_PATH"\necho "ok"\n',
    );

    await ensureRepoWithInitialCommit(repoName);
    trackCleanup(workspaceRootForRepo(repoName));
    trackCleanup(capturePath);
    process.env.PATH = `${fakeCodexDir}:${originalPath}`;
    process.env.CAPTURE_PATH = capturePath;

    const session = await createSession({
      repo: repoName,
      type: "worktree",
      model: "codex",
    });
    trackSession(session.id);

    const createResponse = await handleCreateMessageRoute(
      new Request(`http://localhost/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: "fix the parser error handling" }),
      }),
      session.id,
    );

    expect(createResponse.status).toBe(202);
    await waitForMessages(session.id);

    const captured = await readFile(capturePath, "utf8");
    expect(captured).toContain("You may rename the branch once");
    expect(captured).toContain("`git branch -m`");
    expect(captured).toContain("<user_request>\nfix the parser error handling\n</user_request>");
  });

  it("injects codex branch rename instructions only for the first worktree message", async () => {
    const repoName = unique("repo-worktree-codex-repeat");
    const capturePath = path.join(os.tmpdir(), `${unique("codex-repeat-capture")}.txt`);
    const fakeCodexDir = await createFakeCodex(
      'last=""\nfor arg in "$@"; do last="$arg"; done\nprintf "%s\n---\n" "$last" >> "$CAPTURE_PATH"\necho "session_id: session-1"\necho "ok"\n',
    );

    await ensureRepoWithInitialCommit(repoName);
    trackCleanup(workspaceRootForRepo(repoName));
    trackCleanup(capturePath);
    process.env.PATH = `${fakeCodexDir}:${originalPath}`;
    process.env.CAPTURE_PATH = capturePath;

    const session = await createSession({
      repo: repoName,
      type: "worktree",
      model: "codex",
    });
    trackSession(session.id);

    const firstResponse = await handleCreateMessageRoute(
      new Request(`http://localhost/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: "fix the parser error handling" }),
      }),
      session.id,
    );

    expect(firstResponse.status).toBe(202);
    await waitForMessages(session.id);

    const secondResponse = await handleCreateMessageRoute(
      new Request(`http://localhost/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: "add tests for edge cases" }),
      }),
      session.id,
    );

    expect(secondResponse.status).toBe(202);

    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const response = await handleListMessagesRoute(
        new Request(`http://localhost/sessions/${session.id}/messages`),
        session.id,
      );
      const payload = (await response.json()) as { total: number };
      if (payload.total >= 4) {
        break;
      }

      await Bun.sleep(50);
    }

    const captured = (await readFile(capturePath, "utf8"))
      .replace(/\n---\n?$/, "")
      .split("\n---\n");
    expect(captured).toHaveLength(2);
    expect(captured[0]).toContain("<system_instruction>");
    expect(captured[0]).toContain("You may rename the branch once");
    expect(captured[1]).toBe("add tests for edge cases");
  });

  it("uses claude append-system-prompt for the first worktree message", async () => {
    const repoName = unique("repo-worktree-claude");
    const capturePath = path.join(os.tmpdir(), `${unique("claude-capture")}.txt`);
    const fakeClaudeDir = await createFakeClaude(
      'for arg in "$@"; do printf "%s\n" "$arg"; done > "$CAPTURE_PATH"\necho "ok"\n',
    );

    await ensureRepoWithInitialCommit(repoName);
    trackCleanup(workspaceRootForRepo(repoName));
    trackCleanup(capturePath);
    process.env.PATH = `${fakeClaudeDir}:${originalPath}`;
    process.env.CAPTURE_PATH = capturePath;

    const session = await createSession({
      repo: repoName,
      type: "worktree",
      model: "claude",
    });
    trackSession(session.id);

    const createResponse = await handleCreateMessageRoute(
      new Request(`http://localhost/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: "fix the parser error handling" }),
      }),
      session.id,
    );

    expect(createResponse.status).toBe(202);
    await waitForMessages(session.id);

    const captured = (await readFile(capturePath, "utf8")).trim().split("\n");
    expect(captured).toContain("--append-system-prompt");
    expect(captured).toContain("fix the parser error handling");
    expect(captured.some((value) => value.includes("You may rename the branch once"))).toBeTrue();
    expect(captured).not.toContain("<system_instruction>");
    expect(captured).not.toContain("<user_request>");
  });
});
