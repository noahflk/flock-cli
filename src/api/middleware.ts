import { timingSafeEqual } from "node:crypto";
import { FlockError } from "../lib/types.js";

type RateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly counters = new Map<string, Counter>();

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  check(key: string): void {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.resetAt <= now) {
      this.counters.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return;
    }

    if (existing.count >= this.maxRequests) {
      throw new FlockError({
        code: "RATE_LIMITED",
        message: "Too many requests",
      });
    }

    existing.count += 1;
    this.counters.set(key, existing);
  }

  cleanup(): void {
    const now = Date.now();

    for (const [key, value] of this.counters.entries()) {
      if (value.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}

const getClientAddress = (request: Request, server: Bun.Server<unknown>): string => {
  const ip = server.requestIP(request);
  return ip?.address ?? "unknown";
};

const verifySecret = (request: Request, expectedSecret: string): void => {
  const provided = request.headers.get("x-flock-secret");
  if (!provided) {
    throw new FlockError({
      code: "UNAUTHORIZED",
      message: "Missing x-flock-secret header",
    });
  }

  const expectedBytes = Buffer.from(expectedSecret);
  const providedBytes = Buffer.from(provided);

  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    throw new FlockError({
      code: "UNAUTHORIZED",
      message: "Invalid secret",
    });
  }
};

export const runMiddleware = (input: {
  request: Request;
  server: Bun.Server<unknown>;
  secret: string;
  rateLimiter: RateLimiter;
}): void => {
  const key = getClientAddress(input.request, input.server);
  input.rateLimiter.check(key);
  verifySecret(input.request, input.secret);
};
