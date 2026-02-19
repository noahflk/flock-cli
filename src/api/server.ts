import { initializeDatabase } from "./db/client.js";
import { RateLimiter, runMiddleware } from "./middleware.js";
import { handleHealthRoute } from "./routes/health.js";
import { handleCreateRepoRoute, handleListReposRoute } from "./routes/repos.js";
import {
  handleArchiveSessionRoute,
  handleCreateSessionRoute,
  handleListSessionsRoute,
} from "./routes/sessions.js";
import {
  handleCancelMessageRoute,
  handleCreateMessageRoute,
  handleListMessagesRoute,
} from "./routes/messages.js";
import { loadServerConfig } from "../lib/server-config.js";
import { FlockError, type ErrorCode } from "../lib/types.js";

type RouteContext = {
  request: Request;
  server: Bun.Server<unknown>;
  secret: string;
  rateLimiter: RateLimiter;
};

const statusForErrorCode = (code: ErrorCode): number => {
  switch (code) {
    case "SESSION_NOT_FOUND":
    case "REPO_NOT_FOUND":
    case "WORKSPACE_NOT_FOUND":
      return 404;
    case "UNAUTHORIZED":
      return 401;
    case "RATE_LIMITED":
      return 429;
    case "SESSION_BUSY":
    case "ARCHIVE_REFUSED":
    case "REPO_ALREADY_EXISTS":
    case "WORKSPACE_ALREADY_EXISTS":
    case "WORKSPACE_NAME_CONFLICT":
      return 409;
    case "INVALID_REQUEST":
    case "INVALID_REPO_INPUT":
    case "INVALID_FLOCK_CONFIG":
      return 400;
    default:
      return 500;
  }
};

const toErrorResponse = (error: unknown): Response => {
  if (error instanceof FlockError) {
    return Response.json(error.toJSON(), {
      status: statusForErrorCode(error.code),
    });
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return Response.json(
    {
      code: "IO_ERROR",
      message,
    },
    { status: 500 },
  );
};

const parsePath = (pathname: string): string[] =>
  pathname.split("/").filter((segment) => segment.length > 0);

const handleApiRoute = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const path = parsePath(url.pathname);

  if (request.method === "GET" && url.pathname === "/health") {
    return handleHealthRoute();
  }

  if (url.pathname === "/repos") {
    if (request.method === "GET") {
      return await handleListReposRoute();
    }

    if (request.method === "POST") {
      return await handleCreateRepoRoute(request);
    }
  }

  if (path.length === 1 && path[0] === "sessions") {
    if (request.method === "GET") {
      return await handleListSessionsRoute(request);
    }

    if (request.method === "POST") {
      return await handleCreateSessionRoute(request);
    }
  }

  if (path.length === 2 && path[0] === "sessions") {
    const sessionId = decodeURIComponent(path[1] ?? "");
    if (request.method === "DELETE") {
      return await handleArchiveSessionRoute(request, sessionId);
    }
  }

  if (path.length === 3 && path[0] === "sessions") {
    const sessionId = decodeURIComponent(path[1] ?? "");
    const resource = path[2];

    if (resource === "messages") {
      if (request.method === "GET") {
        return await handleListMessagesRoute(request, sessionId);
      }

      if (request.method === "POST") {
        return await handleCreateMessageRoute(request, sessionId);
      }
    }

    if (resource === "cancel" && request.method === "POST") {
      return await handleCancelMessageRoute(sessionId);
    }
  }

  return Response.json(
    {
      code: "SESSION_NOT_FOUND",
      message: `Route not found: ${request.method} ${url.pathname}`,
    },
    { status: 404 },
  );
};

const handleRequest = async (context: RouteContext): Promise<Response> => {
  runMiddleware(context);
  return await handleApiRoute(context.request);
};

const main = async (): Promise<void> => {
  const config = await loadServerConfig();
  await initializeDatabase();

  const rateLimiter = new RateLimiter({
    maxRequests: 120,
    windowMs: 60_000,
  });

  setInterval(() => {
    rateLimiter.cleanup();
  }, 30_000).unref();

  Bun.serve({
    port: config.port,
    fetch: async (request, server) => {
      try {
        return await handleRequest({
          request,
          server,
          secret: config.secret,
          rateLimiter,
        });
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  });
};

void main().catch((error) => {
  if (error instanceof FlockError) {
    console.error(JSON.stringify(error.toJSON(), null, 2));
  } else if (error instanceof Error) {
    console.error(
      JSON.stringify(
        {
          code: "IO_ERROR",
          message: error.message,
        },
        null,
        2,
      ),
    );
  } else {
    console.error(
      JSON.stringify(
        {
          code: "IO_ERROR",
          message: "Unknown startup error",
          cause: error,
        },
        null,
        2,
      ),
    );
  }
  process.exitCode = 1;
});
