import { describe, expect, it } from "bun:test";
import {
  applyCommandPathOverrides,
  resolveConfiguredCommand,
} from "../../src/lib/command-paths.ts";

describe("resolveConfiguredCommand", () => {
  it("uses configured paths for claude, codex, and gh", () => {
    const env = {
      FLOCK_CLAUDE_PATH: "/opt/bin/claude",
      FLOCK_CODEX_PATH: "/opt/bin/codex",
      FLOCK_GH_PATH: "/usr/local/bin/gh",
    };

    expect(resolveConfiguredCommand("claude", env)).toBe("/opt/bin/claude");
    expect(resolveConfiguredCommand("codex", env)).toBe("/opt/bin/codex");
    expect(resolveConfiguredCommand("gh", env)).toBe("/usr/local/bin/gh");
  });

  it("leaves other commands unchanged", () => {
    expect(resolveConfiguredCommand("git", {})).toBe("git");
    expect(resolveConfiguredCommand("/usr/bin/gh", {})).toBe("/usr/bin/gh");
  });
});

describe("applyCommandPathOverrides", () => {
  it("writes only non-empty overrides into the environment", () => {
    const env: NodeJS.ProcessEnv = {};

    applyCommandPathOverrides(
      {
        claudePath: undefined,
        codexPath: "/opt/bin/codex",
        ghPath: "  ",
      },
      env,
    );

    expect(env.FLOCK_CLAUDE_PATH).toBeUndefined();
    expect(env.FLOCK_CODEX_PATH).toBe("/opt/bin/codex");
    expect(env.FLOCK_GH_PATH).toBeUndefined();
  });
});
