import type { Command } from "commander";
import { updateFlock } from "../core/update.js";
import { printResult } from "./_shared.js";

export const registerUpdateCommand = (program: Command): void => {
  program
    .command("update")
    .description("Pull the latest version and reinstall dependencies")
    .action(async () => {
      const result = await updateFlock();
      printResult(result);
    });
};
