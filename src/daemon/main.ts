import { WizardDaemonServer } from "./server.js";

const server = new WizardDaemonServer();

await server.start();
console.log(`wizard-daemon listening on http://127.0.0.1:${process.env.WIZARD_DAEMON_PORT ?? "8765"}`);
