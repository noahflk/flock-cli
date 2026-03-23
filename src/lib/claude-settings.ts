import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_CLAUDE_ALLOW_PERMISSIONS = ["Edit", "Write", "Bash(*)"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMissingFileError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

export const buildClaudeSettings = (existing: unknown): Record<string, unknown> => {
  const current = isRecord(existing) ? existing : {};
  const currentPermissions = isRecord(current.permissions) ? current.permissions : {};
  const existingAllow = Array.isArray(currentPermissions.allow) ? [...currentPermissions.allow] : [];
  const nextAllow = [...existingAllow];

  for (const permission of REQUIRED_CLAUDE_ALLOW_PERMISSIONS) {
    if (!nextAllow.includes(permission)) {
      nextAllow.push(permission);
    }
  }

  return {
    ...current,
    skipDangerousModePermissionPrompt: true,
    permissions: {
      ...currentPermissions,
      allow: nextAllow,
    },
  };
};

export const syncClaudeSettingsFile = async (
  targetPath: string,
): Promise<"written" | "updated"> => {
  let existing: unknown = {};
  let exists = false;

  try {
    existing = JSON.parse(await readFile(targetPath, "utf8"));
    exists = true;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  const next = buildClaudeSettings(existing);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`);

  return exists ? "updated" : "written";
};

const syncClaudeSettingsFromEnv = async (): Promise<void> => {
  const targetPath = process.env.CLAUDE_SETTINGS_TARGET;

  if (!targetPath) {
    throw new Error("CLAUDE_SETTINGS_TARGET is required.");
  }

  try {
    const status = await syncClaudeSettingsFile(targetPath);
    const label = status === "written" ? "Config written to" : "Config updated at";
    console.log(`${label} ${targetPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Warning: skipped Claude settings sync at ${targetPath}: ${message}`);
  }
};

if (import.meta.main) {
  await syncClaudeSettingsFromEnv();
}
