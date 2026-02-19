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
});
