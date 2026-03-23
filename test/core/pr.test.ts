import { describe, expect, it } from "bun:test";
import { buildPRRequestPrompt, requestWorkspacePR } from "../../src/core/pr.ts";

describe("buildPRRequestPrompt", () => {
  it("includes workspace git state and workflow steps", () => {
    const prompt = buildPRRequestPrompt("noah/fix-bug", 3);

    expect(prompt).toContain("The user likes the current state of the code.");
    expect(prompt).toContain("There are 3 uncommitted changes.");
    expect(prompt).toContain("The current branch is noah/fix-bug");
    expect(prompt).toContain("The target branch is origin/main.");
    expect(prompt).toContain("Run `git diff` to review uncommitted changes");
    expect(prompt).not.toContain("Additional user instructions:");
  });
});

describe("requestWorkspacePR", () => {
  it("looks up the workspace session, builds the prompt, and dispatches it", async () => {
    const calls: Array<{ sessionId: string; content: string }> = [];

    const result = await requestWorkspacePR("my-app", "fix-bug", {
      getSession: async () => ({
        id: "session-1",
        repo: "my-app",
        workspaceName: "fix-bug",
        workspacePath: "/tmp/fix-bug",
      }),
      getBranch: async () => "noah/fix-bug",
      countUncommittedChanges: async () => 4,
      dispatch: async (sessionId, content) => {
        calls.push({ sessionId, content });
        return {
          status: "running",
          userMessage: {
            id: "message-1",
            role: "user",
            content,
            createdAt: 123,
          },
        };
      },
    });

    expect(calls).toEqual([
      {
        sessionId: "session-1",
        content: expect.stringContaining("There are 4 uncommitted changes."),
      },
    ]);
    expect(result).toEqual({
      sessionId: "session-1",
      repo: "my-app",
      workspace: "fix-bug",
      branch: "noah/fix-bug",
      targetBranch: "origin/main",
      uncommittedChanges: 4,
      userMessage: {
        id: "message-1",
        role: "user",
        content: calls[0]?.content,
        createdAt: 123,
      },
      status: "running",
    });
  });
});
