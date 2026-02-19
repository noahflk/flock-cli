import {
  cancelSessionMessage,
  dispatchSessionMessage,
  listSessionMessages,
} from "../../core/message.js";
import { getPositiveInteger, getRequiredString, parseJsonBody } from "./_shared.js";

export const handleListMessagesRoute = async (
  request: Request,
  sessionId: string,
): Promise<Response> => {
  const url = new URL(request.url);
  const limit = getPositiveInteger(url.searchParams.get("limit"), 50);
  const offset = getPositiveInteger(url.searchParams.get("offset"), 0);
  const result = await listSessionMessages(sessionId, limit, offset);
  return Response.json(result);
};

export const handleCreateMessageRoute = async (
  request: Request,
  sessionId: string,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const content = getRequiredString(body, "content");
  const result = await dispatchSessionMessage(sessionId, content);
  return Response.json(result, { status: 202 });
};

export const handleCancelMessageRoute = async (sessionId: string): Promise<Response> => {
  const result = await cancelSessionMessage(sessionId);
  return Response.json(result);
};
