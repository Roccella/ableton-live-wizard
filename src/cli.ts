process.env.TERM = process.env.WIZARD_TUI_TERM ?? "xterm";

const { WizardTuiApp } = await import("./tui/app.js");

const app = new WizardTuiApp();

await app.start();
