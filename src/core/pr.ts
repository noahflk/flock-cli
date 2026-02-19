import { access } from "node:fs/promises";
import { workspacePath } from "../lib/config.js";
import { getBranchAtPath, pushBranch } from "../lib/git.js";
import { runProcess } from "../lib/process.js";
import { FlockError, type PRResult } from "../lib/types.js";

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const createPR = async (
  repoName: string,
  workspaceName: string,
): Promise<PRResult> => {
  const cwd = workspacePath(repoName, workspaceName);

  if (!(await pathExists(cwd))) {
    throw new FlockError({
      code: "WORKSPACE_NOT_FOUND",
      message: `Workspace not found for repo ${repoName}: ${workspaceName}`,
    });
  }

  const branch = await getBranchAtPath(cwd);
  await pushBranch(cwd, branch);

  const result = await runProcess({
    command: "gh",
    args: ["pr", "create", "--fill", "--base", "main"],
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "PR_COMMAND_FAILED",
      message: result.stderr || "gh pr create failed",
      cause: result,
    });
  }

  const urlMatch = result.stdout.match(/https:\/\/\S+/);

  return {
    url: urlMatch?.[0] ?? result.stdout.trim(),
    branch,
  };
};
