#!/usr/bin/env bun
import { Command } from "commander";
import { registerArchiveCommand } from "./commands/archive.js";
import { registerCloneCommand } from "./commands/clone.js";
import { normalizeError } from "./commands/_shared.js";
import { registerListCommand } from "./commands/list.js";
import { registerNewCommand } from "./commands/new.js";
import { registerPRCommand } from "./commands/pr.js";
import { registerSendCommand } from "./commands/send.js";

const program = new Command();

program
  .name("flock")
  .description("Manage headless Claude sessions across repos and workspaces")
  .showHelpAfterError();

registerCloneCommand(program);
registerArchiveCommand(program);
registerSendCommand(program);
registerNewCommand(program);
registerPRCommand(program);
registerListCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  const normalized = normalizeError(error);
  console.error(JSON.stringify(normalized, null, 2));
  process.exitCode = 1;
});
