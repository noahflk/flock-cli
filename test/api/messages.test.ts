import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

const createFakeCodex = async (script: string): Promise<string> => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "flock-codex-"));
  const commandPath = path.join(binDir, "codex");

  await writeFile(commandPath, `#!/bin/sh\n${script}\n`);
  await chmod(commandPath, 0o755);
  trackCleanup(binDir);

  return binDir;
};

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
});
