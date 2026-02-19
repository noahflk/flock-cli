import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const REPOS_DIR = path.join(os.homedir(), "repos");
export const WORKSPACES_DIR = path.join(os.homedir(), "flock", "workspaces");

export const repoPath = (repoName: string): string => path.join(REPOS_DIR, repoName);

export const workspaceRootForRepo = (repoName: string): string =>
  path.join(WORKSPACES_DIR, repoName);

export const workspacePath = (repoName: string, workspaceName: string): string =>
  path.join(WORKSPACES_DIR, repoName, workspaceName);

export const ensureDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
};
