import { describe, expect, it } from "bun:test";
import { FlockError, type ProcessResult } from "../../src/lib/types.ts";
import { isAlreadyUpToDate, updateFlock } from "../../src/core/update.ts";

type StubRun = (calls: Array<{ command: string; args?: string[]; cwd?: string }>) => (
  input: { command: string; args?: string[]; cwd?: string },
) => Promise<ProcessResult>;

const makeStubRun: StubRun = (calls) => {
  const responses: ProcessResult[] = [
    {
      stdout: "Updating cd24815..d80c4ed\nFast-forward\n",
      stderr: "",
      exitCode: 0,
    },
    {
      stdout: "bun install v1.2.0\nChecked 12 installs across 13 packages\n",
      stderr: "",
      exitCode: 0,
    },
  ];

  return async (input) => {
    calls.push(input);

    const response = responses.shift();
    if (!response) {
      throw new Error("No stubbed process response available.");
    }

    return response;
  };
};

describe("isAlreadyUpToDate", () => {
  it("matches git's standard already-up-to-date output", () => {
    expect(isAlreadyUpToDate("Already up to date.\n")).toBe(true);
    expect(isAlreadyUpToDate("Already up-to-date.\n")).toBe(true);
    expect(isAlreadyUpToDate("Updating abc..def\nFast-forward\n")).toBe(false);
  });
});

describe("updateFlock", () => {
  it("runs git pull and bun install in the flock directory", async () => {
    const calls: Array<{ command: string; args?: string[]; cwd?: string }> = [];

    const result = await updateFlock({
      flockDir: "/tmp/flock-cli",
      run: makeStubRun(calls),
    });

    expect(result).toEqual({
      updated: true,
      summary: "Updating cd24815..d80c4ed",
    });
    expect(calls).toEqual([
      {
        command: "git",
        args: ["pull"],
        cwd: "/tmp/flock-cli",
      },
      {
        command: "bun",
        args: ["install"],
        cwd: "/tmp/flock-cli",
      },
    ]);
  });

  it("marks the repo as current when git reports no new changes", async () => {
    const run = async ({ command }: { command: string }): Promise<ProcessResult> => {
      if (command === "git") {
        return {
          stdout: "Already up to date.\n",
          stderr: "",
          exitCode: 0,
        };
      }

      return {
        stdout: "Checked 12 installs across 13 packages\n",
        stderr: "",
        exitCode: 0,
      };
    };

    const result = await updateFlock({
      flockDir: "/tmp/flock-cli",
      run,
    });

    expect(result).toEqual({
      updated: false,
      summary: "Already up to date.",
    });
  });

  it("throws GIT_COMMAND_FAILED when the pull step fails", async () => {
    const run = async (): Promise<ProcessResult> => {
      return {
        stdout: "",
        stderr: "fatal: not a git repository",
        exitCode: 1,
      };
    };

    try {
      await updateFlock({
        flockDir: "/tmp/flock-cli",
        run,
      });
      throw new Error("Expected updateFlock to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("GIT_COMMAND_FAILED");
    }
  });

  it("throws IO_ERROR when bun install fails", async () => {
    let callCount = 0;

    const run = async (): Promise<ProcessResult> => {
      callCount += 1;

      if (callCount === 1) {
        return {
          stdout: "Updating cd24815..d80c4ed\nFast-forward\n",
          stderr: "",
          exitCode: 0,
        };
      }

      return {
        stdout: "",
        stderr: "error: install failed",
        exitCode: 1,
      };
    };

    try {
      await updateFlock({
        flockDir: "/tmp/flock-cli",
        run,
      });
      throw new Error("Expected updateFlock to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("IO_ERROR");
    }
  });
});
