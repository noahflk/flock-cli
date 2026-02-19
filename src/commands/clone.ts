import type { Command } from "commander";
import { cloneRepo } from "../core/clone.js";
import { printResult } from "./_shared.js";

export const registerCloneCommand = (program: Command): void => {
  program
    .command("clone")
    .description("Clone a repository into ~/repos")
    .argument("<repo>", "owner/repo shorthand or full URL")
    .action(async (repo: string) => {
      const result = await cloneRepo(repo);
      printResult(result);
    });
};
