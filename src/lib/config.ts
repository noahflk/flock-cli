import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const REPOS_DIR = path.join(os.homedir(), "repos");
export const WORKSPACES_DIR = path.join(os.homedir(), "flock", "workspaces");
export const FLOCK_DATA_DIR = path.join(os.homedir(), ".flock");
export const DB_PATH = path.join(FLOCK_DATA_DIR, "flock.db");
export const SERVER_CONFIG_PATH = path.join(FLOCK_DATA_DIR, "server-config.json");

export const repoPath = (repoName: string): string => path.join(REPOS_DIR, repoName);

export const workspaceRootForRepo = (repoName: string): string =>
  path.join(WORKSPACES_DIR, repoName);

export const workspacePath = (repoName: string, workspaceName: string): string =>
  path.join(WORKSPACES_DIR, repoName, workspaceName);

export const ensureDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
};
