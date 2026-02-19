import { cloneGitHubRepoAtSlug, cloneRepoAtInput } from "../lib/git.js";
import type { CloneResult } from "../lib/types.js";

export const cloneRepo = async (repoInput: string): Promise<CloneResult> => {
  return await cloneRepoAtInput(repoInput);
};

export const cloneGitHubRepo = async (slug: string): Promise<CloneResult> => {
  return await cloneGitHubRepoAtSlug(slug);
};
