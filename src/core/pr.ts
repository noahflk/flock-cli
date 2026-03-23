import { dispatchSessionMessage, type SessionMessage } from "./message.js";
import { getRequiredWorktreeSession } from "./session.js";
import { countUncommittedChangesAtPath, getBranchAtPath } from "../lib/git.js";
import { FlockError } from "../lib/types.js";

const DEFAULT_TARGET_BRANCH = "origin/main";

type WorktreeSession = {
  id: string;
  repo: string;
  workspaceName: string | null;
  workspacePath: string | null;
};

type DispatchResult = {
  userMessage: SessionMessage;
  status: "running";
};

type PRRequestDependencies = {
  getSession?: (repo: string, workspaceName: string) => Promise<WorktreeSession>;
  getBranch?: (cwd: string) => Promise<string>;
  countUncommittedChanges?: (cwd: string) => Promise<number>;
  dispatch?: (sessionId: string, content: string) => Promise<DispatchResult>;
};

export type PRRequestResult = {
  sessionId: string;
  repo: string;
  workspace: string;
  branch: string;
  targetBranch: string;
  uncommittedChanges: number;
  userMessage: SessionMessage;
  status: "running";
};

export const buildPRRequestPrompt = (
  branch: string,
  uncommittedChanges: number,
): string => {
  const sections = [
    "The user likes the current state of the code.",
    "",
    `There are ${uncommittedChanges} uncommitted changes.`,
    `The current branch is ${branch}`,
    `The target branch is ${DEFAULT_TARGET_BRANCH}.`,
    "",
    "The user requested a PR.",
    "",
  ];

  sections.push(
    "Follow these steps to create a PR:",
    "",
    "- If you have any skills related to creating PRs, invoke them now. Instructions there should take precedence over these instructions.",
    "- Run `git diff` to review uncommitted changes",
    "- Commit them. Follow any instructions the user gave you about writing commit messages.",
    "- Push to origin.",
    `- Use \`git diff ${DEFAULT_TARGET_BRANCH}...\` to review the PR diff`,
    "- Use `gh pr create --base main` to create a PR onto the target branch. Keep the title under 80 characters. Keep the description under five sentences, unless the user instructed you otherwise. Describe not just changes made in this session but ALL changes in the workspace diff.",
    "",
    "If any of these steps fail, ask the user for help.",
  );

  return sections.join("\n");
};

export const requestWorkspacePR = async (
  repo: string,
  workspaceName: string,
  dependencies: PRRequestDependencies = {},
): Promise<PRRequestResult> => {
  const getSession = dependencies.getSession ?? getRequiredWorktreeSession;
  const getBranch = dependencies.getBranch ?? getBranchAtPath;
  const countUncommittedChanges =
    dependencies.countUncommittedChanges ?? countUncommittedChangesAtPath;
  const dispatch = dependencies.dispatch ?? dispatchSessionMessage;

  const session = await getSession(repo, workspaceName);
  const workspacePath = session.workspacePath;

  if (!workspacePath) {
    throw new FlockError({
      code: "IO_ERROR",
      message: `Session ${session.id} is missing a workspace path`,
    });
  }

  const [branch, uncommittedChanges] = await Promise.all([
    getBranch(workspacePath),
    countUncommittedChanges(workspacePath),
  ]);
  const prompt = buildPRRequestPrompt(branch, uncommittedChanges);
  const result = await dispatch(session.id, prompt);

  return {
    sessionId: session.id,
    repo: session.repo,
    workspace: workspaceName,
    branch,
    targetBranch: DEFAULT_TARGET_BRANCH,
    uncommittedChanges,
    userMessage: result.userMessage,
    status: result.status,
  };
};
