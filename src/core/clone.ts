import { cloneRepoAtInput } from "../lib/git.js";
import type { CloneResult } from "../lib/types.js";

export const cloneRepo = async (repoInput: string): Promise<CloneResult> => {
  return await cloneRepoAtInput(repoInput);
};
