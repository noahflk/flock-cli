import { runProcess } from "./process.js";
import { FlockError } from "./types.js";

const getCurrentBranch = async (cwd: string): Promise<string> => {
  const result = await runProcess({
    command: "git",
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || `Failed to read branch at ${cwd}`,
      cause: result,
    });
  }

  return result.stdout.trim();
};

const hasUncommittedChanges = async (cwd: string): Promise<boolean> => {
  const result = await runProcess({
    command: "git",
    args: ["status", "--porcelain"],
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || `Failed to inspect git status at ${cwd}`,
      cause: result,
    });
  }

  return result.stdout.trim().length > 0;
};

const hasUnpushedCommits = async (cwd: string): Promise<boolean> => {
  const upstream = await runProcess({
    command: "git",
    args: ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    cwd,
  });

  if (upstream.exitCode !== 0) {
    return true;
  }

  const aheadBehind = await runProcess({
    command: "git",
    args: ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    cwd,
  });

  if (aheadBehind.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: aheadBehind.stderr || `Failed to inspect upstream at ${cwd}`,
      cause: aheadBehind,
    });
  }

  const [behindCountRaw, aheadCountRaw] = aheadBehind.stdout.trim().split(/\s+/);
  const aheadCount = Number(aheadCountRaw ?? "0");
  const behindCount = Number(behindCountRaw ?? "0");

  if (Number.isNaN(aheadCount) || Number.isNaN(behindCount)) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: `Unexpected git rev-list output in ${cwd}: ${aheadBehind.stdout.trim()}`,
    });
  }

  return aheadCount > 0;
};

export const collectArchiveWarnings = async (workspaceDir: string): Promise<string[]> => {
  const warnings: string[] = [];
  const branch = await getCurrentBranch(workspaceDir);

  if (await hasUncommittedChanges(workspaceDir)) {
    warnings.push(`Workspace ${branch} has uncommitted changes.`);
  }

  if (await hasUnpushedCommits(workspaceDir)) {
    warnings.push(`Workspace ${branch} may contain unpushed commits.`);
  }

  return warnings;
};

export const removeWorktree = async (
  repoDir: string,
  workspaceDir: string,
): Promise<void> => {
  const result = await runProcess({
    command: "git",
    args: ["worktree", "remove", "--force", workspaceDir],
    cwd: repoDir,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || `Failed to remove worktree ${workspaceDir}`,
      cause: result,
    });
  }
};
