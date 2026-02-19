import { assertRepoExists, findWorkspacePath } from "../lib/git.js";
import { runProcess } from "../lib/process.js";
import { FlockError, type SendResult } from "../lib/types.js";

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

export const sendMessage = async (
  target: SendTarget,
  message: string,
): Promise<SendResult> => {
  const cwd = await resolveTargetPath(target);

  const result = await runProcess({
    command: "claude",
    args: ["-p", message],
    cwd,
  });

  if (result.exitCode !== 0) {
    throw new FlockError({
      code: "CLAUDE_COMMAND_FAILED",
      message: result.stderr || "claude command failed",
      cause: result,
    });
  }

  return {
    response: result.stdout.trim(),
  };
};
