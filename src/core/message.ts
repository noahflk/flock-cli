import { spawn, type ChildProcess } from "node:child_process";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../api/db/client.js";
import { messages } from "../api/db/schema.js";
import { assertRepoExists } from "../lib/git.js";
import { FlockError } from "../lib/types.js";
import { buildSendInvocation } from "./send.js";
import {
  getRequiredSessionById,
  setSessionModelSessionId,
  setSessionStatus,
} from "./session.js";

type MessageRow = typeof messages.$inferSelect;

type RunningSession = {
  proc: ChildProcess;
  cancelled: boolean;
};

export type SessionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const runningProcesses = new Map<string, RunningSession>();

const toSessionMessage = (row: MessageRow): SessionMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.createdAt,
});

const resolveSessionCwd = async (sessionId: string): Promise<string> => {
  const session = await getRequiredSessionById(sessionId);

  if (session.type === "worktree") {
    if (!session.workspacePath) {
      throw new FlockError({
        code: "IO_ERROR",
        message: `Session ${session.id} is missing a workspace path`,
      });
    }

    return session.workspacePath;
  }

  return await assertRepoExists(session.repo);
};

const insertAssistantMessage = async (
  sessionId: string,
  content: string,
): Promise<void> => {
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant",
    content,
    createdAt: Date.now(),
  });
};

const hasAssistantMessage = async (sessionId: string): Promise<boolean> => {
  const [row] = await db
    .select({ count: sql<number>`count(${messages.id})` })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.role, "assistant")));

  return Number(row?.count ?? 0) > 0;
};

const parseCodexSessionId = (output: string): string | null => {
  const patterns = [
    /session[_\s-]?id[:=\s]+([A-Za-z0-9._:-]+)/i,
    /resume\s+([A-Za-z0-9._:-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const spawnWithCapture = async (
  sessionId: string,
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const proc = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const running: RunningSession = { proc, cancelled: false };
  runningProcesses.set(sessionId, running);

  let stdout = "";
  let stderr = "";

  proc.stdout?.setEncoding("utf8");
  proc.stderr?.setEncoding("utf8");
  proc.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  proc.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return await new Promise((resolve) => {
    proc.on("error", (error: Error) => {
      stderr += error.message;
      resolve({ stdout, stderr, exitCode: 127 });
    });

    proc.on("close", (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
};

const runSessionProcess = async (
  sessionId: string,
  content: string,
): Promise<void> => {
  const session = await getRequiredSessionById(sessionId);
  const cwd = await resolveSessionCwd(sessionId);
  const resume = await hasAssistantMessage(sessionId);

  let modelSessionId = session.modelSessionId;
  if (!modelSessionId && session.model === "claude") {
    modelSessionId = crypto.randomUUID();
    await setSessionModelSessionId(session.id, modelSessionId);
  }

  const invocation = buildSendInvocation(content, session.model, {
    sessionId: modelSessionId ?? undefined,
    resume,
  });

  try {
    const result = await spawnWithCapture(
      sessionId,
      invocation.command,
      invocation.args,
      cwd,
    );

    const running = runningProcesses.get(sessionId);
    if (running?.cancelled) {
      return;
    }

    if (session.model === "codex" && !modelSessionId) {
      const parsed = parseCodexSessionId(`${result.stdout}\n${result.stderr}`);
      if (parsed) {
        await setSessionModelSessionId(session.id, parsed);
      }
    }

    if (result.exitCode !== 0) {
      await insertAssistantMessage(
        sessionId,
        `[ERROR] ${result.stderr.trim() || `${invocation.command} command failed`}`,
      );
    } else {
      const response = result.stdout.trim() || result.stderr.trim();
      await insertAssistantMessage(sessionId, response);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await insertAssistantMessage(sessionId, `[ERROR] ${message}`);
  } finally {
    runningProcesses.delete(sessionId);
    await setSessionStatus(sessionId, "idle");
  }
};

export const listSessionMessages = async (
  sessionId: string,
  limit: number,
  offset: number,
): Promise<{ messages: SessionMessage[]; total: number }> => {
  await getRequiredSessionById(sessionId);

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(${messages.id})` })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));

  return {
    messages: rows.map(toSessionMessage),
    total: Number(countRow?.total ?? 0),
  };
};

export const dispatchSessionMessage = async (
  sessionId: string,
  content: string,
): Promise<{ userMessage: SessionMessage; status: "running" }> => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new FlockError({
      code: "IO_ERROR",
      message: "Message content cannot be empty",
    });
  }

  const session = await getRequiredSessionById(sessionId);

  if (session.status === "archived") {
    throw new FlockError({
      code: "SESSION_NOT_FOUND",
      message: `Session not found: ${sessionId}`,
    });
  }

  if (session.status === "running" || runningProcesses.has(sessionId)) {
    throw new FlockError({
      code: "SESSION_BUSY",
      message: `Session is currently running: ${sessionId}`,
    });
  }

  const row: MessageRow = {
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content: trimmed,
    createdAt: Date.now(),
  };

  await db.insert(messages).values(row);
  await setSessionStatus(sessionId, "running");
  void runSessionProcess(sessionId, trimmed);

  return {
    userMessage: toSessionMessage(row),
    status: "running",
  };
};

export const cancelSessionMessage = async (
  sessionId: string,
): Promise<{ id: string; cancelled: true }> => {
  await getRequiredSessionById(sessionId);

  const running = runningProcesses.get(sessionId);
  if (!running) {
    throw new FlockError({
      code: "SESSION_NOT_FOUND",
      message: `No running process for session: ${sessionId}`,
    });
  }

  running.cancelled = true;
  running.proc.kill("SIGTERM");

  await insertAssistantMessage(sessionId, "[CANCELLED]");
  await setSessionStatus(sessionId, "idle");

  return {
    id: sessionId,
    cancelled: true,
  };
};
