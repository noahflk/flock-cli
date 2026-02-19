import { Option, type Command } from "commander";
import { SEND_MODELS, type SendModel, sendMessage } from "../core/send.js";
import { printResult } from "./_shared.js";

type SendCommandOptions = {
  model: SendModel;
};

const addModelOption = <T extends Command>(command: T): T => {
  command.addOption(
    new Option("--model <model>", "AI model to use")
      .choices([...SEND_MODELS])
      .default("claude"),
  );

  return command;
};

export const registerSendCommand = (program: Command): void => {
  const send = program
    .command("send")
    .description("Send a prompt to a repo or workspace via AI CLI");

  addModelOption(
    send
      .command("workspace")
      .description("Send a prompt to a workspace")
      .argument("<workspace>", "Workspace name")
      .argument("<message>", "Prompt to send"),
  ).action(async (workspace: string, message: string, options: SendCommandOptions) => {
    const result = await sendMessage(
      { type: "workspace", name: workspace },
      message,
      options.model,
    );
    printResult(result);
  });

  addModelOption(
    send.argument("<repo>", "Repository name").argument("<message>", "Prompt to send"),
  ).action(async (repo: string, message: string, options: SendCommandOptions) => {
    const result = await sendMessage({ type: "repo", name: repo }, message, options.model);
    printResult(result);
  });
};
