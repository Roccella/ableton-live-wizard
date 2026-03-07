import { WizardCompanionService } from "../companion/types.js";
import {
  applyChainChoice,
  applyContinuationStep,
  applyFoundationStep,
  chooseKey,
  chooseScaleMode,
  clearSessionForGuidedStart,
  createGuidedSessionState,
  getAvailableContinuationSteps,
  getAvailableFoundationSteps,
  getChainOptions,
  getGenreLabel,
  getKeyChoices,
  getScaleChoices,
  GuidedChainId,
  GuidedContinuationId,
  GuidedFoundationId,
  GuidedGenreId,
  isGuidedChainId,
  isGuidedContinuationId,
  isGuidedFoundationId,
  GuidedScaleMode,
  GuidedSessionState,
  markContinuationCompleted,
  markFoundationCompleted,
  selectChain,
} from "../workflows/guided-starter.js";
import { randomId } from "../util.js";
import {
  CompanionChatMessage,
  CompanionPromptOption,
  CompanionPromptReply,
  CompanionSessionSnapshot,
} from "./shared.js";

type GuidedMode = "prepare" | "genre" | "scale_mode" | "key" | "build" | "chain" | "free";

type GuidedSnapshot = {
  guidedState: GuidedSessionState;
  mode: Exclude<GuidedMode, "free">;
};

type GuidedHistoryEntry = {
  snapshot: GuidedSnapshot;
  undoSteps: number;
};

const DEFAULT_INPUT_PLACEHOLDER = "Write a prompt. Enter sends. Shift+Enter adds a line break.";

export class ElectronChatSession {
  private readonly service: WizardCompanionService;
  private readonly messages: CompanionChatMessage[] = [];
  private readonly guidedHistory: GuidedHistoryEntry[] = [];
  private guidedState: GuidedSessionState = createGuidedSessionState();
  private promptMessageId?: string;
  private promptOptions: CompanionPromptOption[] = [];
  private mode: GuidedMode = "prepare";

  constructor(service: WizardCompanionService) {
    this.service = service;
  }

  async bootstrap(connection: string): Promise<CompanionSessionSnapshot> {
    if (this.messages.length === 0) {
      this.openPrepareOptions();
    }
    return this.snapshot(connection);
  }

  async submitFreeform(rawInput: string, connection: string): Promise<CompanionPromptReply> {
    const input = rawInput.trim();
    if (!input) {
      return this.snapshot(connection);
    }

    this.pushMessage("user", input);

    const normalized = input.toLowerCase();
    if (normalized === "suggest") {
      this.guidedState = createGuidedSessionState();
      this.guidedHistory.length = 0;
      this.openPrepareOptions();
      this.pushMessage("assistant", "Guided starters reopened.");
      return this.snapshot(connection);
    }

    if (normalized === "go back") {
      const back = this.promptOptions.find((option) => option.id === "back" && option.enabled);
      if (back) {
        return this.chooseOption(back.id, connection, false);
      }
    }

    try {
      const reply = await this.service.submitPrompt(input, {});
      this.pushMessage("assistant", reply.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pushMessage("system", `Prompt error: ${message}`);
    }

    return this.snapshot(connection);
  }

  async chooseOption(optionId: string, connection: string, echoUserChoice = true): Promise<CompanionPromptReply> {
    const option = this.promptOptions.find((candidate) => candidate.id === optionId);
    if (!option) {
      this.pushMessage("system", `Unknown option: ${optionId}`);
      return this.snapshot(connection);
    }

    if (!option.enabled) {
      this.pushMessage("system", `${option.label} is disabled for now.`);
      return this.snapshot(connection);
    }

    if (echoUserChoice) {
      this.pushMessage("user", option.label);
    }

    try {
      const reply = await this.handleGuidedOption(option);
      this.pushMessage("assistant", reply);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pushMessage("system", `Guided action failed: ${message}`);
    }

    return this.snapshot(connection);
  }

  private snapshot(connection: string): CompanionSessionSnapshot {
    return {
      connection,
      messages: [...this.messages],
      promptState: {
        messageId: this.promptMessageId,
        options: this.promptOptions.map((option) => ({ ...option })),
      },
      inputPlaceholder: DEFAULT_INPUT_PLACEHOLDER,
    };
  }

  private pushMessage(role: CompanionChatMessage["role"], text: string): void {
    this.messages.push({
      id: randomId("chat"),
      role,
      text,
    });
  }

  private setPrompt(question: string, options: CompanionPromptOption[], mode: GuidedMode): void {
    const promptMessage: CompanionChatMessage = {
      id: randomId("prompt"),
      role: "assistant",
      text: question,
    };

    this.messages.push(promptMessage);
    this.promptMessageId = promptMessage.id;
    this.promptOptions = options;
    this.mode = mode;
  }

  private openPrepareOptions(): void {
    this.setPrompt(
      "How do you want to start?",
      [
        { id: "prepare_clear", label: "Clear the current set", enabled: true },
        { id: "prepare_keep", label: "Keep what is already in Live", enabled: true },
      ],
      "prepare",
    );
  }

  private openGenreOptions(): void {
    this.setPrompt(
      "Pick a genre.",
      [
        { id: "genre_house", label: "House", enabled: true },
        { id: "genre_drum_n_bass", label: "Drum n bass", enabled: true },
        { id: "back", label: "Back", enabled: true },
      ],
      "genre",
    );
  }

  private openScaleModeOptions(): void {
    const genreId = this.guidedState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    this.setPrompt(
      `${getGenreLabel(genreId)}: pick a scale.`,
      [
        ...getScaleChoices().map((choice) => ({ id: `scale_${choice.id}`, label: choice.label, enabled: true })),
        { id: "back", label: "Back", enabled: true },
      ],
      "scale_mode",
    );
  }

  private openKeyOptions(): void {
    const genreId = this.guidedState.genre;
    const scaleMode = this.guidedState.scaleMode;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }
    if (!scaleMode) {
      this.openScaleModeOptions();
      return;
    }

    this.setPrompt(
      `${getGenreLabel(genreId)} ${scaleMode}: pick a key.`,
      [
        ...getKeyChoices(genreId, scaleMode).map((choice) => ({
          id: `key_${choice.id}`,
          label: choice.label,
          enabled: true,
        })),
        { id: "back", label: "Back", enabled: true },
      ],
      "key",
    );
  }

  private openBuildOptions(): void {
    const genreId = this.guidedState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    const foundationOptions = getAvailableFoundationSteps(genreId, this.guidedState).map((step) => ({
      id: `foundation_${step.id}`,
      label: step.label,
      enabled: true,
    }));
    const continuationOptions = getAvailableContinuationSteps(genreId, this.guidedState).map((step) => ({
      id: `continuation_${step.id}`,
      label: step.label,
      enabled: true,
    }));
    const chainOption =
      this.guidedState.completedContinuations.length > 0
        ? [{ id: "chain_prompt", label: "Chain scenes", enabled: true }]
        : [];
    const undoOption = this.guidedHistory.length > 0 ? [{ id: "guided_undo", label: "Undo", enabled: true }] : [];

    this.setPrompt(
      `${getGenreLabel(genreId)}: what should we build next?`,
      [
        ...foundationOptions,
        ...continuationOptions,
        ...chainOption,
        ...undoOption,
        { id: "back", label: "Back", enabled: true },
      ],
      "build",
    );
  }

  private openChainOptions(): void {
    const genreId = this.guidedState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    const undoOption = this.guidedHistory.length > 0 ? [{ id: "guided_undo", label: "Undo", enabled: true }] : [];
    this.setPrompt(
      "Do you want to chain the scenes?",
      [
        ...getChainOptions(genreId).map((option) => ({
          id: `chain_${option.id}`,
          label: option.label,
          enabled: true,
        })),
        ...undoOption,
        { id: "back", label: "Back", enabled: true },
      ],
      "chain",
    );
  }

  private openFreeMode(): void {
    this.setPrompt("Write what you want next.", [], "free");
  }

  private captureGuidedSnapshot(mode: Exclude<GuidedMode, "free">): GuidedSnapshot {
    return {
      guidedState: {
        ...this.guidedState,
        completedFoundations: [...this.guidedState.completedFoundations],
        completedContinuations: [...this.guidedState.completedContinuations],
      },
      mode,
    };
  }

  private restoreGuidedSnapshot(snapshot: GuidedSnapshot): void {
    this.guidedState = {
      ...snapshot.guidedState,
      completedFoundations: [...snapshot.guidedState.completedFoundations],
      completedContinuations: [...snapshot.guidedState.completedContinuations],
    };

    if (snapshot.mode === "prepare") {
      this.openPrepareOptions();
      return;
    }
    if (snapshot.mode === "genre") {
      this.openGenreOptions();
      return;
    }
    if (snapshot.mode === "scale_mode") {
      this.openScaleModeOptions();
      return;
    }
    if (snapshot.mode === "key") {
      this.openKeyOptions();
      return;
    }
    if (snapshot.mode === "build") {
      this.openBuildOptions();
      return;
    }
    this.openChainOptions();
  }

  private async performGuidedUndo(): Promise<string> {
    const entry = this.guidedHistory.pop();
    if (!entry) {
      return "Nothing to undo.";
    }

    for (let index = 0; index < entry.undoSteps; index += 1) {
      await this.service.undoLast();
    }

    this.restoreGuidedSnapshot(entry.snapshot);
    return "Last guided step undone.";
  }

  private async handleGuidedOption(option: CompanionPromptOption): Promise<string> {
    if (option.id === "prepare_clear") {
      const snapshot = this.captureGuidedSnapshot("prepare");
      this.guidedState = createGuidedSessionState();
      await clearSessionForGuidedStart(this.service);
      this.guidedHistory.push({ snapshot, undoSteps: 1 });
      this.openGenreOptions();
      return "Cleared the current set.";
    }

    if (option.id === "prepare_keep") {
      this.guidedState = createGuidedSessionState();
      this.openGenreOptions();
      return "Keeping the current set.";
    }

    if (option.id === "genre_house" || option.id === "genre_drum_n_bass") {
      const genreId: GuidedGenreId = option.id === "genre_house" ? "house" : "drum_n_bass";
      this.guidedState = {
        ...this.guidedState,
        genre: genreId,
      };
      this.openScaleModeOptions();
      return `${getGenreLabel(genreId)} selected.`;
    }

    if (option.id === "scale_minor" || option.id === "scale_major") {
      const scaleMode: GuidedScaleMode = option.id === "scale_minor" ? "minor" : "major";
      this.guidedState = chooseScaleMode(this.guidedState, scaleMode);
      this.openKeyOptions();
      return `${scaleMode === "minor" ? "Minor" : "Major"} selected.`;
    }

    if (option.id.startsWith("key_")) {
      const key = option.id.replace("key_", "");
      this.guidedState = chooseKey(this.guidedState, key);
      this.openBuildOptions();
      return `Key ${key} selected.`;
    }

    if (option.id === "guided_undo") {
      return this.performGuidedUndo();
    }

    if (option.id.startsWith("foundation_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const stepId = option.id.replace("foundation_", "");
      if (!isGuidedFoundationId(stepId)) return "Unknown foundation step.";
      const snapshot = this.captureGuidedSnapshot("build");
      await applyFoundationStep(this.service, genreId, this.guidedState, stepId);
      this.guidedHistory.push({ snapshot, undoSteps: 1 });
      this.guidedState = markFoundationCompleted(this.guidedState, stepId);
      this.openBuildOptions();
      return `${option.label} done.`;
    }

    if (option.id.startsWith("continuation_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const stepId = option.id.replace("continuation_", "");
      if (!isGuidedContinuationId(stepId)) return "Unknown continuation step.";
      const snapshot = this.captureGuidedSnapshot("build");
      await applyContinuationStep(this.service, genreId, this.guidedState, stepId);
      this.guidedHistory.push({ snapshot, undoSteps: 1 });
      this.guidedState = markContinuationCompleted(this.guidedState, stepId);
      this.openBuildOptions();
      return `${option.label} done.`;
    }

    if (option.id === "chain_prompt") {
      this.openChainOptions();
      return "Pick a fixed chain.";
    }

    if (option.id.startsWith("chain_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const chainId = option.id.replace("chain_", "");
      if (!isGuidedChainId(chainId)) return "Unknown chain.";
      const snapshot = this.captureGuidedSnapshot("chain");
      await applyChainChoice(this.service, genreId, chainId);
      this.guidedHistory.push({ snapshot, undoSteps: 1 });
      this.guidedState = selectChain(this.guidedState, chainId);
      this.openFreeMode();
      return `${option.label} selected.`;
    }

    if (option.id === "back") {
      if (this.mode === "genre") {
        this.openPrepareOptions();
        return "Back to set preparation.";
      }
      if (this.mode === "scale_mode") {
        this.openGenreOptions();
        return "Back to genre selection.";
      }
      if (this.mode === "key") {
        this.openScaleModeOptions();
        return "Back to scale selection.";
      }
      if (this.mode === "build") {
        this.openKeyOptions();
        return "Back to key selection.";
      }
      if (this.mode === "chain") {
        this.openBuildOptions();
        return "Back to build options.";
      }
    }

    return `${option.label} is not implemented yet.`;
  }
}
