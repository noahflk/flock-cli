import path from "node:path";
import os from "node:os";
import { runProcess } from "../lib/process.js";
import { FlockError } from "../lib/types.js";

export type UpdateResult = {
  updated: boolean;
  summary: string;
};

const FLOCK_DIR = path.join(os.homedir(), "flock-cli");
const ALREADY_UP_TO_DATE_PATTERN = /already up[- ]to[- ]date\.?/i;

type RunProcessFn = typeof runProcess;

type UpdateDependencies = {
  flockDir?: string;
  run?: RunProcessFn;
};

const summarizeProcessOutput = (output: string): string => {
  return (
    output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "Update completed."
  );
};

export const isAlreadyUpToDate = (output: string): boolean => {
  return ALREADY_UP_TO_DATE_PATTERN.test(output);
};

export const updateFlock = async ({
  flockDir = FLOCK_DIR,
  run = runProcess,
}: UpdateDependencies = {}): Promise<UpdateResult> => {
  const pull = await run({
    command: "git",
    args: ["pull"],
    cwd: flockDir,
  });

  if (pull.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: "Failed to pull latest changes",
      cause: pull.stderr,
    });
  }

  const install = await run({
    command: "bun",
    args: ["install"],
    cwd: flockDir,
  });

  if (install.exitCode !== 0) {
    throw new FlockError({
      code: "IO_ERROR",
      message: "Failed to install dependencies",
      cause: install.stderr,
    });
  }

  const alreadyUpToDate = isAlreadyUpToDate(pull.stdout);

  return {
    updated: !alreadyUpToDate,
    summary: summarizeProcessOutput(pull.stdout),
  };
};
