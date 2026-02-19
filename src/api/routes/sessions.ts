import {
  archiveSession,
  createSession,
  listSessions,
} from "../../core/session.js";
import {
  type SessionModel,
  type SessionStatus,
  type SessionType,
  FlockError,
} from "../../lib/types.js";
import {
  getOptionalBoolean,
  getRequiredString,
  parseJsonBody,
} from "./_shared.js";

const parseSessionStatuses = (raw: string | null): SessionStatus[] | undefined => {
  if (!raw) {
    return undefined;
  }

  const allowed: SessionStatus[] = ["idle", "running", "archived"];
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parsed.length === 0) {
    return undefined;
  }

  for (const status of parsed) {
    if (!allowed.includes(status as SessionStatus)) {
      throw new FlockError({
        code: "INVALID_REQUEST",
        message: `Invalid session status filter: ${status}`,
      });
    }
  }

  return parsed as SessionStatus[];
};

const parseSessionType = (raw: string): SessionType => {
  if (raw === "local" || raw === "worktree") {
    return raw;
  }

  throw new FlockError({
    code: "INVALID_REQUEST",
    message: `Invalid session type: ${raw}`,
  });
};

const parseSessionModel = (raw: unknown): SessionModel => {
  if (raw === undefined || raw === "claude") {
    return "claude";
  }

  if (raw === "codex") {
    return "codex";
  }

  throw new FlockError({
    code: "INVALID_REQUEST",
    message: `Invalid session model: ${String(raw)}`,
  });
};

export const handleListSessionsRoute = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const repo = url.searchParams.get("repo") ?? undefined;
  const statuses = parseSessionStatuses(url.searchParams.get("status"));
  const sessions = await listSessions({ repo, statuses });
  return Response.json({ sessions });
};

export const handleCreateSessionRoute = async (request: Request): Promise<Response> => {
  const body = await parseJsonBody(request);
  const repo = getRequiredString(body, "repo");
  const type = parseSessionType(getRequiredString(body, "type"));
  const model = parseSessionModel(body.model);
  const session = await createSession({ repo, type, model });
  return Response.json(session, { status: 201 });
};

export const handleArchiveSessionRoute = async (
  request: Request,
  sessionId: string,
): Promise<Response> => {
  const url = new URL(request.url);
  const force = getOptionalBoolean(url.searchParams.get("force"), false);
  const result = await archiveSession(sessionId, force);
  return Response.json(result);
};
