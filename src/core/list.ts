import { readdir } from "node:fs/promises";
import path from "node:path";
import { REPOS_DIR, WORKSPACES_DIR } from "../lib/config.js";
import { getBranchAtPath } from "../lib/git.js";
import type { Repo, Workspace } from "../lib/types.js";

const listDirectories = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};

export const listRepos = async (): Promise<Repo[]> => {
  const repos = await listDirectories(REPOS_DIR);
  return repos.map((name) => ({
    name,
    path: path.join(REPOS_DIR, name),
  }));
};

export const listWorkspaces = async (repo?: string): Promise<Workspace[]> => {
  const repos = repo ? [repo] : await listDirectories(WORKSPACES_DIR);
  const workspaces: Workspace[] = [];

  for (const repoName of repos) {
    const repoWorkspaceRoot = path.join(WORKSPACES_DIR, repoName);
    const names = await listDirectories(repoWorkspaceRoot);

    for (const name of names) {
      const fullPath = path.join(repoWorkspaceRoot, name);
      let branch: string;

      try {
        branch = await getBranchAtPath(fullPath);
      } catch {
        branch = "unknown";
      }

      workspaces.push({
        name,
        repo: repoName,
        path: fullPath,
        branch,
      });
    }
  }

  return workspaces.sort((a, b) => a.path.localeCompare(b.path));
};
