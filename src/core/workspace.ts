import { readdir } from "node:fs/promises";
import { workspaceRootForRepo } from "../lib/config.js";
import { assertRepoExists, createWorktree } from "../lib/git.js";
import { loadRepoFlockConfig } from "../lib/flock-config.js";
import { runProcess } from "../lib/process.js";
import { FlockError, type WorkspaceResult } from "../lib/types.js";
import { generateWorkspaceName } from "../lib/words.js";

const listExistingWorkspaceNames = async (repoName: string): Promise<Set<string>> => {
  const root = workspaceRootForRepo(repoName);

  try {
    const entries = await readdir(root, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  } catch {
    return new Set();
  }
};

export const createWorkspace = async (repoName: string): Promise<WorkspaceResult> => {
  const repoDir = await assertRepoExists(repoName);

  const takenNames = await listExistingWorkspaceNames(repoName);
  const workspaceName = generateWorkspaceName(takenNames);
  const workspace = await createWorktree(repoName, workspaceName);
  const config = await loadRepoFlockConfig(repoDir);

  if (!config?.setupScript || config.setupScript.trim().length === 0) {
    return workspace;
  }

  const setupResult = await runProcess({
    command: "sh",
    args: ["-lc", config.setupScript],
    cwd: workspace.path,
    env: {
      ...process.env,
      REPO_ROOT_PATH: repoDir,
      WORKSPACE_PATH: workspace.path,
    },
  });

  if (setupResult.exitCode !== 0) {
    throw new FlockError({
      code: "SETUP_SCRIPT_FAILED",
      message: setupResult.stderr || "Workspace setupScript failed",
      cause: setupResult,
    });
  }

  return workspace;
};
