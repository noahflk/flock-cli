import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  buildClaudeSettings,
  REQUIRED_CLAUDE_ALLOW_PERMISSIONS,
  syncClaudeSettingsFile,
} from "../../src/lib/claude-settings.ts";

const cleanupTargets: string[] = [];

const makeTempDir = async (label: string): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), `${label}-`));
  cleanupTargets.push(dir);
  return dir;
};

afterEach(async () => {
  while (cleanupTargets.length > 0) {
    const target = cleanupTargets.pop();
    if (!target) {
      continue;
    }

    await rm(target, { recursive: true, force: true });
  }
});

describe("buildClaudeSettings", () => {
  it("preserves existing config while appending required allow permissions", () => {
    const settings = buildClaudeSettings({
      theme: "dark",
      permissions: {
        deny: ["Read"],
        allow: ["Read", "Write"],
      },
    });

    expect(settings).toEqual({
      theme: "dark",
      skipDangerousModePermissionPrompt: true,
      permissions: {
        deny: ["Read"],
        allow: ["Read", "Write", "Edit", "Bash(*)"],
      },
    });
  });
});

describe("syncClaudeSettingsFile", () => {
  it("creates a new settings file with the required permissions", async () => {
    const rootDir = await makeTempDir("claude-settings-create");
    const settingsPath = path.join(rootDir, ".claude", "settings.json");

    const status = await syncClaudeSettingsFile(settingsPath);

    expect(status).toBe("written");
    expect(JSON.parse(await readFile(settingsPath, "utf8"))).toEqual({
      skipDangerousModePermissionPrompt: true,
      permissions: {
        allow: [...REQUIRED_CLAUDE_ALLOW_PERMISSIONS],
      },
    });
  });

  it("updates an existing settings file without dropping unrelated keys", async () => {
    const rootDir = await makeTempDir("claude-settings-update");
    const settingsPath = path.join(rootDir, ".claude", "settings.json");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(
      settingsPath,
      JSON.stringify({
        nested: {
          enabled: true,
        },
        permissions: {
          deny: ["Read"],
          allow: ["Edit"],
        },
      }),
    );

    const status = await syncClaudeSettingsFile(settingsPath);

    expect(status).toBe("updated");
    expect(JSON.parse(await readFile(settingsPath, "utf8"))).toEqual({
      nested: {
        enabled: true,
      },
      skipDangerousModePermissionPrompt: true,
      permissions: {
        deny: ["Read"],
        allow: [...REQUIRED_CLAUDE_ALLOW_PERMISSIONS],
      },
    });
  });

  it("throws when an existing settings file is invalid JSON", async () => {
    const rootDir = await makeTempDir("claude-settings-invalid");
    const settingsPath = path.join(rootDir, ".claude", "settings.json");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, "{not-json");

    await expect(syncClaudeSettingsFile(settingsPath)).rejects.toThrow();
    expect(await readFile(settingsPath, "utf8")).toBe("{not-json");
  });
});
