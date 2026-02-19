import { access } from "node:fs/promises";
import { workspacePath } from "../lib/config.js";
import { assertRepoExists } from "../lib/git.js";
import { FlockError, type ArchiveResult } from "../lib/types.js";
import { collectArchiveWarnings, removeWorktree } from "../lib/worktree.js";

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const archiveWorkspace = async (
  repoName: string,
  workspaceName: string,
): Promise<ArchiveResult> => {
  const repoDir = await assertRepoExists(repoName);
  const targetWorkspacePath = workspacePath(repoName, workspaceName);

  if (!(await pathExists(targetWorkspacePath))) {
    throw new FlockError({
      code: "WORKSPACE_NOT_FOUND",
      message: `Workspace not found for repo ${repoName}: ${workspaceName}`,
    });
  }

  const warnings = await collectArchiveWarnings(targetWorkspacePath);
  await removeWorktree(repoDir, targetWorkspacePath);

  return {
    name: workspaceName,
    repo: repoName,
    path: targetWorkspacePath,
    warnings,
  };
};
