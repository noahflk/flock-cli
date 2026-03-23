const COMMAND_PATH_CONFIG_KEYS = {
  claude: "claudePath",
  codex: "codexPath",
  gh: "ghPath",
} as const;

const COMMAND_PATH_ENV_VARS = {
  claudePath: "FLOCK_CLAUDE_PATH",
  codexPath: "FLOCK_CODEX_PATH",
  ghPath: "FLOCK_GH_PATH",
} as const;

export type ConfigurableCommand = keyof typeof COMMAND_PATH_CONFIG_KEYS;
export type CommandPathConfigKey = keyof typeof COMMAND_PATH_ENV_VARS;

export type CommandPathOverrides = Partial<Record<CommandPathConfigKey, string>>;

const isAbsoluteOrRelativePath = (command: string): boolean => {
  return command.includes("/") || command.includes("\\");
};

export const resolveConfiguredCommand = (
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string => {
  if (isAbsoluteOrRelativePath(command)) {
    return command;
  }

  const configKey = COMMAND_PATH_CONFIG_KEYS[command as ConfigurableCommand];
  const envVar = configKey ? COMMAND_PATH_ENV_VARS[configKey] : undefined;

  if (!envVar) {
    return command;
  }

  const configuredPath = env[envVar]?.trim();
  return configuredPath && configuredPath.length > 0 ? configuredPath : command;
};

export const applyCommandPathOverrides = (
  overrides: CommandPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  for (const configKey of Object.keys(COMMAND_PATH_ENV_VARS) as CommandPathConfigKey[]) {
    const override = overrides[configKey]?.trim();
    const envVar = COMMAND_PATH_ENV_VARS[configKey];

    if (override && override.length > 0) {
      env[envVar] = override;
    }
  }
};
