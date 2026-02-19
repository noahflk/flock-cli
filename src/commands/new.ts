import type { Command } from "commander";
import { createWorkspace } from "../core/workspace.js";
import { printResult } from "./_shared.js";

export const registerNewCommand = (program: Command): void => {
  program
    .command("new")
    .description("Create a new git worktree workspace")
    .argument("<repo>", "Repository name under ~/repos")
    .action(async (repo: string) => {
      const result = await createWorkspace(repo);
      printResult(result);
    });
};
