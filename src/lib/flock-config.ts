import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { FlockError } from "./types.js";

export type RepoFlockConfig = {
  setupScript?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateFlockConfig = (value: unknown, repoDir: string): RepoFlockConfig => {
  if (!isObject(value)) {
    throw new FlockError({
      code: "INVALID_FLOCK_CONFIG",
      message: `Invalid flock.json in ${repoDir}: expected an object`,
    });
  }

  const setupScript = value.setupScript;
  if (setupScript !== undefined && typeof setupScript !== "string") {
    throw new FlockError({
      code: "INVALID_FLOCK_CONFIG",
      message: `Invalid flock.json in ${repoDir}: setupScript must be a string`,
    });
  }

  return {
    setupScript,
  };
};

export const loadRepoFlockConfig = async (
  repoDir: string,
): Promise<RepoFlockConfig | null> => {
  const configPath = path.join(repoDir, "flock.json");

  try {
    await access(configPath);
  } catch {
    return null;
  }

  const raw = await readFile(configPath, "utf8").catch((error: unknown) => {
    throw new FlockError({
      code: "IO_ERROR",
      message: `Failed to read ${configPath}`,
      cause: error,
    });
  });

  const parsed = (() => {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new FlockError({
        code: "INVALID_FLOCK_CONFIG",
        message: `Invalid JSON in ${configPath}`,
        cause: error,
      });
    }
  })();

  return validateFlockConfig(parsed, repoDir);
};
