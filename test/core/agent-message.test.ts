import { describe, expect, it } from "bun:test";
import {
  buildFirstWorktreeSystemPrompt,
  wrapMessageWithSystemInstruction,
} from "../../src/core/agent-message.ts";

describe("buildFirstWorktreeSystemPrompt", () => {
  it("returns branch rename instructions for the first worktree message", () => {
    const prompt = buildFirstWorktreeSystemPrompt({
      sessionType: "worktree",
      isFirstMessage: true,
    });

    expect(prompt).toContain("You may rename the branch once");
    expect(prompt).toContain("`git branch -m`");
  });

  it("returns null for later worktree messages", () => {
    expect(
      buildFirstWorktreeSystemPrompt({
        sessionType: "worktree",
        isFirstMessage: false,
      }),
    ).toBeNull();
  });

  it("returns null for local sessions", () => {
    expect(
      buildFirstWorktreeSystemPrompt({
        sessionType: "local",
        isFirstMessage: true,
      }),
    ).toBeNull();
  });
});

describe("wrapMessageWithSystemInstruction", () => {
  it("wraps the original user request alongside the system instruction", () => {
    expect(
      wrapMessageWithSystemInstruction(
        "fix the parser error handling",
        "You may rename the branch once with `git branch -m`.",
      ),
    ).toContain("<user_request>\nfix the parser error handling\n</user_request>");
  });
});
