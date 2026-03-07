import { ensureWizardDaemon } from "./daemon/bootstrap.js";

process.env.TERM = process.env.WIZARD_TUI_TERM ?? "xterm";

const { WizardTuiApp } = await import("./tui/app.js");

const daemonCleanup = await ensureWizardDaemon();
const app = new WizardTuiApp();

try {
  await app.start();
} finally {
  daemonCleanup?.();
}
