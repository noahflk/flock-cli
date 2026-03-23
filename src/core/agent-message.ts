import type { SessionType } from "../lib/types.js";

type FirstWorktreePromptInput = {
  sessionType: SessionType;
  isFirstMessage: boolean;
};

const FIRST_WORKTREE_SYSTEM_PROMPT_LINES = [
  "The current worktree branch has a random placeholder name.",
  "You may rename the branch once, after the first user message, with `git branch -m` based on that message.",
  "Do not check the current branch name before renaming it.",
  "Choose a concise, specific branch name under 30 characters.",
  "After renaming the branch, continue with the user's request.",
];

export const buildFirstWorktreeSystemPrompt = ({
  sessionType,
  isFirstMessage,
}: FirstWorktreePromptInput): string | null => {
  if (sessionType !== "worktree" || !isFirstMessage) {
    return null;
  }

  return FIRST_WORKTREE_SYSTEM_PROMPT_LINES.join("\n");
};

export const wrapMessageWithSystemInstruction = (
  message: string,
  systemPrompt: string,
): string =>
  [
    "<system_instruction>",
    systemPrompt,
    "</system_instruction>",
    "",
    "<user_request>",
    message,
    "</user_request>",
  ].join("\n");
