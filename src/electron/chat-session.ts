import { WizardCompanionService } from "../companion/types.js";
import {
  matchPromptOptionFromInput,
  resolveGuidedIntent,
} from "./guided-intent-matcher.js";
import {
  applyChainChoice,
  applyContinuationStep,
  applyFoundationStep,
  chooseScope,
  chooseTonalContext,
  clearSessionForGuidedStart,
  createGuidedSessionState,
  getChainOptions,
  getChainOptionLabel,
  getGuidedBuildOptions,
  getGuidedLiveAwareness,
  getContinuationStepLabel,
  getFoundationStepLabel,
  getGenreLabel,
  getScopeChoices,
  getScopeLabel,
  getTonalContextChoices,
  GuidedChainId,
  GuidedContinuationId,
  GuidedFoundationId,
  GuidedGenreId,
  GuidedActionHooks,
  isGuidedChainId,
  isGuidedContinuationId,
  isGuidedFoundationId,
  GuidedScopeId,
  GuidedSessionState,
  markContinuationCompleted,
  markFoundationCompleted,
  mergeGuidedProgressFromState,
  selectChain,
} from "../workflows/guided-starter.js";
import { randomId } from "../util.js";
import {
  CompanionChatMessage,
  CompanionPromptOption,
  CompanionPromptReply,
  CompanionSessionSnapshot,
} from "./shared.js";

type GuidedMode = "prepare" | "scope" | "genre" | "tonal_context" | "build" | "chain" | "free";

type GuidedSnapshot = {
  guidedState: GuidedSessionState;
  mode: Exclude<GuidedMode, "free">;
};

type GuidedHistoryEntry = {
  snapshot: GuidedSnapshot;
  undoSteps: number;
};

const DEFAULT_INPUT_PLACEHOLDER = "Write a prompt. Enter sends. Shift+Enter adds a line break.";
const MAX_MESSAGES = 200;
const MAX_GUIDED_HISTORY = 20;

export class ElectronChatSession {
  private readonly service: WizardCompanionService;
  private readonly messages: CompanionChatMessage[] = [];
  private readonly guidedHistory: GuidedHistoryEntry[] = [];
  private guidedState: GuidedSessionState = createGuidedSessionState();
  private promptMessageId?: string;
  private promptOptions: CompanionPromptOption[] = [];
  private mode: GuidedMode = "prepare";
  private suppressPromptMessages = false;

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
      if (message.startsWith("Unknown prompt command:")) {
        const handled = await this.tryHandleGuidedNaturalInput(input);
        if (!handled) {
          this.pushMessage(
            "assistant",
            "I could not map that to a guided step yet. Use the visible suggestions or a supported command.",
          );
        }
      } else {
        this.pushMessage("system", `Prompt error: ${message}`);
      }
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
      if (reply.trim().length > 0) {
        this.pushMessage("assistant", reply);
      }
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
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.splice(0, this.messages.length - MAX_MESSAGES);
    }
  }

  private pushHistory(entry: GuidedHistoryEntry): void {
    this.guidedHistory.push(entry);
    if (this.guidedHistory.length > MAX_GUIDED_HISTORY) {
      this.guidedHistory.splice(0, this.guidedHistory.length - MAX_GUIDED_HISTORY);
    }
  }

  private async runGuidedActionWithUndoTracking(
    action: (hooks: GuidedActionHooks) => Promise<unknown>,
  ): Promise<number> {
    let undoSteps = 0;
    await action({
      recordMutation: () => {
        undoSteps += 1;
      },
    });
    return undoSteps;
  }

  private setPrompt(question: string, options: CompanionPromptOption[], mode: GuidedMode): void {
    if (!this.suppressPromptMessages) {
      const promptMessage: CompanionChatMessage = {
        id: randomId("prompt"),
        role: "assistant",
        text: question,
      };
      this.messages.push(promptMessage);
      this.promptMessageId = promptMessage.id;
    } else {
      this.promptMessageId = undefined;
    }
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

  private openScopeOptions(): void {
    this.setPrompt(
      "What are you trying to build?",
      [
        ...getScopeChoices().map((choice) => ({ id: `scope_${choice.id}`, label: choice.label, enabled: true })),
        { id: "back", label: "Back", enabled: true },
      ],
      "scope",
    );
  }

  private openGenreOptions(): void {
    const scopeId = this.guidedState.scope;
    if (!scopeId) {
      this.openScopeOptions();
      return;
    }

    this.setPrompt(
      `${getScopeLabel(scopeId)}: pick a genre.`,
      [
        { id: "genre_house", label: "House", enabled: true },
        { id: "genre_drum_n_bass", label: "Drum n bass", enabled: true },
        { id: "back", label: "Back", enabled: true },
      ],
      "genre",
    );
  }

  private openTonalContextOptions(): void {
    const genreId = this.guidedState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    this.setPrompt(
      `${getGenreLabel(genreId)}: pick a tonal context.`,
      [
        ...getTonalContextChoices(genreId).map((choice) => ({
          id: `tonal_${choice.id}`,
          label: choice.label,
          enabled: true,
        })),
        { id: "back", label: "Back", enabled: true },
      ],
      "tonal_context",
    );
  }

  private async openBuildOptions(): Promise<void> {
    const genreId = this.guidedState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    const state = await this.service.refreshState();
    const buildOptions = getGuidedBuildOptions(genreId, this.guidedState, state);
    const undoOption = this.guidedHistory.length > 0 ? [{ id: "guided_undo", label: "Undo", enabled: true }] : [];
    const scopeLabel = this.guidedState.scope ? getScopeLabel(this.guidedState.scope) : "Guided";

    this.setPrompt(
      `${getGenreLabel(genreId)} ${scopeLabel.toLowerCase()}: what should we build next?`,
      [
        ...buildOptions,
        ...undoOption,
        { id: "back", label: "Back", enabled: true },
      ],
      "build",
    );
  }

  private async openChainOptions(): Promise<void> {
    const genreId = this.guidedState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    const state = await this.service.refreshState();
    const awareness = getGuidedLiveAwareness(genreId, this.guidedState, state);
    const undoOption = this.guidedHistory.length > 0 ? [{ id: "guided_undo", label: "Undo", enabled: true }] : [];
    this.setPrompt(
      "Do you want to chain the scenes?",
      [
        ...getChainOptions(genreId).map((option) => ({
          id: `chain_${option.id}`,
          label: option.label,
          enabled: awareness.readyChainIds.includes(option.id),
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

  private async restoreGuidedSnapshot(snapshot: GuidedSnapshot): Promise<void> {
    this.guidedState = {
      ...snapshot.guidedState,
      completedFoundations: [...snapshot.guidedState.completedFoundations],
      completedContinuations: [...snapshot.guidedState.completedContinuations],
    };

    if (snapshot.mode === "prepare") {
      this.openPrepareOptions();
      return;
    }
    if (snapshot.mode === "scope") {
      this.openScopeOptions();
      return;
    }
    if (snapshot.mode === "genre") {
      this.openGenreOptions();
      return;
    }
    if (snapshot.mode === "tonal_context") {
      this.openTonalContextOptions();
      return;
    }
    if (snapshot.mode === "build") {
      await this.openBuildOptions();
      return;
    }
    await this.openChainOptions();
  }

  private async performGuidedUndo(): Promise<string> {
    const entry = this.guidedHistory.pop();
    if (!entry) {
      return "Nothing to undo.";
    }

    for (let index = 0; index < entry.undoSteps; index += 1) {
      await this.service.undoLast();
    }

    await this.restoreGuidedSnapshot(entry.snapshot);
    return "Last guided step undone.";
  }

  private getSyntheticPromptOption(optionId: string): CompanionPromptOption | undefined {
    if (optionId === "prepare_clear") {
      return { id: optionId, label: "Clear the current set", enabled: true };
    }
    if (optionId === "prepare_keep") {
      return { id: optionId, label: "Keep what is already in Live", enabled: true };
    }
    if (optionId.startsWith("scope_")) {
      const scopeId = optionId.replace("scope_", "") as GuidedScopeId;
      const choice = getScopeChoices().find((candidate) => candidate.id === scopeId);
      return choice ? { id: optionId, label: choice.label, enabled: true } : undefined;
    }
    if (optionId === "genre_house" || optionId === "genre_drum_n_bass") {
      const genreId: GuidedGenreId = optionId === "genre_house" ? "house" : "drum_n_bass";
      return { id: optionId, label: getGenreLabel(genreId), enabled: true };
    }
    if (optionId.startsWith("tonal_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        return undefined;
      }
      const tonalId = optionId.replace("tonal_", "");
      const choice = getTonalContextChoices(genreId).find((candidate) => candidate.id === tonalId);
      return choice ? { id: optionId, label: choice.label, enabled: true } : undefined;
    }
    if (optionId.startsWith("foundation_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        return undefined;
      }
      const stepId = optionId.replace("foundation_", "");
      if (!isGuidedFoundationId(stepId)) {
        return undefined;
      }
      return { id: optionId, label: getFoundationStepLabel(genreId, stepId), enabled: true };
    }
    if (optionId.startsWith("continuation_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        return undefined;
      }
      const stepId = optionId.replace("continuation_", "");
      if (!isGuidedContinuationId(stepId)) {
        return undefined;
      }
      return { id: optionId, label: getContinuationStepLabel(genreId, stepId), enabled: true };
    }
    if (optionId === "chain_prompt") {
      return { id: optionId, label: "Chain scenes", enabled: true };
    }
    if (optionId.startsWith("chain_")) {
      const genreId = this.guidedState.genre;
      if (!genreId) {
        return undefined;
      }
      const chainId = optionId.replace("chain_", "");
      if (!isGuidedChainId(chainId)) {
        return undefined;
      }
      return { id: optionId, label: getChainOptionLabel(genreId, chainId), enabled: true };
    }
    if (optionId === "back") {
      return { id: optionId, label: "Back", enabled: true };
    }
    if (optionId === "guided_undo") {
      return { id: optionId, label: "Undo", enabled: true };
    }
    return undefined;
  }

  private async reopenCurrentPrompt(): Promise<void> {
    if (this.mode === "prepare") {
      this.openPrepareOptions();
      return;
    }
    if (this.mode === "scope") {
      this.openScopeOptions();
      return;
    }
    if (this.mode === "genre") {
      this.openGenreOptions();
      return;
    }
    if (this.mode === "tonal_context") {
      this.openTonalContextOptions();
      return;
    }
    if (this.mode === "build") {
      await this.openBuildOptions();
      return;
    }
    if (this.mode === "chain") {
      await this.openChainOptions();
      return;
    }
    this.openFreeMode();
  }

  private buildGuidedOptionSequence(input: string): { optionIds: string[]; ambiguity?: string } | undefined {
    const directMatch = matchPromptOptionFromInput(input, this.promptOptions);
    if (directMatch) {
      return { optionIds: [directMatch.id] };
    }

    const resolution = resolveGuidedIntent(input, this.mode);
    if (!resolution) {
      return undefined;
    }

    if (resolution.ambiguity) {
      return { optionIds: [], ambiguity: resolution.ambiguity };
    }

    if (resolution.reopenSuggestions) {
      return { optionIds: [] };
    }

    if (resolution.goBack) {
      return this.promptOptions.some((option) => option.id === "back" && option.enabled)
        ? { optionIds: ["back"] }
        : { optionIds: [], ambiguity: "There is no previous guided step to go back to right now." };
    }

    const optionIds: string[] = [];
    let scope = this.guidedState.scope;
    let genre = this.guidedState.genre;

    const hasLaterTarget = Boolean(
      resolution.scope ||
      resolution.genre ||
      resolution.tonalContext ||
      resolution.foundationStep ||
      resolution.continuationStep ||
      resolution.chainPrompt ||
      resolution.chainChoice,
    );

    if (resolution.prepareChoice === "clear") {
      optionIds.push("prepare_clear");
      scope = undefined;
      genre = undefined;
    } else if (resolution.prepareChoice === "keep") {
      optionIds.push("prepare_keep");
      scope = undefined;
      genre = undefined;
    } else if (this.mode === "prepare" && hasLaterTarget) {
      optionIds.push("prepare_keep");
      scope = undefined;
      genre = undefined;
    }

    if (resolution.scope && resolution.scope !== scope) {
      optionIds.push(`scope_${resolution.scope}`);
      scope = resolution.scope;
    }

    if (resolution.genre) {
      if (!scope) {
        return optionIds.length > 0
          ? { optionIds }
          : { optionIds: [], ambiguity: "I matched a genre, but I still need the scope first." };
      }
      if (resolution.genre !== genre) {
        optionIds.push(`genre_${resolution.genre === "house" ? "house" : "drum_n_bass"}`);
        genre = resolution.genre;
      }
    }

    if (resolution.tonalContext) {
      if (!genre) {
        return optionIds.length > 0
          ? { optionIds }
          : { optionIds: [], ambiguity: "I matched a tonal context, but I still need the genre first." };
      }
      optionIds.push(`tonal_${resolution.tonalContext.scaleMode}_${resolution.tonalContext.key}`);
    }

    if (resolution.foundationStep) {
      if (!genre) {
        return optionIds.length > 0
          ? { optionIds }
          : { optionIds: [], ambiguity: "I matched a build step, but the guided setup is still missing genre and tonal context." };
      }
      optionIds.push(`foundation_${resolution.foundationStep}`);
    }

    if (resolution.continuationStep) {
      if (!genre) {
        return optionIds.length > 0
          ? { optionIds }
          : { optionIds: [], ambiguity: "I matched a continuation step, but the guided setup is still missing genre and tonal context." };
      }
      optionIds.push(`continuation_${resolution.continuationStep}`);
    }

    if (resolution.chainPrompt) {
      optionIds.push("chain_prompt");
    }

    if (resolution.chainChoice) {
      if (this.mode !== "chain" && !optionIds.includes("chain_prompt")) {
        optionIds.push("chain_prompt");
      }
      optionIds.push(`chain_${resolution.chainChoice}`);
    }

    return { optionIds };
  }

  private async executeGuidedOptionById(optionId: string): Promise<string> {
    const currentOption = this.promptOptions.find((option) => option.id === optionId);
    if (currentOption && !currentOption.enabled) {
      return `${currentOption.label} is disabled for now.`;
    }

    const option = currentOption ?? this.getSyntheticPromptOption(optionId);
    if (!option) {
      throw new Error(`Unknown guided option: ${optionId}`);
    }

    return this.handleGuidedOption(option);
  }

  private async tryHandleGuidedNaturalInput(input: string): Promise<boolean> {
    const sequence = this.buildGuidedOptionSequence(input);
    if (!sequence) {
      return false;
    }

    if (sequence.ambiguity) {
      this.pushMessage("assistant", sequence.ambiguity);
      return true;
    }

    if (sequence.optionIds.length === 0) {
      this.guidedState = createGuidedSessionState();
      this.guidedHistory.length = 0;
      this.openPrepareOptions();
      this.pushMessage("assistant", "Guided starters reopened.");
      return true;
    }

    const responses: string[] = [];
    const previousSuppressSetting = this.suppressPromptMessages;
    this.suppressPromptMessages = true;

    try {
      for (const optionId of sequence.optionIds) {
        responses.push(await this.executeGuidedOptionById(optionId));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pushMessage("system", `Guided action failed: ${message}`);
      return true;
    } finally {
      this.suppressPromptMessages = previousSuppressSetting;
    }

    const summary = responses.filter((response) => response.trim().length > 0).join(" ");
    if (summary) {
      this.pushMessage("assistant", summary);
    }
    await this.reopenCurrentPrompt();
    return true;
  }

  private async handleGuidedOption(option: CompanionPromptOption): Promise<string> {
    if (option.id === "prepare_clear") {
      const snapshot = this.captureGuidedSnapshot("prepare");
      this.guidedState = createGuidedSessionState();
      const undoSteps = await this.runGuidedActionWithUndoTracking((hooks) =>
        clearSessionForGuidedStart(this.service, hooks),
      );
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
      this.openScopeOptions();
      return "Cleared the current set.";
    }

    if (option.id === "prepare_keep") {
      this.guidedState = createGuidedSessionState();
      this.openScopeOptions();
      return "";
    }

    if (option.id.startsWith("scope_")) {
      const scopeId = option.id.replace("scope_", "") as GuidedScopeId;
      const choice = getScopeChoices().find((candidate) => candidate.id === scopeId);
      if (!choice) {
        return "Unknown scope.";
      }
      this.guidedState = chooseScope(this.guidedState, scopeId);
      this.openGenreOptions();
      return "";
    }

    if (option.id === "genre_house" || option.id === "genre_drum_n_bass") {
      const genreId: GuidedGenreId = option.id === "genre_house" ? "house" : "drum_n_bass";
      this.guidedState = {
        ...this.guidedState,
        genre: genreId,
        scaleMode: undefined,
        key: undefined,
      };
      this.openTonalContextOptions();
      return "";
    }

    if (option.id.startsWith("tonal_")) {
      const tonalId = option.id.replace("tonal_", "");
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const choice = getTonalContextChoices(genreId).find((candidate) => candidate.id === tonalId);
      if (!choice) {
        return "Unknown tonal context.";
      }
      this.guidedState = chooseTonalContext(this.guidedState, choice.key, choice.scaleMode);
      await this.openBuildOptions();
      return "";
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
      const liveState = await this.service.refreshState();
      const effectiveState = mergeGuidedProgressFromState(genreId, this.guidedState, liveState);
      const undoSteps = await this.runGuidedActionWithUndoTracking((hooks) =>
        applyFoundationStep(this.service, genreId, effectiveState, stepId, hooks),
      );
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
      this.guidedState = markFoundationCompleted(this.guidedState, stepId);
      await this.openBuildOptions();
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
      const liveState = await this.service.refreshState();
      const effectiveState = mergeGuidedProgressFromState(genreId, this.guidedState, liveState);
      const undoSteps = await this.runGuidedActionWithUndoTracking((hooks) =>
        applyContinuationStep(this.service, genreId, effectiveState, stepId, hooks),
      );
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
      this.guidedState = markContinuationCompleted(this.guidedState, stepId);
      await this.openBuildOptions();
      return `${option.label} done.`;
    }

    if (option.id === "chain_prompt") {
      await this.openChainOptions();
      return "";
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
      let chainMessages: string[] = [];
      const undoSteps = await this.runGuidedActionWithUndoTracking((hooks) =>
        applyChainChoice(this.service, genreId, chainId, hooks).then((messages) => {
          chainMessages = messages;
          return messages;
        }),
      );
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
      this.guidedState = selectChain(this.guidedState, chainId);
      this.openFreeMode();
      return chainMessages.join(" ");
    }

    if (option.id === "back") {
      if (this.mode === "scope") {
        this.openPrepareOptions();
        return "";
      }
      if (this.mode === "genre") {
        this.openScopeOptions();
        return "";
      }
      if (this.mode === "tonal_context") {
        this.openGenreOptions();
        return "";
      }
      if (this.mode === "build") {
        this.openTonalContextOptions();
        return "";
      }
      if (this.mode === "chain") {
        await this.openBuildOptions();
        return "";
      }
    }

    return `${option.label} is not implemented yet.`;
  }
}
