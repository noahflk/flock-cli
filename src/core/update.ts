import path from "node:path";
import os from "node:os";
import { runProcess } from "../lib/process.js";
import { FlockError } from "../lib/types.js";

export type UpdateResult = {
  updated: boolean;
  output: string;
};

const FLOCK_DIR = path.join(os.homedir(), "flock-cli");

export const updateFlock = async (): Promise<UpdateResult> => {
  const pull = await runProcess({
    command: "git",
    args: ["pull"],
    cwd: FLOCK_DIR,
  });

  if (pull.exitCode !== 0) {
    throw new FlockError({
      code: "GIT_COMMAND_FAILED",
      message: "Failed to pull latest changes",
      cause: pull.stderr,
    });
  }

  const install = await runProcess({
    command: "bun",
    args: ["install"],
    cwd: FLOCK_DIR,
  });

  if (install.exitCode !== 0) {
    throw new FlockError({
      code: "IO_ERROR",
      message: "Failed to install dependencies",
      cause: install.stderr,
    });
  }

  const alreadyUpToDate = pull.stdout.includes("Already up to date");

  return {
    updated: !alreadyUpToDate,
    output: pull.stdout.trim(),
  };
};
