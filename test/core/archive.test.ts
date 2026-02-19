import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { archiveWorkspace } from "../../src/core/archive.ts";
import { REPOS_DIR, WORKSPACES_DIR } from "../../src/lib/config.ts";
import { FlockError } from "../../src/lib/types.ts";

const cleanupTargets: string[] = [];

const unique = (label: string): string =>
  `flock-test-${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const trackCleanup = (target: string): void => {
  cleanupTargets.push(target);
};

const runGit = (cwd: string, args: string[]): string => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new Error(
    `git ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.stdout || "unknown error"}`,
  );
};

const makeTempDir = async (label: string): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), `${label}-`));
  trackCleanup(dir);
  return dir;
};

const initRepo = async (
  repoName: string,
  withRemote: boolean,
): Promise<{ repoDir: string; workspaceName: string; workspaceDir: string }> => {
  const repoDir = path.join(REPOS_DIR, repoName);
  const workspaceName = unique("workspace");
  const workspaceRoot = path.join(WORKSPACES_DIR, repoName);
  const workspaceDir = path.join(workspaceRoot, workspaceName);

  await mkdir(repoDir, { recursive: true });
  trackCleanup(repoDir);
  trackCleanup(workspaceRoot);

  runGit(repoDir, ["init"]);
  runGit(repoDir, ["config", "user.email", "flock-tests@example.com"]);
  runGit(repoDir, ["config", "user.name", "Flock Tests"]);
  await writeFile(path.join(repoDir, "README.md"), "seed\n");
  runGit(repoDir, ["add", "README.md"]);
  runGit(repoDir, ["commit", "-m", "init"]);

  if (withRemote) {
    const remoteDir = await makeTempDir("flock-archive-remote");

    runGit(remoteDir, ["init", "--bare"]);
    runGit(repoDir, ["remote", "add", "origin", remoteDir]);
    const rootBranch = runGit(repoDir, ["branch", "--show-current"]);
    runGit(repoDir, ["push", "-u", "origin", rootBranch]);
  }

  runGit(repoDir, ["worktree", "add", workspaceDir, "-b", workspaceName]);

  if (withRemote) {
    runGit(workspaceDir, ["push", "-u", "origin", workspaceName]);
  }

  return {
    repoDir,
    workspaceName,
    workspaceDir,
  };
};

afterEach(async () => {
  while (cleanupTargets.length > 0) {
    const target = cleanupTargets.pop();
    if (!target) {
      continue;
    }

    await rm(target, { recursive: true, force: true });
  }
});

describe("archiveWorkspace", () => {
  it("returns uncommitted and unpushed warnings before deleting the worktree", async () => {
    const repoName = unique("archive-warn");
    const { workspaceName, workspaceDir } = await initRepo(repoName, false);

    await writeFile(path.join(workspaceDir, "dirty.txt"), "dirty\n");

    const archived = await archiveWorkspace(repoName, workspaceName);

    expect(archived.name).toBe(workspaceName);
    expect(archived.repo).toBe(repoName);
    expect(archived.path).toBe(workspaceDir);
    expect(archived.warnings).toEqual([
      `Workspace ${workspaceName} has uncommitted changes.`,
      `Workspace ${workspaceName} may contain unpushed commits.`,
    ]);
    await expect(access(workspaceDir)).rejects.toBeDefined();
  });

  it("archives a clean workspace with upstream configured and no warnings", async () => {
    const repoName = unique("archive-clean");
    const { workspaceName, workspaceDir } = await initRepo(repoName, true);

    const archived = await archiveWorkspace(repoName, workspaceName);

    expect(archived).toEqual({
      name: workspaceName,
      repo: repoName,
      path: workspaceDir,
      warnings: [],
    });
    await expect(access(workspaceDir)).rejects.toBeDefined();
  });

  it("throws WORKSPACE_NOT_FOUND when the target workspace does not exist", async () => {
    const repoName = unique("archive-missing");
    await initRepo(repoName, false);

    try {
      await archiveWorkspace(repoName, "does-not-exist");
      throw new Error("Expected archiveWorkspace to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("WORKSPACE_NOT_FOUND");
    }
  });
});
