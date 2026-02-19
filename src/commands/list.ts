import type { Command } from "commander";
import { listRepos, listWorkspaces } from "../core/list.js";
import { printResult } from "./_shared.js";

export const registerListCommand = (program: Command): void => {
  const list = program.command("list").description("List repos or workspaces");

  list
    .command("repos")
    .description("List cloned repos")
    .action(async () => {
      const repos = await listRepos();
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
