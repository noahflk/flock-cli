import type { Command } from "commander";
import { listReposWithOrigin, listWorkspaces } from "../core/list.js";
import { printResult } from "./_shared.js";

export const registerListCommand = (program: Command): void => {
  const list = program.command("list").description("List repos or workspaces");

  list
    .command("repos")
    .description("List cloned repos")
    .option("--all", "Include repos without a GitHub origin")
    .action(async (options: { all?: boolean }) => {
      const repos = await listReposWithOrigin({
        includeNonGitHub: options.all === true,
      });
      printResult(repos);
    });

  list
    .command("workspaces")
    .description("List workspaces (optionally filtered by repo)")
    .argument("[repo]", "Repository filter")
    .action(async (repo?: string) => {
      const workspaces = await listWorkspaces(repo);
      printResult(workspaces);
    });
};
