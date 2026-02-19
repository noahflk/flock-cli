import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../api/db/client.js";
import { messages, sessions } from "../api/db/schema.js";
import { assertRepoExists } from "../lib/git.js";
import { FlockError, type SessionModel, type SessionStatus, type SessionType } from "../lib/types.js";
import { collectArchiveWarnings, removeWorktree } from "../lib/worktree.js";
import { createWorkspace } from "./workspace.js";

type SessionRow = typeof sessions.$inferSelect;

type SessionListFilters = {
  repo?: string;
  statuses?: SessionStatus[];
};

export type SessionSummary = {
  id: string;
  type: SessionType;
  repo: string;
  workspaceName: string | null;
  status: SessionStatus;
  model: SessionModel;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

const toSummary = (
  row: SessionRow,
  messageCount: number,
): SessionSummary => ({
  id: row.id,
  type: row.type,
  repo: row.repo,
  workspaceName: row.workspaceName,
  status: row.status,
  model: row.model,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  messageCount,
});

export const getSessionById = async (id: string): Promise<SessionRow | null> => {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return session ?? null;
};

export const getRequiredSessionById = async (id: string): Promise<SessionRow> => {
  const session = await getSessionById(id);

  if (!session) {
    throw new FlockError({
      code: "SESSION_NOT_FOUND",
      message: `Session not found: ${id}`,
    });
  }

  return session;
};

export const listSessions = async (
  filters: SessionListFilters = {},
): Promise<SessionSummary[]> => {
  const whereClauses = [];

  if (filters.repo) {
    whereClauses.push(eq(sessions.repo, filters.repo));
  }

  if (filters.statuses && filters.statuses.length > 0) {
    whereClauses.push(inArray(sessions.status, filters.statuses));
  }

  const whereExpression =
    whereClauses.length === 0 ? undefined : and(...whereClauses);

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(whereExpression)
    .orderBy(desc(sessions.updatedAt));

  if (sessionRows.length === 0) {
    return [];
  }

  const ids = sessionRows.map((row) => row.id);
  const countRows = await db
    .select({
      sessionId: messages.sessionId,
      count: sql<number>`count(${messages.id})`,
    })
    .from(messages)
    .where(inArray(messages.sessionId, ids))
    .groupBy(messages.sessionId);

  const countBySession = new Map<string, number>(
    countRows.map((row) => [row.sessionId, Number(row.count)]),
  );

  return sessionRows.map((row) => toSummary(row, countBySession.get(row.id) ?? 0));
};

export const createSession = async (input: {
  repo: string;
  type: SessionType;
  model?: SessionModel;
}): Promise<SessionSummary> => {
  const now = Date.now();
  const id = crypto.randomUUID();
  const model = input.model ?? "claude";

  let workspaceName: string | null = null;
  let workspacePath: string | null = null;

  if (input.type === "worktree") {
    const workspace = await createWorkspace(input.repo);
    workspaceName = workspace.name;
    workspacePath = workspace.path;
  } else {
    await assertRepoExists(input.repo);
  }

  const modelSessionId = model === "claude" ? crypto.randomUUID() : null;

  await db.insert(sessions).values({
    id,
    type: input.type,
    repo: input.repo,
    workspaceName,
    workspacePath,
    status: "idle",
    model,
    modelSessionId,
    createdAt: now,
    updatedAt: now,
  });

  const created = await getRequiredSessionById(id);
  return toSummary(created, 0);
};

export const setSessionStatus = async (
  id: string,
  status: SessionStatus,
): Promise<void> => {
  await db
    .update(sessions)
    .set({
      status,
      updatedAt: Date.now(),
    })
    .where(eq(sessions.id, id));
};

export const setSessionModelSessionId = async (
  id: string,
  modelSessionId: string,
): Promise<void> => {
  await db
    .update(sessions)
    .set({
      modelSessionId,
      updatedAt: Date.now(),
    })
    .where(eq(sessions.id, id));
};

export const archiveSession = async (
  id: string,
  force = false,
): Promise<{ id: string; archived: true; warnings: string[] }> => {
  const session = await getRequiredSessionById(id);

  if (session.status === "running") {
    throw new FlockError({
      code: "SESSION_BUSY",
      message: `Session is currently running: ${id}`,
    });
  }

  if (session.status === "archived") {
    return {
      id: session.id,
      archived: true,
      warnings: [],
    };
  }

  let warnings: string[] = [];

  if (session.type === "worktree" && session.workspacePath) {
    warnings = await collectArchiveWarnings(session.workspacePath);

    if (warnings.length > 0 && !force) {
      throw new FlockError({
        code: "ARCHIVE_REFUSED",
        message: `Refusing archive for ${id}; pass force=true to override`,
        cause: { warnings },
      });
    }

    const repoDir = await assertRepoExists(session.repo);
    await removeWorktree(repoDir, session.workspacePath);
  }

  await setSessionStatus(id, "archived");
  return {
    id,
    archived: true,
    warnings,
  };
};
