import { FlockError } from "../../lib/types.js";

const throwRequestError = (message: string): never => {
  throw new FlockError({
    code: "INVALID_REQUEST",
    message,
  });
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throwRequestError("Expected a JSON object");
  }

  return value as Record<string, unknown>;
};

export const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const raw = await request.text();
  if (raw.trim().length === 0) {
    throwRequestError("Request body cannot be empty");
  }

  try {
    const parsed = JSON.parse(raw);
    return asObject(parsed);
  } catch (error) {
    if (error instanceof FlockError) {
      throw error;
    }

    return throwRequestError("Invalid JSON body");
  }
};

export const getRequiredString = (
  input: Record<string, unknown>,
  key: string,
): string => {
  const value = input[key];
  if (typeof value !== "string") {
    throwRequestError(`Field "${key}" must be a non-empty string`);
  }

  const trimmed = (value as string).trim();
  if (trimmed.length === 0) {
    throwRequestError(`Field "${key}" must be a non-empty string`);
  }

  return trimmed;
};

export const getOptionalBoolean = (
  value: string | null,
  fallback = false,
): boolean => {
  if (value === null) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return throwRequestError("Expected boolean query parameter");
};

export const getPositiveInteger = (
  value: string | null,
  fallback: number,
): number => {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throwRequestError("Expected a non-negative integer query parameter");
  }

  return parsed;
};
