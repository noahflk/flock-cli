import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  REPOS_DIR,
  WORKSPACES_DIR,
  ensureDir,
  repoPath,
  workspacePath,
  workspaceRootForRepo,
} from "./config.js";
import { runProcess } from "./process.js";
import { FlockError } from "./types.js";

type ParsedRepoInput = {
  url: string;
  name: string;
};

type ParsedGitHubSlug = {
  slug: string;
  name: string;
};

const stripGitSuffix = (value: string): string => value.replace(/\.git$/i, "");

const parseRepoNameFromUrl = (url: string): string | null => {
  const cleaned = stripGitSuffix(url.trim());

  if (cleaned.startsWith("git@")) {
    const [, rhs] = cleaned.split(":");
    if (!rhs) {
      return null;
    }
    const parts = rhs.split("/");
    return parts[parts.length - 1] || null;
  }

  try {
    const parsed = new URL(cleaned);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch {
    return null;
  }
};

export const parseRepoInput = (input: string): ParsedRepoInput => {
  const normalized = input.trim();

  if (!normalized) {
    throw new FlockError({
      code: "INVALID_REPO_INPUT",
      message: "Repository input cannot be empty.",
    });
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(normalized)) {
    const [, repo] = normalized.split("/");
    return {
      url: `https://github.com/${normalized}`,
      name: stripGitSuffix(repo),
    };
  }

  const repoName = parseRepoNameFromUrl(normalized);
  if (!repoName) {
    throw new FlockError({
      code: "INVALID_REPO_INPUT",
      message: `Could not parse repository input: ${input}`,
    });
  }

  return {
    url: normalized,
    name: stripGitSuffix(repoName),
  };
};

export const parseGitHubSlug = (input: string): ParsedGitHubSlug => {
  const normalized = input.trim();

  if (!normalized) {
    throw new FlockError({
      code: "INVALID_REPO_INPUT",
      message: "GitHub slug cannot be empty.",
    });
  }

  if (!/^[\w.-]+\/[\w.-]+(?:\.git)?$/.test(normalized)) {
    throw new FlockError({
      code: "INVALID_REPO_INPUT",
      message: `Expected GitHub slug in owner/repo format: ${input}`,
    });
  }

  const [owner, repo] = normalized.split("/");
  const cleanedRepo = stripGitSuffix(repo ?? "");
  if (!owner || !cleanedRepo) {
    throw new FlockError({
      code: "INVALID_REPO_INPUT",
      message: `Expected GitHub slug in owner/repo format: ${input}`,
    });
  }

  return {
    slug: `${owner}/${cleanedRepo}`,
    name: cleanedRepo,
  };
};

const ensureRepoDir = async (): Promise<void> => {
  await ensureDir(REPOS_DIR);
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const assertRepoExists = async (repoName: string): Promise<string> => {
  const target = repoPath(repoName);

  if (!(await pathExists(target))) {
    throw new FlockError({
      code: "REPO_NOT_FOUND",
      message: `Repository not found: ${repoName}`,
    });
  }

  return target;
};

export const cloneRepoAtInput = async (
  repoInput: string,
): Promise<{ name: string; path: string }> => {
  await ensureRepoDir();

  const parsed = parseRepoInput(repoInput);
  const destination = repoPath(parsed.name);

  if (await pathExists(destination)) {
    throw new FlockError({
      code: "REPO_ALREADY_EXISTS",
      message: `Repository already exists at ${destination}`,
    });
  }

  const result = await runProcess({
    command: "git",
    args: ["clone", parsed.url, destination],
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || "git clone failed",
      cause: result,
    });
  }

  return {
    name: parsed.name,
    path: destination,
  };
};

export const cloneGitHubRepoAtSlug = async (
  slugInput: string,
): Promise<{ name: string; path: string }> => {
  await ensureRepoDir();

  const parsed = parseGitHubSlug(slugInput);
  const destination = repoPath(parsed.name);

  if (await pathExists(destination)) {
    throw new FlockError({
      code: "REPO_ALREADY_EXISTS",
      message: `Repository already exists at ${destination}`,
    });
  }

  const result = await runProcess({
    command: "gh",
    args: ["repo", "clone", parsed.slug, destination],
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || "gh repo clone failed",
      cause: result,
    });
  }

  return {
    name: parsed.name,
    path: destination,
  };
};

export const createWorktree = async (
  repoName: string,
  workspaceName: string,
): Promise<{ name: string; path: string; branch: string }> => {
  const repoDir = await assertRepoExists(repoName);
  const workspaceDir = workspacePath(repoName, workspaceName);

  await ensureDir(workspaceRootForRepo(repoName));

  if (await pathExists(workspaceDir)) {
    throw new FlockError({
      code: "WORKSPACE_ALREADY_EXISTS",
      message: `Workspace already exists at ${workspaceDir}`,
    });
  }

  const result = await runProcess({
    command: "git",
    args: ["worktree", "add", workspaceDir, "-b", workspaceName],
    cwd: repoDir,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || "git worktree add failed",
      cause: result,
    });
  }

  return {
    name: workspaceName,
    path: workspaceDir,
    branch: workspaceName,
  };
};

export const getBranchAtPath = async (cwd: string): Promise<string> => {
  const result = await runProcess({
    command: "git",
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || `Failed to read branch in ${cwd}`,
      cause: result,
    });
  }

  return result.stdout.trim();
};

export const pushBranch = async (cwd: string, branch: string): Promise<void> => {
  const result = await runProcess({
    command: "git",
    args: ["push", "-u", "origin", branch],
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: result.stderr || "git push failed",
      cause: result,
    });
  }
};

export const findWorkspacePath = async (
  workspaceName: string,
): Promise<{ repo: string; path: string }> => {
  const base = WORKSPACES_DIR;

  if (!(await pathExists(base))) {
    throw new FlockError({
      code: "WORKSPACE_NOT_FOUND",
      message: `Workspace not found: ${workspaceName}`,
    });
  }

  const repoEntries = await readdir(base, { withFileTypes: true });

  for (const repoEntry of repoEntries) {
    if (!repoEntry.isDirectory()) {
      continue;
    }

    const candidate = path.join(base, repoEntry.name, workspaceName);
    if (await pathExists(candidate)) {
      const stats = await stat(candidate);
      if (stats.isDirectory()) {
        return {
          repo: repoEntry.name,
          path: candidate,
        };
      }
    }
  }

  throw new FlockError({
    code: "WORKSPACE_NOT_FOUND",
    message: `Workspace not found: ${workspaceName}`,
  });
};
