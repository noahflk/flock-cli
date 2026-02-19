import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { SERVER_CONFIG_PATH } from "./config.js";
import { FlockError } from "./types.js";

export type ServerConfig = {
  secret: string;
  port: number;
};

type LoadServerConfigOptions = {
  cwd?: string;
  homeConfigPath?: string;
  env?: NodeJS.ProcessEnv;
};

const SERVER_CONFIG_ENV_VAR = "FLOCK_SERVER_CONFIG_PATH";
const REPO_SERVER_CONFIG_RELATIVE_PATH = path.join(".flock", "server-config.json");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toServerConfig = (value: unknown, configPath: string): ServerConfig => {
  if (!isObject(value)) {
    throw new FlockError({
      code: "INVALID_FLOCK_CONFIG",
      message: `Invalid server config at ${configPath}: expected an object`,
    });
  }

  const secret = value.secret;
  const port = value.port;

  if (typeof secret !== "string" || secret.trim().length === 0) {
    throw new FlockError({
      code: "INVALID_FLOCK_CONFIG",
      message: `Invalid server config at ${configPath}: secret must be a non-empty string`,
    });
  }

  if (
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new FlockError({
      code: "INVALID_FLOCK_CONFIG",
      message: `Invalid server config at ${configPath}: port must be an integer between 1 and 65535`,
    });
  }

  return {
    secret,
    port,
  };
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const uniquePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const candidate of paths) {
    if (!seen.has(candidate)) {
      seen.add(candidate);
      ordered.push(candidate);
    }
  }

  return ordered;
};

const resolveCandidatePaths = (options: LoadServerConfigOptions): string[] => {
  const cwd = options.cwd ?? process.cwd();
  const homeConfigPath = options.homeConfigPath ?? SERVER_CONFIG_PATH;
  const env = options.env ?? process.env;
  const envPath = env[SERVER_CONFIG_ENV_VAR]?.trim();
  const candidates = [];

  if (envPath && envPath.length > 0) {
    candidates.push(path.resolve(cwd, envPath));
  }

  candidates.push(path.join(cwd, REPO_SERVER_CONFIG_RELATIVE_PATH));
  candidates.push(homeConfigPath);

  return uniquePaths(candidates);
};

export const loadServerConfig = async (
  options: LoadServerConfigOptions = {},
): Promise<ServerConfig> => {
  const candidates = resolveCandidatePaths(options);
  const configPath = await (async (): Promise<string> => {
    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }

    throw new FlockError({
      code: "INVALID_FLOCK_CONFIG",
      message: `Server config not found. Tried: ${candidates.join(", ")}`,
    });
  })();

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

  return toServerConfig(parsed, configPath);
};
