import { spawn } from "node:child_process";
import type { ProcessResult } from "./types.js";

type RunProcessInput = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

const hasBunSpawn = (): boolean => {
  const maybeBun = (globalThis as { Bun?: { spawn?: unknown } }).Bun;
  return typeof maybeBun?.spawn === "function";
};

const runWithBun = async ({
  command,
  args = [],
  cwd,
  env,
}: RunProcessInput): Promise<ProcessResult> => {
  const maybeBun = (globalThis as unknown as {
    Bun: {
      spawn: (
        cmd: string[],
        opts: {
          cwd?: string;
          env?: NodeJS.ProcessEnv;
          stdout: "pipe";
          stderr: "pipe";
        },
      ) => {
        stdout: ReadableStream<Uint8Array>;
        stderr: ReadableStream<Uint8Array>;
        exited: Promise<number>;
      };
    };
  }).Bun;

  const proc = maybeBun.spawn([command, ...args], {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    stdout,
    stderr,
    exitCode,
  };
};

const runWithNode = async ({
  command,
  args = [],
  cwd,
  env,
}: RunProcessInput): Promise<ProcessResult> => {
  return await new Promise<ProcessResult>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: env ?? process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error: Error) => {
      stderr += error.message;
      resolve({
        stdout,
        stderr,
        exitCode: 127,
      });
    });

    child.on("close", (code: number | null) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
};

export const runProcess = async (
  input: RunProcessInput,
): Promise<ProcessResult> => {
  if (hasBunSpawn()) {
    return await runWithBun(input);
  }

  return await runWithNode(input);
};
