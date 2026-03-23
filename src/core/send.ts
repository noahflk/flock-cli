import { assertRepoExists, findWorkspacePath } from "../lib/git.js";
import { runProcess } from "../lib/process.js";
import { FlockError, type SendResult } from "../lib/types.js";

export const SEND_MODELS = ["claude", "codex"] as const;
export type SendModel = (typeof SEND_MODELS)[number];

type SendTarget =
  | {
      type: "repo";
      name: string;
    }
  | {
      type: "workspace";
      name: string;
    };

const resolveTargetPath = async (target: SendTarget): Promise<string> => {
  if (target.type === "repo") {
    return await assertRepoExists(target.name);
  }

  const workspace = await findWorkspacePath(target.name);
  return workspace.path;
};

type SendInvocation = {
  command: string;
  args: string[];
};

type SendInvocationOptions = {
  sessionId?: string;
  resume?: boolean;
  appendSystemPrompt?: string;
};

export const buildSendInvocation = (
  message: string,
  model: SendModel = "claude",
  options: SendInvocationOptions = {},
): SendInvocation => {
  if (model === "codex") {
    if (options.resume && options.sessionId) {
      return {
        command: "codex",
        args: ["exec", "resume", options.sessionId, message],
      };
    }

    return {
      command: "codex",
      args: ["exec", message],
    };
  }

  const args = ["-p"];

  if (options.appendSystemPrompt) {
    args.push("--append-system-prompt", options.appendSystemPrompt);
  }

  if (options.resume && options.sessionId) {
    return {
      command: "claude",
      args: [...args, "--resume", options.sessionId, message],
    };
  }

  if (options.sessionId) {
    return {
      command: "claude",
      args: [...args, "--session-id", options.sessionId, message],
    };
  }

  return {
    command: "claude",
    args: [...args, message],
  };
};

export const sendMessage = async (
  target: SendTarget,
  message: string,
  model: SendModel = "claude",
): Promise<SendResult> => {
  const cwd = await resolveTargetPath(target);
  const invocation = buildSendInvocation(message, model);

  const result = await runProcess({
    command: invocation.command,
    args: invocation.args,
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "CLAUDE_COMMAND_FAILED",
      message: result.stderr || `${invocation.command} command failed`,
      cause: result,
    });
  }

  return {
    response: result.stdout.trim(),
  };
};
