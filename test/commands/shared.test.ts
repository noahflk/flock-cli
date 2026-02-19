import { afterEach, describe, expect, it } from "bun:test";
import { normalizeError, printResult } from "../../src/commands/_shared.ts";
import { FlockError } from "../../src/lib/types.ts";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("printResult", () => {
  it("prints JSON output with indentation", () => {
    const calls: unknown[][] = [];
    console.log = ((...args: unknown[]) => {
      calls.push(args);
    }) as typeof console.log;

    printResult({ ok: true, count: 2 });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(
      JSON.stringify(
        {
          ok: true,
          count: 2,
        },
        null,
        2,
      ),
    );
  });
});

describe("normalizeError", () => {
  it("returns FlockError payloads as-is", () => {
    const error = new FlockError({
      code: "REPO_NOT_FOUND",
      message: "Missing repo",
      cause: { repo: "acme/widget" },
    });

    expect(normalizeError(error)).toEqual({
      code: "REPO_NOT_FOUND",
      message: "Missing repo",
      cause: {
        repo: "acme/widget",
      },
    });
  });

  it("normalizes unknown Error instances to IO_ERROR", () => {
    const error = new Error("disk is full");
    const normalized = normalizeError(error);

    expect(normalized.code).toBe("IO_ERROR");
    expect(normalized.message).toBe("disk is full");
    expect(typeof normalized.cause).toBe("string");
  });

  it("normalizes non-Error values to an unknown IO_ERROR", () => {
    const normalized = normalizeError({ detail: "boom" });

    expect(normalized).toEqual({
      code: "IO_ERROR",
      message: "Unknown error",
      cause: { detail: "boom" },
    });
  });
});
