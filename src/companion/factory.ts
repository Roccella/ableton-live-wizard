import { WizardCompanionService } from "./types.js";
import { LocalWizardCompanionService } from "./local-service.js";
import { WizardDaemonClient } from "../daemon/client.js";

export const createCompanionService = (): WizardCompanionService => {
  if (process.env.WIZARD_TUI_LOCAL === "1") {
    return new LocalWizardCompanionService();
  }
  return new WizardDaemonClient();
};
