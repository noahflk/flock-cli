import { requestWorkspacePR } from "../../core/pr.js";

export const handleCreateWorkspacePRRoute = async (
  _request: Request,
  repo: string,
  workspaceName: string,
): Promise<Response> => {
  const result = await requestWorkspacePR(repo, workspaceName);
  return Response.json(result, { status: 202 });
};
