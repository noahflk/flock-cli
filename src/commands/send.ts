import type { Command } from "commander";
import { sendMessage } from "../core/send.js";
import { printResult } from "./_shared.js";

export const registerSendCommand = (program: Command): void => {
  const send = program
    .command("send")
    .description("Send a prompt to a repo or workspace via Claude");

  send
    .command("workspace")
    .description("Send a prompt to a workspace")
    .argument("<workspace>", "Workspace name")
    .argument("<message>", "Prompt to send")
    .action(async (workspace: string, message: string) => {
      const result = await sendMessage({ type: "workspace", name: workspace }, message);
      printResult(result);
    });

  send
    .argument("<repo>", "Repository name")
    .argument("<message>", "Prompt to send")
    .action(async (repo: string, message: string) => {
      const result = await sendMessage({ type: "repo", name: repo }, message);
      printResult(result);
    });
};
