import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db, initializeDatabase } from "../../src/api/db/client.ts";
import { messages, sessions } from "../../src/api/db/schema.ts";
import { handleCreateWorkspacePRRoute } from "../../src/api/routes/workspaces.ts";
import { repoPath } from "../../src/lib/config.ts";

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

const runGit = (cwd: string, args: string[]): string => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new Error(
    `git ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.stdout || "unknown error"}`,
  );
};

const createFakeCodex = async (): Promise<string> => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "flock-codex-"));
  const commandPath = path.join(binDir, "codex");

  await writeFile(commandPath, "#!/bin/sh\necho \"PR ready\"\n");
  await chmod(commandPath, 0o755);
  trackCleanup(binDir);

  return binDir;
};

const createRepo = async (repoName: string): Promise<string> => {
  const repoDir = repoPath(repoName);

  await mkdir(repoDir, { recursive: true });
  trackCleanup(repoDir);
  runGit(repoDir, ["init"]);
  runGit(repoDir, ["config", "user.email", "flock-tests@example.com"]);
  runGit(repoDir, ["config", "user.name", "Flock Tests"]);
  await writeFile(path.join(repoDir, "README.md"), "seed\n");
  runGit(repoDir, ["add", "README.md"]);
  runGit(repoDir, ["commit", "-m", "init"]);
  await writeFile(path.join(repoDir, "README.md"), "seed\nchanged\n");

  return repoDir;
};

beforeAll(async () => {
  await initializeDatabase();
});

afterEach(async () => {
  process.env.PATH = originalPath;

  while (cleanupSessionIds.length > 0) {
    const sessionId = cleanupSessionIds.pop();
    if (!sessionId) {
      continue;
    }

    await db.delete(messages).where(eq(messages.sessionId, sessionId));
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

describe("workspace routes", () => {
  it("dispatches a PR request prompt to the matching worktree session", async () => {
    const repoName = unique("repo");
    const workspaceName = unique("workspace");
    const repoDir = await createRepo(repoName);
    const fakeCodexDir = await createFakeCodex();
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const branch = runGit(repoDir, ["branch", "--show-current"]);

    process.env.PATH = `${fakeCodexDir}:${originalPath}`;
    trackSession(sessionId);

    await db.insert(sessions).values({
      id: sessionId,
      type: "worktree",
      repo: repoName,
      workspaceName,
      workspacePath: repoDir,
      status: "idle",
      model: "codex",
      modelSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const response = await handleCreateWorkspacePRRoute(
      new Request(`http://localhost/workspaces/${repoName}/${workspaceName}/pr`, {
        method: "POST",
      }),
      repoName,
      workspaceName,
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      sessionId,
      repo: repoName,
      workspace: workspaceName,
      branch,
      targetBranch: "origin/main",
      uncommittedChanges: 1,
      status: "running",
      userMessage: {
        role: "user",
      },
    });

    const userMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId));

    const prompt = userMessages.find((message) => message.role === "user")?.content;

    expect(prompt).toContain("The user requested a PR.");
  });
});
