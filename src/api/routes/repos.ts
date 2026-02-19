import { cloneGitHubRepo } from "../../core/clone.js";
import { listReposWithOrigin } from "../../core/list.js";
import { getRequiredString, parseJsonBody } from "./_shared.js";

export const handleListReposRoute = async (): Promise<Response> => {
  const repos = await listReposWithOrigin();
  return Response.json({ repos });
};

export const handleCreateRepoRoute = async (request: Request): Promise<Response> => {
  const body = await parseJsonBody(request);
  const slug = getRequiredString(body, "slug");
  const repo = await cloneGitHubRepo(slug);
  return Response.json(repo, { status: 201 });
};
