import { listReposWithOrigin } from "../../core/list.js";

export const handleReposRoute = async (): Promise<Response> => {
  const repos = await listReposWithOrigin();
  return Response.json({ repos });
};
