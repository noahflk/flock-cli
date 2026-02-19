export type ErrorCode =
  | "INVALID_REPO_INPUT"
  | "REPO_NOT_FOUND"
  | "REPO_ALREADY_EXISTS"
  | "INVALID_FLOCK_CONFIG"
  | "SETUP_SCRIPT_FAILED"
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_ALREADY_EXISTS"
  | "WORKSPACE_NAME_CONFLICT"
  | "CLAUDE_COMMAND_FAILED"
  | "PR_COMMAND_FAILED"
  | "GIT_COMMAND_FAILED"
  | "COMMAND_NOT_FOUND"
  | "IO_ERROR";

export type FlockErrorShape = {
  code: ErrorCode;
  message: string;
  cause?: unknown;
};

export class FlockError extends Error {
  code: ErrorCode;
  cause?: unknown;

  constructor({ code, message, cause }: FlockErrorShape) {
    super(message);
    this.name = "FlockError";
    this.code = code;
    this.cause = cause;
  }

  toJSON(): FlockErrorShape {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause,
    };
  }
}

export type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type Repo = {
  name: string;
  path: string;
};

export type Workspace = {
  name: string;
  repo: string;
  path: string;
  branch: string;
};

export type CloneResult = {
  name: string;
  path: string;
};

export type SendResult = {
  response: string;
};

export type WorkspaceResult = {
  name: string;
  path: string;
  branch: string;
};

export type PRResult = {
  url: string;
  branch: string;
};

export type ArchiveResult = {
  name: string;
  repo: string;
  path: string;
  warnings: string[];
};
