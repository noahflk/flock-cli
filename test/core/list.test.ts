import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { listRepos, listReposWithOrigin, listWorkspaces } from "../../src/core/list.ts";
import { REPOS_DIR, WORKSPACES_DIR } from "../../src/lib/config.ts";

const cleanupTargets: string[] = [];

const unique = (label: string): string =>
  `flock-test-${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const trackCleanup = (target: string): void => {
  cleanupTargets.push(target);
};

const runGit = (cwd: string, args: string[]): void => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return;
  }

  throw new Error(
    `git ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.stdout || "unknown error"}`,
  );
};

const initGitRepoWithBranch = async (dir: string, branch: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
  runGit(dir, ["init"]);
  runGit(dir, ["checkout", "-b", branch]);
  runGit(dir, ["config", "user.email", "flock-tests@example.com"]);
  runGit(dir, ["config", "user.name", "Flock Tests"]);

  const readmePath = path.join(dir, "README.md");
  await writeFile(readmePath, "seed\n");

  runGit(dir, ["add", "README.md"]);
  runGit(dir, ["commit", "-m", "init"]);
};

const initGitRepoWithOrigin = async (
  dir: string,
  origin: string,
): Promise<void> => {
  await initGitRepoWithBranch(dir, "main");
  runGit(dir, ["remote", "add", "origin", origin]);
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

describe("listRepos", () => {
  it("lists repository directories and keeps name/path pairs consistent", async () => {
    const repoA = unique("repo-a");
    const repoB = unique("repo-b");
    const repoAPath = path.join(REPOS_DIR, repoA);
    const repoBPath = path.join(REPOS_DIR, repoB);

    await mkdir(repoAPath, { recursive: true });
    await mkdir(repoBPath, { recursive: true });
    trackCleanup(repoAPath);
    trackCleanup(repoBPath);

    const repos = await listRepos();
    const ours = repos.filter((repo) => repo.name.startsWith("flock-test-repo-"));

    const names = ours.map((repo) => repo.name);
    expect(names).toContain(repoA);
    expect(names).toContain(repoB);

    const repoAResult = ours.find((repo) => repo.name === repoA);
    const repoBResult = ours.find((repo) => repo.name === repoB);

    expect(repoAResult?.path).toBe(repoAPath);
    expect(repoBResult?.path).toBe(repoBPath);
  });
});

describe("listReposWithOrigin", () => {
  it("returns only GitHub repos by default with origin values", async () => {
    const githubRepo = unique("repo-github");
    const gitlabRepo = unique("repo-gitlab");
    const plainRepo = unique("repo-plain");
    const githubRepoPath = path.join(REPOS_DIR, githubRepo);
    const gitlabRepoPath = path.join(REPOS_DIR, gitlabRepo);
    const plainRepoPath = path.join(REPOS_DIR, plainRepo);

    trackCleanup(githubRepoPath);
    trackCleanup(gitlabRepoPath);
    trackCleanup(plainRepoPath);

    await initGitRepoWithOrigin(githubRepoPath, "git@github.com:acme/widget.git");
    await initGitRepoWithOrigin(gitlabRepoPath, "git@gitlab.com:acme/widget.git");
    await mkdir(plainRepoPath, { recursive: true });

    const repos = await listReposWithOrigin();
    const ours = repos.filter((repo) => repo.name.startsWith("flock-test-repo-"));

    expect(ours).toEqual([
      {
        name: githubRepo,
        path: githubRepoPath,
        origin: "git@github.com:acme/widget.git",
      },
    ]);
  });

  it("includes non-GitHub and no-origin repos when includeNonGitHub is enabled", async () => {
    const githubRepo = unique("repo-github-all");
    const gitlabRepo = unique("repo-gitlab-all");
    const plainRepo = unique("repo-plain-all");
    const githubRepoPath = path.join(REPOS_DIR, githubRepo);
    const gitlabRepoPath = path.join(REPOS_DIR, gitlabRepo);
    const plainRepoPath = path.join(REPOS_DIR, plainRepo);

    trackCleanup(githubRepoPath);
    trackCleanup(gitlabRepoPath);
    trackCleanup(plainRepoPath);

    await initGitRepoWithOrigin(githubRepoPath, "https://github.com/acme/widget.git");
    await initGitRepoWithOrigin(gitlabRepoPath, "https://gitlab.com/acme/widget.git");
    await mkdir(plainRepoPath, { recursive: true });

    const repos = await listReposWithOrigin({ includeNonGitHub: true });
    const ours = repos
      .filter((repo) => repo.name.startsWith("flock-test-repo-"))
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(ours).toEqual([
      {
        name: githubRepo,
        path: githubRepoPath,
        origin: "https://github.com/acme/widget.git",
      },
      {
        name: gitlabRepo,
        path: gitlabRepoPath,
        origin: "https://gitlab.com/acme/widget.git",
      },
      {
        name: plainRepo,
        path: plainRepoPath,
      },
    ]);
  });
});

describe("listWorkspaces", () => {
  it("lists workspaces for a specific repo and falls back to unknown branch on non-git dirs", async () => {
    const repoName = unique("repo");
    const repoRoot = path.join(WORKSPACES_DIR, repoName);
    const trackedPath = path.join(repoRoot, unique("tracked"));
    const plainPath = path.join(repoRoot, unique("plain"));
    const trackedName = path.basename(trackedPath);
    const plainName = path.basename(plainPath);
    const branchName = unique("branch");

    trackCleanup(repoRoot);
    await initGitRepoWithBranch(trackedPath, branchName);
    await mkdir(plainPath, { recursive: true });

    const workspaces = await listWorkspaces(repoName);
    const ours = workspaces.filter((workspace) => workspace.repo === repoName);

    expect(ours).toHaveLength(2);

    const tracked = ours.find((workspace) => workspace.name === trackedName);
    const plain = ours.find((workspace) => workspace.name === plainName);

    expect(tracked).toEqual({
      name: trackedName,
      repo: repoName,
      path: trackedPath,
      branch: branchName,
    });

    expect(plain).toEqual({
      name: plainName,
      repo: repoName,
      path: plainPath,
      branch: "unknown",
    });
  });

  it("lists workspaces across repos when no filter is provided", async () => {
    const repoA = unique("repo-a");
    const repoB = unique("repo-b");
    const repoARoot = path.join(WORKSPACES_DIR, repoA);
    const repoBRoot = path.join(WORKSPACES_DIR, repoB);
    const workspaceA = unique("workspace-a");
    const workspaceB = unique("workspace-b");
    const workspaceAPath = path.join(repoARoot, workspaceA);
    const workspaceBPath = path.join(repoBRoot, workspaceB);

    trackCleanup(repoARoot);
    trackCleanup(repoBRoot);

    await mkdir(workspaceAPath, { recursive: true });
    await mkdir(workspaceBPath, { recursive: true });

    const allWorkspaces = await listWorkspaces();
    const ours = allWorkspaces.filter(
      (workspace) => workspace.name === workspaceA || workspace.name === workspaceB,
    );

    expect(ours).toEqual([
      {
        name: workspaceA,
        repo: repoA,
        path: workspaceAPath,
        branch: "unknown",
      },
      {
        name: workspaceB,
        repo: repoB,
        path: workspaceBPath,
        branch: "unknown",
      },
    ]);
  });
});
