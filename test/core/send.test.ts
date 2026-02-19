import { describe, expect, it } from "bun:test";
import { buildSendInvocation } from "../../src/core/send.ts";

describe("buildSendInvocation", () => {
  it("uses claude -p by default", () => {
    expect(buildSendInvocation("review this patch")).toEqual({
      command: "claude",
      args: ["-p", "review this patch"],
    });
  });

  it("uses codex exec when model is codex", () => {
    expect(buildSendInvocation("review this patch", "codex")).toEqual({
      command: "codex",
      args: ["exec", "review this patch"],
    });
  });

  it("uses claude --session-id when provided for first message", () => {
    expect(buildSendInvocation("review this patch", "claude", { sessionId: "abc-123" })).toEqual({
      command: "claude",
      args: ["-p", "--session-id", "abc-123", "review this patch"],
    });
  });

  it("uses claude --resume when resume is enabled", () => {
    expect(
      buildSendInvocation("review this patch", "claude", {
        sessionId: "abc-123",
        resume: true,
      }),
    ).toEqual({
      command: "claude",
      args: ["-p", "--resume", "abc-123", "review this patch"],
    });
  });

  it("uses codex exec resume when session resume is requested", () => {
    expect(
      buildSendInvocation("review this patch", "codex", {
        sessionId: "session-1",
        resume: true,
      }),
    ).toEqual({
      command: "codex",
      args: ["exec", "resume", "session-1", "review this patch"],
    });
  });
});
