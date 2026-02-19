import { afterEach, describe, expect, it } from "bun:test";
import { generateWorkspaceName } from "../../src/lib/words.ts";

const originalRandom = Math.random;

afterEach(() => {
  Math.random = originalRandom;
});

describe("generateWorkspaceName", () => {
  it("returns adjective-noun names when the candidate is available", () => {
    Math.random = () => 0;
    expect(generateWorkspaceName(new Set())).toBe("amber-badger");
  });

  it("retries when a generated name is already taken", () => {
    const sequence = [0, 0, 0, 0.03];
    Math.random = () => sequence.shift() ?? 0;

    expect(generateWorkspaceName(new Set(["amber-badger"]))).toBe("amber-beacon");
  });

  it("falls back to a timestamp-based name after repeated collisions", () => {
    Math.random = () => 0;

    const generated = generateWorkspaceName(new Set(["amber-badger"]));
    expect(generated).toMatch(/^workspace-\d+$/);
  });
});
