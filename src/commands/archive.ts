import type { Command } from "commander";
import { archiveWorkspace } from "../core/archive.js";
import { printResult } from "./_shared.js";

export const registerArchiveCommand = (program: Command): void => {
  program
    .command("archive")
    .description("Archive a workspace by deleting its git worktree")
    .argument("<repo>", "Repository name")
    .argument("<workspace>", "Workspace name")
    .action(async (repo: string, workspace: string) => {
      const result = await archiveWorkspace(repo, workspace);

      for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
      }

      printResult(result);
    });
};
