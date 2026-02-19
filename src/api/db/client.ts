import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { DB_PATH, FLOCK_DATA_DIR } from "../../lib/config.js";
import { sessions } from "./schema.js";

mkdirSync(FLOCK_DATA_DIR, { recursive: true });
const sqlite = new Database(DB_PATH, { create: true });
export const db = drizzle(sqlite);

let initialized = false;

const initializeSchema = (): void => {
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('local', 'worktree')),
      repo TEXT NOT NULL,
      workspace_name TEXT,
      workspace_path TEXT,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'archived')),
      model TEXT NOT NULL DEFAULT 'claude' CHECK(model IN ('claude', 'codex')),
      model_session_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);",
  );
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);");
};

const resetStaleRunningSessions = async (): Promise<void> => {
  const now = Date.now();
  await db
    .update(sessions)
    .set({
      status: "idle",
      updatedAt: now,
    })
    .where(eq(sessions.status, "running"));
};

export const initializeDatabase = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  initializeSchema();
  await resetStaleRunningSessions();
  initialized = true;
};
