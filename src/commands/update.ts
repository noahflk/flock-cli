import { access } from "node:fs/promises";
import type { Command } from "commander";
import { updateFlock } from "../core/update.js";
import { runInteractiveProcess } from "../lib/process.js";

const SYSTEMD_DIR = "/run/systemd/system";
const FLOCK_SERVICE = "flock";

export const formatUpdateMessage = (updated: boolean, summary: string): string => {
  if (updated) {
    return `Flock updated successfully.\n${summary}`;
  }

  return "Flock is already up to date.";
};

const hasSystemd = async (): Promise<boolean> => {
  try {
    await access(SYSTEMD_DIR);
    return true;
  } catch {
    return false;
  }
};

export const registerUpdateCommand = (program: Command): void => {
  program
    .command("update")
    .description("Pull the latest version and reinstall dependencies")
    .action(async () => {
      const result = await updateFlock();

      console.log(formatUpdateMessage(result.updated, result.summary));

      if (!result.updated) {
        return;
      }

      if (!(await hasSystemd())) {
        console.log("Skipping service restart because systemd is not available on this machine.");
        return;
      }

      console.log(`Restarting ${FLOCK_SERVICE}.service...`);

      const exitCode = await runInteractiveProcess({
        command: "sudo",
        args: ["systemctl", "restart", FLOCK_SERVICE],
      });

      if (exitCode !== 0) {
        console.error(`Flock updated, but restarting ${FLOCK_SERVICE}.service failed.`);
        console.error(`Run \`sudo systemctl restart ${FLOCK_SERVICE}\` manually.`);
        process.exitCode = 1;
        return;
      }

      console.log(`${FLOCK_SERVICE}.service restarted.`);
    });
};
