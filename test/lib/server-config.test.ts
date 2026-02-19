import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { loadServerConfig } from "../../src/lib/server-config.ts";
import { FlockError } from "../../src/lib/types.ts";

const cleanupTargets: string[] = [];

const makeTempDir = async (label: string): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), `${label}-`));
  cleanupTargets.push(dir);
  return dir;
};

const writeServerConfig = async (
  targetPath: string,
  input: { secret: string; port: number },
): Promise<void> => {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(input));
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

describe("loadServerConfig", () => {
  it("prefers FLOCK_SERVER_CONFIG_PATH when provided", async () => {
    const rootDir = await makeTempDir("flock-server-config-env");
    const cwd = path.join(rootDir, "repo");
    const envConfigPath = path.join(rootDir, "env-server-config.json");
    const repoConfigPath = path.join(cwd, ".flock", "server-config.json");
    const homeConfigPath = path.join(rootDir, "home", ".flock", "server-config.json");

    await mkdir(cwd, { recursive: true });
    await writeServerConfig(envConfigPath, { secret: "env", port: 4001 });
    await writeServerConfig(repoConfigPath, { secret: "repo", port: 4002 });
    await writeServerConfig(homeConfigPath, { secret: "home", port: 4003 });

    const config = await loadServerConfig({
      cwd,
      homeConfigPath,
      env: {
        FLOCK_SERVER_CONFIG_PATH: envConfigPath,
      },
    });

    expect(config).toEqual({
      secret: "env",
      port: 4001,
    });
  });

  it("uses repo-local .flock/server-config.json before home fallback", async () => {
    const rootDir = await makeTempDir("flock-server-config-repo");
    const cwd = path.join(rootDir, "repo");
    const repoConfigPath = path.join(cwd, ".flock", "server-config.json");
    const homeConfigPath = path.join(rootDir, "home", ".flock", "server-config.json");

    await mkdir(cwd, { recursive: true });
    await writeServerConfig(repoConfigPath, { secret: "repo", port: 4101 });
    await writeServerConfig(homeConfigPath, { secret: "home", port: 4102 });

    const config = await loadServerConfig({
      cwd,
      homeConfigPath,
      env: {},
    });

    expect(config).toEqual({
      secret: "repo",
      port: 4101,
    });
  });

  it("falls back to home server-config.json when repo config is missing", async () => {
    const rootDir = await makeTempDir("flock-server-config-home");
    const cwd = path.join(rootDir, "repo");
    const homeConfigPath = path.join(rootDir, "home", ".flock", "server-config.json");

    await mkdir(cwd, { recursive: true });
    await writeServerConfig(homeConfigPath, { secret: "home", port: 4201 });

    const config = await loadServerConfig({
      cwd,
      homeConfigPath,
      env: {},
    });

    expect(config).toEqual({
      secret: "home",
      port: 4201,
    });
  });

  it("throws INVALID_FLOCK_CONFIG when no config exists in any location", async () => {
    const rootDir = await makeTempDir("flock-server-config-missing");
    const cwd = path.join(rootDir, "repo");
    const homeConfigPath = path.join(rootDir, "home", ".flock", "server-config.json");

    await mkdir(cwd, { recursive: true });

    try {
      await loadServerConfig({
        cwd,
        homeConfigPath,
        env: {},
      });
      throw new Error("Expected loadServerConfig to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_FLOCK_CONFIG");
      expect((error as FlockError).message).toContain("Tried:");
    }
  });
});
