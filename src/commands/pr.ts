import type { Command } from "commander";
import { requestWorkspacePR } from "../core/pr.js";
import { printResult } from "./_shared.js";

export const registerPRCommand = (program: Command): void => {
  program
    .command("pr")
    .description("Ask a workspace session to review, commit, push, and open a PR")
    .argument("<repo>", "Repository name")
    .argument("<workspace>", "Workspace name")
    .action(async (repo: string, workspace: string) => {
      const result = await requestWorkspacePR(repo, workspace);
      printResult(result);
    });
};
