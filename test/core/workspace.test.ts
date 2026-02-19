import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createWorkspace } from "../../src/core/workspace.ts";
import { REPOS_DIR, WORKSPACES_DIR } from "../../src/lib/config.ts";
import { FlockError } from "../../src/lib/types.ts";

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

const ensureRepoWithInitialCommit = async (repoName: string): Promise<string> => {
  const repoDir = path.join(REPOS_DIR, repoName);
  await mkdir(repoDir, { recursive: true });
  trackCleanup(repoDir);
  trackCleanup(path.join(WORKSPACES_DIR, repoName));

  runGit(repoDir, ["init"]);
  runGit(repoDir, ["config", "user.email", "flock-tests@example.com"]);
  runGit(repoDir, ["config", "user.name", "Flock Tests"]);

  await writeFile(path.join(repoDir, "README.md"), "# test\n");
  runGit(repoDir, ["add", "README.md"]);
  runGit(repoDir, ["commit", "-m", "init"]);

  return repoDir;
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

describe("createWorkspace", () => {
  it("runs flock.json setupScript in the new workspace with expected env vars", async () => {
    const repoName = unique("workspace-setup");
    const repoDir = await ensureRepoWithInitialCommit(repoName);
    const scriptOutputPath = path.join("tmp-setup-vars.txt");

    await writeFile(
      path.join(repoDir, "flock.json"),
      JSON.stringify({
        setupScript: `printf '%s\\n%s\\n' \"$REPO_ROOT_PATH\" \"$WORKSPACE_PATH\" > ${scriptOutputPath}`,
      }),
    );

    const workspace = await createWorkspace(repoName);
    const writtenPath = path.join(workspace.path, scriptOutputPath);
    const contents = await readFile(writtenPath, "utf8");
    const [repoEnv, workspaceEnv] = contents.trim().split("\n");

    expect(repoEnv).toBe(repoDir);
    expect(workspaceEnv).toBe(workspace.path);
    expect(workspace.branch).toBe(workspace.name);
  });

  it("skips running setupScript when flock.json setupScript is only whitespace", async () => {
    const repoName = unique("workspace-skip-setup");
    const repoDir = await ensureRepoWithInitialCommit(repoName);

    await writeFile(
      path.join(repoDir, "flock.json"),
      JSON.stringify({
        setupScript: "   ",
      }),
    );

    const workspace = await createWorkspace(repoName);
    const markerPath = path.join(workspace.path, "tmp-setup-vars.txt");

    await expect(access(markerPath)).rejects.toBeDefined();
  });

  it("throws SETUP_SCRIPT_FAILED when setupScript exits non-zero", async () => {
    const repoName = unique("workspace-failing-setup");
    const repoDir = await ensureRepoWithInitialCommit(repoName);

    await writeFile(
      path.join(repoDir, "flock.json"),
      JSON.stringify({
        setupScript: "echo setup failed >&2; exit 17",
      }),
    );

    try {
      await createWorkspace(repoName);
      throw new Error("Expected createWorkspace to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("SETUP_SCRIPT_FAILED");
      expect((error as FlockError).message).toContain("setup failed");
    }
  });
});
