import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { loadRepoFlockConfig } from "../../src/lib/flock-config.ts";
import { FlockError } from "../../src/lib/types.ts";

const cleanupTargets: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "flock-config-test-"));
  cleanupTargets.push(dir);
  return dir;
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

describe("loadRepoFlockConfig", () => {
  it("returns null when flock.json is missing", async () => {
    const repoDir = await makeTempDir();
    await expect(loadRepoFlockConfig(repoDir)).resolves.toBeNull();
  });

  it("loads setupScript when flock.json is valid", async () => {
    const repoDir = await makeTempDir();
    await writeFile(
      path.join(repoDir, "flock.json"),
      JSON.stringify({ setupScript: "pnpm install" }),
    );

    await expect(loadRepoFlockConfig(repoDir)).resolves.toEqual({
      setupScript: "pnpm install",
    });
  });

  it("throws INVALID_FLOCK_CONFIG when setupScript is not a string", async () => {
    const repoDir = await makeTempDir();
    await writeFile(path.join(repoDir, "flock.json"), JSON.stringify({ setupScript: 42 }));

    try {
      await loadRepoFlockConfig(repoDir);
      throw new Error("Expected loadRepoFlockConfig to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_FLOCK_CONFIG");
    }
  });

  it("throws INVALID_FLOCK_CONFIG when flock.json has invalid JSON", async () => {
    const repoDir = await makeTempDir();
    await writeFile(path.join(repoDir, "flock.json"), "{");

    try {
      await loadRepoFlockConfig(repoDir);
      throw new Error("Expected loadRepoFlockConfig to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_FLOCK_CONFIG");
    }
  });

  it("throws INVALID_FLOCK_CONFIG when flock.json root is not an object", async () => {
    const repoDir = await makeTempDir();
    await writeFile(path.join(repoDir, "flock.json"), JSON.stringify(["not-an-object"]));

    try {
      await loadRepoFlockConfig(repoDir);
      throw new Error("Expected loadRepoFlockConfig to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_FLOCK_CONFIG");
      expect((error as FlockError).message).toContain("expected an object");
    }
  });

  it("throws IO_ERROR when flock.json cannot be read as a file", async () => {
    const repoDir = await makeTempDir();
    await mkdir(path.join(repoDir, "flock.json"));

    try {
      await loadRepoFlockConfig(repoDir);
      throw new Error("Expected loadRepoFlockConfig to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("IO_ERROR");
      expect((error as FlockError).message).toContain("Failed to read");
    }
  });
});
