import { FlockError, type FlockErrorShape } from "../lib/types.js";

export const printResult = (result: unknown): void => {
  console.log(JSON.stringify(result, null, 2));
};

export const normalizeError = (error: unknown): FlockErrorShape => {
  if (error instanceof FlockError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      code: "IO_ERROR",
      message: error.message,
      cause: error.stack,
    };
  }

  return {
    code: "IO_ERROR",
    message: "Unknown error",
    cause: error,
  };
};
