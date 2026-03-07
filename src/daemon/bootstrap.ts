import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const defaultDaemonUrl =
  process.env.WIZARD_DAEMON_URL ??
  process.env.ABLETON_BRIDGE_URL ??
  "http://127.0.0.1:8765";

const pingDaemon = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${defaultDaemonUrl.replace(/\/+$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

const daemonEntryPath = (): string => {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return fileURLToPath(new URL(`./main.${extension}`, import.meta.url));
};

const waitForDaemon = async (timeoutMs = 5000): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pingDaemon()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`wizard-daemon did not become healthy within ${timeoutMs}ms`);
};

export const ensureWizardDaemon = async (): Promise<(() => void) | undefined> => {
  if (process.env.WIZARD_TUI_LOCAL === "1") {
    return undefined;
  }

  if (await pingDaemon()) {
    return undefined;
  }

  const logsDir = path.resolve(process.cwd(), "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const daemonLogPath = path.join(logsDir, "wizard-daemon.log");
  const daemonLogFd = fs.openSync(daemonLogPath, "a");

  const child = spawn(process.execPath, [...process.execArgv, daemonEntryPath()], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", daemonLogFd, daemonLogFd],
  });

  const cleanup = (): void => {
    if (!child.killed) {
      child.kill();
    }
    try {
      fs.closeSync(daemonLogFd);
    } catch {
      // Cleanup only.
    }
  };

  process.once("exit", cleanup);

  try {
    await waitForDaemon();
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
};
