import { PromptContext, WizardCompanionService } from "../companion/types.js";
import {
  matchPromptOptionFromInput,
  resolveGuidedIntent,
} from "./guided-intent-matcher.js";
import {
  clearSessionForGuidedStart,
  ensureGenreTempo,
  ensureSceneClip,
  ensureScene,
  ensureTrack,
  getGenreLabel,
  getTonalContextChoices,
  GuidedGenreId,
  GuidedActionHooks,
  GuidedScaleMode,
  applyVariationToNotes,
} from "../workflows/guided-starter.js";
import {
  SceneWorkflowState,
  createSceneWorkflowState,
  getTrackCatalog,
  getTrackCatalogEntry,
  getAvailableTrackIds,
  addScene,
  addTrackToState,
  setTrackVariationInScene,
  getVariationSuggestionForScene,
  formatVariationSuggestion,
  getGenreTempo as getSceneGenreTempo,
  importFromLiveState,
  ImportResult,
} from "../workflows/scene-workflow.js";
import {
  SceneRoleId,
  TrackVariation,
  isSceneRoleId,
  getSceneRoleLabel,
  SCENE_ROLE_IDS,
} from "../workflows/scene-roles.js";
import { randomId } from "../util.js";
import {
  CompanionChatMessage,
  CompanionPromptOption,
  CompanionPromptReply,
  CompanionSessionSnapshot,
} from "./shared.js";

type GuidedMode =
  | "prepare"
  | "genre"
  | "tonal_context"
  | "import_preview"
  | "seed_scene"
  | "scene_hub"
  | "add_track"
  | "new_scene"
  | "confirm_variation"
  | "track_scenes"
  | "free";

type GuidedSnapshot = {
  workflowState: SceneWorkflowState;
  mode: Exclude<GuidedMode, "free">;
  pendingTrackId?: string;
  pendingRole?: SceneRoleId;
  pendingSceneQuestions?: PendingSceneQuestion[];
  pendingImportResult?: ImportResult;
};

type GuidedHistoryEntry = {
  snapshot: GuidedSnapshot;
  undoSteps: number;
};

type PendingSceneQuestion = {
  sceneIndex: number;
  sceneName: string;
  trackId: string;
};

const DEFAULT_INPUT_PLACEHOLDER = "Write a prompt. Enter sends. Shift+Enter adds a line break.";
const MAX_MESSAGES = 200;
const MAX_GUIDED_HISTORY = 20;

export class ElectronChatSession {
  private readonly service: WizardCompanionService;
  private readonly messages: CompanionChatMessage[] = [];
  private readonly guidedHistory: GuidedHistoryEntry[] = [];
  private workflowState: SceneWorkflowState = createSceneWorkflowState();
  private promptMessageId?: string;
  private promptOptions: CompanionPromptOption[] = [];
  private mode: GuidedMode = "prepare";
  private suppressPromptMessages = false;
  private pendingTrackId?: string;
  private pendingRole?: SceneRoleId;
  private pendingSceneQuestions: PendingSceneQuestion[] = [];
  private pendingImportResult?: ImportResult;

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
    if (!input) return this.snapshot(connection);

    this.pushMessage("user", input);

    const normalized = input.toLowerCase();
    if (normalized === "suggest") {
      this.workflowState = createSceneWorkflowState();
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
      const reply = await this.service.submitPrompt(input, await this.resolvePromptContext());
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

  private async resolvePromptContext(): Promise<PromptContext> {
    try {
      const state = await this.service.getState(true);
      return {
        selectedTrackId: state.selectedTrackId,
        selectedSceneId: state.selectedSceneId,
        selectedClipId: state.selectedClipId,
      };
    } catch {
      return {};
    }
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
    this.messages.push({ id: randomId("chat"), role, text });
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
      recordMutation: () => { undoSteps += 1; },
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

  // --- Mode openers ---

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

  private openTonalContextOptions(): void {
    const genreId = this.workflowState.genre;
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

  private openSeedSceneOptions(): void {
    this.setPrompt(
      "How many bars for your first scene?",
      [
        { id: "seed_8", label: "8 bars", enabled: true },
        { id: "seed_16", label: "16 bars", enabled: true },
        { id: "back", label: "Back", enabled: true },
      ],
      "seed_scene",
    );
  }

  private openImportPreview(result: ImportResult): void {
    const trackNames = result.matchedTracks.map((m) => m.liveTrackName);
    const sceneCount = result.populatedSceneCount;
    const trackList = trackNames.join(", ");
    const sceneWord = sceneCount === 1 ? "scene" : "scenes";

    this.setPrompt(
      `I found ${trackNames.length} tracks (${trackList}) and ${sceneCount} ${sceneWord} in your set. Import them?`,
      [
        { id: "import_yes", label: "Import", enabled: true },
        { id: "import_no", label: "Start fresh", enabled: true },
        { id: "back", label: "Back", enabled: true },
      ],
      "import_preview",
    );
  }

  private openSceneHub(): void {
    const genreId = this.workflowState.genre;
    if (!genreId) {
      this.openGenreOptions();
      return;
    }

    const availableTrackIds = getAvailableTrackIds(genreId, this.workflowState.addedTrackIds);
    const catalog = getTrackCatalog(genreId);
    const hasScenes = this.workflowState.scenes.length > 0;
    const hasTracks = this.workflowState.addedTrackIds.length > 0;
    const hasMultipleScenes = this.workflowState.scenes.length >= 2;

    const trackOptions: CompanionPromptOption[] = availableTrackIds.map((trackId) => {
      const entry = catalog.find((e) => e.id === trackId);
      return {
        id: `add_track_${trackId}`,
        label: `Add ${entry?.label ?? trackId}`,
        enabled: hasScenes,
      };
    });

    const sceneOption: CompanionPromptOption = {
      id: "new_scene",
      label: "New scene",
      enabled: hasTracks,
    };

    const chainOption: CompanionPromptOption = {
      id: "chain_scenes",
      label: "Chain scenes",
      enabled: hasMultipleScenes,
    };

    const undoOption = this.guidedHistory.length > 0
      ? [{ id: "guided_undo", label: "Undo", enabled: true }]
      : [];

    const activeScene = this.workflowState.scenes[this.workflowState.activeSceneIndex];
    const sceneLabel = activeScene ? activeScene.name : "Scene";
    const trackCount = this.workflowState.addedTrackIds.length;
    const sceneCount = this.workflowState.scenes.length;

    let statusParts: string[] = [];
    if (sceneCount > 0) statusParts.push(`${sceneCount} scene${sceneCount > 1 ? "s" : ""}`);
    if (trackCount > 0) statusParts.push(`${trackCount} track${trackCount > 1 ? "s" : ""}`);
    const status = statusParts.length > 0 ? ` (${statusParts.join(", ")})` : "";

    this.setPrompt(
      `${getGenreLabel(genreId)}${status}: what next?`,
      [
        ...trackOptions,
        sceneOption,
        chainOption,
        ...undoOption,
        { id: "back", label: "Back", enabled: true },
      ],
      "scene_hub",
    );
  }

  private openNewSceneOptions(): void {
    const existingRoles = new Set(this.workflowState.scenes.map((s) => s.role));
    const roleOptions: CompanionPromptOption[] = SCENE_ROLE_IDS
      .filter((roleId) => roleId !== "verse" || !existingRoles.has("verse"))
      .map((roleId) => ({
        id: `role_${roleId}`,
        label: getSceneRoleLabel(roleId),
        enabled: true,
      }));

    // Always allow verse if it's the only one that exists (for "Verse 2" etc.)
    if (existingRoles.has("verse")) {
      roleOptions.unshift({
        id: "role_verse",
        label: "Verse",
        enabled: true,
      });
    }

    this.setPrompt(
      "What role for the new scene?",
      [
        ...roleOptions,
        { id: "back", label: "Back", enabled: true },
      ],
      "new_scene",
    );
  }

  private openConfirmVariation(): void {
    const genreId = this.workflowState.genre;
    const role = this.pendingRole;
    if (!genreId || !role) {
      this.openSceneHub();
      return;
    }

    const suggestions = getVariationSuggestionForScene(this.workflowState, role);
    const description = formatVariationSuggestion(genreId, suggestions);

    this.setPrompt(
      `For a ${getSceneRoleLabel(role)}, I suggest: ${description}.`,
      [
        { id: "variation_approve", label: "Approve", enabled: true },
        { id: "variation_adjust", label: "Adjust", enabled: true },
        { id: "back", label: "Back", enabled: true },
      ],
      "confirm_variation",
    );
  }

  private openTrackScenesQuestion(): void {
    if (this.pendingSceneQuestions.length === 0) {
      this.openSceneHub();
      return;
    }

    const question = this.pendingSceneQuestions[0];
    const genreId = this.workflowState.genre;
    if (!genreId) {
      this.openSceneHub();
      return;
    }
    const entry = getTrackCatalogEntry(genreId, question.trackId);
    const trackLabel = entry?.label ?? question.trackId;

    this.setPrompt(
      `Add ${trackLabel} to ${question.sceneName}?`,
      [
        { id: "track_scene_yes", label: "Yes", enabled: true },
        { id: "track_scene_no", label: "No", enabled: true },
      ],
      "track_scenes",
    );
  }

  private openFreeMode(): void {
    this.setPrompt("Write what you want next.", [], "free");
  }

  // --- Snapshot/restore for undo ---

  private captureGuidedSnapshot(mode: Exclude<GuidedMode, "free">): GuidedSnapshot {
    return {
      workflowState: {
        ...this.workflowState,
        scenes: this.workflowState.scenes.map((s) => ({ ...s, trackVariations: { ...s.trackVariations } })),
        addedTrackIds: [...this.workflowState.addedTrackIds],
      },
      mode,
      pendingTrackId: this.pendingTrackId,
      pendingRole: this.pendingRole,
      pendingSceneQuestions: this.pendingSceneQuestions.map((q) => ({ ...q })),
      pendingImportResult: this.pendingImportResult,
    };
  }

  private async restoreGuidedSnapshot(snapshot: GuidedSnapshot): Promise<void> {
    this.workflowState = {
      ...snapshot.workflowState,
      scenes: snapshot.workflowState.scenes.map((s) => ({ ...s, trackVariations: { ...s.trackVariations } })),
      addedTrackIds: [...snapshot.workflowState.addedTrackIds],
    };
    this.pendingTrackId = snapshot.pendingTrackId;
    this.pendingRole = snapshot.pendingRole;
    this.pendingSceneQuestions = snapshot.pendingSceneQuestions?.map((q) => ({ ...q })) ?? [];
    this.pendingImportResult = snapshot.pendingImportResult;
    this.mode = snapshot.mode;

    await this.reopenCurrentPrompt();
  }

  private async performGuidedUndo(): Promise<string> {
    const entry = this.guidedHistory.pop();
    if (!entry) return "Nothing to undo.";

    for (let index = 0; index < entry.undoSteps; index += 1) {
      await this.service.undoLast();
    }

    await this.restoreGuidedSnapshot(entry.snapshot);
    return "Last guided step undone.";
  }

  private async reopenCurrentPrompt(): Promise<void> {
    switch (this.mode) {
      case "prepare": this.openPrepareOptions(); return;
      case "genre": this.openGenreOptions(); return;
      case "tonal_context": this.openTonalContextOptions(); return;
      case "import_preview":
        if (this.pendingImportResult) {
          this.openImportPreview(this.pendingImportResult);
        } else {
          this.openSeedSceneOptions();
        }
        return;
      case "seed_scene": this.openSeedSceneOptions(); return;
      case "scene_hub": this.openSceneHub(); return;
      case "new_scene": this.openNewSceneOptions(); return;
      case "confirm_variation": this.openConfirmVariation(); return;
      case "track_scenes": this.openTrackScenesQuestion(); return;
      default: this.openFreeMode();
    }
  }

  // --- Natural language handling ---

  private getSyntheticPromptOption(optionId: string): CompanionPromptOption | undefined {
    if (optionId === "prepare_clear") {
      return { id: optionId, label: "Clear the current set", enabled: true };
    }
    if (optionId === "prepare_keep") {
      return { id: optionId, label: "Keep what is already in Live", enabled: true };
    }
    if (optionId === "genre_house" || optionId === "genre_drum_n_bass") {
      const genreId: GuidedGenreId = optionId === "genre_house" ? "house" : "drum_n_bass";
      return { id: optionId, label: getGenreLabel(genreId), enabled: true };
    }
    if (optionId.startsWith("tonal_")) {
      const genreId = this.workflowState.genre;
      if (!genreId) return undefined;
      const tonalId = optionId.replace("tonal_", "");
      const choice = getTonalContextChoices(genreId).find((candidate) => candidate.id === tonalId);
      return choice ? { id: optionId, label: choice.label, enabled: true } : undefined;
    }
    if (optionId.startsWith("add_track_")) {
      const trackId = optionId.replace("add_track_", "");
      const genreId = this.workflowState.genre;
      if (!genreId) return undefined;
      const entry = getTrackCatalogEntry(genreId, trackId);
      return entry ? { id: optionId, label: `Add ${entry.label}`, enabled: true } : undefined;
    }
    if (optionId === "back") {
      return { id: optionId, label: "Back", enabled: true };
    }
    if (optionId === "guided_undo") {
      return { id: optionId, label: "Undo", enabled: true };
    }
    return undefined;
  }

  private buildGuidedOptionSequence(input: string): { optionIds: string[]; ambiguity?: string } | undefined {
    const directMatch = matchPromptOptionFromInput(input, this.promptOptions);
    if (directMatch) {
      return { optionIds: [directMatch.id] };
    }

    const resolution = resolveGuidedIntent(input, this.mode);
    if (!resolution) return undefined;

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
    let genre = this.workflowState.genre;

    const hasLaterTarget = Boolean(
      resolution.genre || resolution.tonalContext || resolution.trackId || resolution.sceneRole,
    );

    if (resolution.prepareChoice === "clear") {
      optionIds.push("prepare_clear");
      genre = undefined;
    } else if (resolution.prepareChoice === "keep") {
      optionIds.push("prepare_keep");
      genre = undefined;
    } else if (this.mode === "prepare" && hasLaterTarget) {
      optionIds.push("prepare_keep");
      genre = undefined;
    }

    if (resolution.genre && resolution.genre !== genre) {
      optionIds.push(`genre_${resolution.genre === "house" ? "house" : "drum_n_bass"}`);
      genre = resolution.genre;
    }

    if (resolution.tonalContext) {
      if (!genre) {
        return optionIds.length > 0
          ? { optionIds }
          : { optionIds: [], ambiguity: "I matched a tonal context, but I still need the genre first." };
      }
      optionIds.push(`tonal_${resolution.tonalContext.scaleMode}_${resolution.tonalContext.key}`);
    }

    if (resolution.trackId) {
      optionIds.push(`add_track_${resolution.trackId}`);
    }

    if (resolution.sceneRole) {
      optionIds.push(`role_${resolution.sceneRole}`);
    }

    if (resolution.chainScenes) {
      optionIds.push("chain_scenes");
    }

    return optionIds.length > 0 ? { optionIds } : undefined;
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
    if (!sequence) return false;

    if (sequence.ambiguity) {
      this.pushMessage("assistant", sequence.ambiguity);
      return true;
    }

    if (sequence.optionIds.length === 0) {
      this.workflowState = createSceneWorkflowState();
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

  // --- Option handler ---

  private async handleGuidedOption(option: CompanionPromptOption): Promise<string> {
    // Prepare
    if (option.id === "prepare_clear") {
      const snapshot = this.captureGuidedSnapshot("prepare");
      this.workflowState = createSceneWorkflowState();
      const undoSteps = await this.runGuidedActionWithUndoTracking((hooks) =>
        clearSessionForGuidedStart(this.service, hooks),
      );
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
      this.openGenreOptions();
      return "Cleared the current set.";
    }

    if (option.id === "prepare_keep") {
      this.workflowState = createSceneWorkflowState();
      this.openGenreOptions();
      return "";
    }

    // Genre
    if (option.id === "genre_house" || option.id === "genre_drum_n_bass") {
      const genreId: GuidedGenreId = option.id === "genre_house" ? "house" : "drum_n_bass";
      this.workflowState = {
        ...this.workflowState,
        genre: genreId,
        scaleMode: undefined,
        key: undefined,
      };
      this.openTonalContextOptions();
      return "";
    }

    // Tonal context
    if (option.id.startsWith("tonal_")) {
      const tonalId = option.id.replace("tonal_", "");
      const genreId = this.workflowState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const choice = getTonalContextChoices(genreId).find((candidate) => candidate.id === tonalId);
      if (!choice) return "Unknown tonal context.";

      this.workflowState = {
        ...this.workflowState,
        key: choice.key,
        scaleMode: choice.scaleMode,
      };

      // Check Live state for existing content to import
      try {
        const liveState = await this.service.refreshState();
        const result = importFromLiveState(liveState, genreId);
        if (result.matchedTracks.length > 0 && result.populatedSceneCount > 0) {
          this.pendingImportResult = result;
          this.openImportPreview(result);
          return "";
        }
      } catch {
        // If refreshState fails, just continue to seed scene
      }

      this.openSeedSceneOptions();
      return "";
    }

    // Seed scene
    if (option.id === "seed_8" || option.id === "seed_16") {
      const bars = option.id === "seed_8" ? 8 : 16;
      const genreId = this.workflowState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const snapshot = this.captureGuidedSnapshot("seed_scene");

      // Set tempo and create first scene
      const messages: string[] = [];
      const undoSteps = await this.runGuidedActionWithUndoTracking(async (hooks) => {
        await ensureGenreTempo(this.service, genreId, messages, hooks);
        await ensureScene(this.service, "Verse", 0, messages, hooks);
      });

      this.workflowState = addScene(this.workflowState, "Verse", "verse", bars);
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
      this.openSceneHub();
      return `Created Verse scene (${bars} bars) at ${getSceneGenreTempo(genreId)} BPM.`;
    }

    // Import preview
    if (option.id === "import_yes") {
      const result = this.pendingImportResult;
      if (!result) {
        this.openSeedSceneOptions();
        return "No import data available.";
      }

      this.workflowState = {
        ...result.state,
        key: this.workflowState.key,
        scaleMode: this.workflowState.scaleMode,
      };
      this.pendingImportResult = undefined;

      const trackCount = result.matchedTracks.length;
      const sceneCount = result.populatedSceneCount;
      const unmatchedNote = result.unmatchedTrackNames.length > 0
        ? ` (${result.unmatchedTrackNames.length} unmatched tracks skipped)`
        : "";

      this.openSceneHub();
      return `Imported ${trackCount} tracks and ${sceneCount} scenes${unmatchedNote}. Ready to add tracks or create variations.`;
    }

    if (option.id === "import_no") {
      this.pendingImportResult = undefined;
      this.openSeedSceneOptions();
      return "";
    }

    // Scene hub: add track
    if (option.id.startsWith("add_track_")) {
      const trackId = option.id.replace("add_track_", "");
      const genreId = this.workflowState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const entry = getTrackCatalogEntry(genreId, trackId);
      if (!entry) return "Unknown track.";

      const snapshot = this.captureGuidedSnapshot("scene_hub");
      const messages: string[] = [];
      const activeScene = this.workflowState.scenes[this.workflowState.activeSceneIndex];
      if (!activeScene) {
        return "No scene available. Create a scene first.";
      }

      const undoSteps = await this.runGuidedActionWithUndoTracking(async (hooks) => {
        const liveTrackRef = await ensureTrack(
          this.service, entry.trackName, entry.role, entry.instrumentQuery, messages, hooks,
        );
        const liveScene = await ensureScene(
          this.service, activeScene.name, this.workflowState.activeSceneIndex, messages, hooks,
        );

        const variation = activeScene.trackVariations[trackId] ?? "full";
        await ensureSceneClip(
          this.service, liveTrackRef, liveScene.index,
          entry.pattern, activeScene.bars, entry.transposeWithKey,
          this.workflowState.key, variation, messages, hooks,
        );
      });

      this.workflowState = addTrackToState(this.workflowState, trackId);
      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });

      // If there are other scenes, ask about adding the track to them
      const otherScenes = this.workflowState.scenes
        .map((scene, index) => ({ scene, index }))
        .filter(({ index }) => index !== this.workflowState.activeSceneIndex);

      if (otherScenes.length > 0) {
        this.pendingTrackId = trackId;
        this.pendingSceneQuestions = otherScenes.map(({ scene, index }) => ({
          sceneIndex: index,
          sceneName: scene.name,
          trackId,
        }));
        this.openTrackScenesQuestion();
        return `${entry.label} added to ${activeScene.name}.`;
      }

      this.openSceneHub();
      return `${entry.label} done.`;
    }

    // Track scenes: yes/no for adding track to other scenes
    if (option.id === "track_scene_yes" || option.id === "track_scene_no") {
      const question = this.pendingSceneQuestions[0];
      if (!question) {
        this.openSceneHub();
        return "";
      }

      const genreId = this.workflowState.genre;
      if (!genreId) {
        this.openSceneHub();
        return "";
      }

      if (option.id === "track_scene_yes") {
        const entry = getTrackCatalogEntry(genreId, question.trackId);
        if (entry) {
          const scene = this.workflowState.scenes[question.sceneIndex];
          const messages: string[] = [];
          const variation = scene?.trackVariations[question.trackId] ?? "full";

          await this.runGuidedActionWithUndoTracking(async (hooks) => {
            const liveTrackRef = await ensureTrack(
              this.service, entry.trackName, entry.role, entry.instrumentQuery, messages, hooks,
            );
            const liveScene = await ensureScene(
              this.service, scene.name, question.sceneIndex, messages, hooks,
            );
            await ensureSceneClip(
              this.service, liveTrackRef, liveScene.index,
              entry.pattern, scene.bars, entry.transposeWithKey,
              this.workflowState.key, variation, messages, hooks,
            );
          });
        }
      }

      this.pendingSceneQuestions = this.pendingSceneQuestions.slice(1);
      if (this.pendingSceneQuestions.length > 0) {
        this.openTrackScenesQuestion();
        return "";
      }

      this.openSceneHub();
      return "";
    }

    // New scene
    if (option.id === "new_scene") {
      this.openNewSceneOptions();
      return "";
    }

    // Scene role selection
    if (option.id.startsWith("role_")) {
      const roleId = option.id.replace("role_", "");
      if (!isSceneRoleId(roleId)) return "Unknown role.";

      this.pendingRole = roleId;

      // If there are tracks to suggest variations for, show confirmation
      if (this.workflowState.addedTrackIds.length > 0) {
        this.openConfirmVariation();
        return "";
      }

      // No tracks yet, just create the scene
      return this.createScene(roleId);
    }

    // Variation approval
    if (option.id === "variation_approve") {
      const role = this.pendingRole;
      if (!role) {
        this.openSceneHub();
        return "";
      }
      return this.createScene(role);
    }

    if (option.id === "variation_adjust") {
      // For now, approve with default suggestions. Full adjustment UI can be added later.
      const role = this.pendingRole;
      if (!role) {
        this.openSceneHub();
        return "";
      }
      return this.createScene(role);
    }

    // Chain scenes
    if (option.id === "chain_scenes") {
      const genreId = this.workflowState.genre;
      if (!genreId) return "Choose a genre first.";

      const sceneNames = this.workflowState.scenes.map((s) => s.name);
      const messages: string[] = [];
      const snapshot = this.captureGuidedSnapshot("scene_hub");

      const undoSteps = await this.runGuidedActionWithUndoTracking(async (hooks) => {
        const state = await this.service.refreshState();
        for (const sceneName of sceneNames) {
          const scene = state.sceneOrder
            .map((sceneId) => state.scenes[sceneId])
            .find((s) => s?.name === sceneName);
          if (scene) {
            await this.service.fireScene(scene.index);
            break;
          }
        }
      });

      this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 0) });
      this.openFreeMode();
      return `Scenes chained: ${sceneNames.join(" > ")}. Auto-advance is not implemented yet.`;
    }

    // Undo
    if (option.id === "guided_undo") {
      return this.performGuidedUndo();
    }

    // Back
    if (option.id === "back") {
      if (this.mode === "genre") {
        this.openPrepareOptions();
        return "";
      }
      if (this.mode === "tonal_context") {
        this.openGenreOptions();
        return "";
      }
      if (this.mode === "import_preview") {
        this.pendingImportResult = undefined;
        this.openTonalContextOptions();
        return "";
      }
      if (this.mode === "seed_scene") {
        this.openTonalContextOptions();
        return "";
      }
      if (this.mode === "scene_hub") {
        this.openSeedSceneOptions();
        return "";
      }
      if (this.mode === "new_scene") {
        this.openSceneHub();
        return "";
      }
      if (this.mode === "confirm_variation") {
        this.openNewSceneOptions();
        return "";
      }
      if (this.mode === "track_scenes") {
        this.pendingSceneQuestions = [];
        this.openSceneHub();
        return "";
      }
    }

    return `${option.label} is not implemented yet.`;
  }

  private async createScene(role: SceneRoleId): Promise<string> {
    const genreId = this.workflowState.genre;
    if (!genreId) return "Choose a genre first.";

    const label = getSceneRoleLabel(role);
    const existingWithRole = this.workflowState.scenes.filter((s) => s.role === role);
    const sceneName = existingWithRole.length > 0
      ? `${label} ${existingWithRole.length + 1}`
      : label;

    const bars = this.workflowState.scenes[0]?.bars ?? 8;

    const snapshot = this.captureGuidedSnapshot("new_scene");
    const messages: string[] = [];

    const suggestions = getVariationSuggestionForScene(this.workflowState, role);
    const variationMap: Record<string, TrackVariation> = {};
    for (const suggestion of suggestions) {
      variationMap[suggestion.trackId] = suggestion.variation;
    }

    const undoSteps = await this.runGuidedActionWithUndoTracking(async (hooks) => {
      const sceneIndex = this.workflowState.scenes.length;
      const liveScene = await ensureScene(this.service, sceneName, sceneIndex, messages, hooks);

      // Create clips for each added track with the appropriate variation
      for (const trackId of this.workflowState.addedTrackIds) {
        const entry = getTrackCatalogEntry(genreId, trackId);
        if (!entry) continue;

        const variation = variationMap[trackId] ?? "full";
        if (variation === "exclude") continue;

        const liveTrackRef = await ensureTrack(
          this.service, entry.trackName, entry.role, entry.instrumentQuery, messages, hooks,
        );
        await ensureSceneClip(
          this.service, liveTrackRef, liveScene.index,
          entry.pattern, bars, entry.transposeWithKey,
          this.workflowState.key, variation, messages, hooks,
        );
      }
    });

    // Update state with the new scene including its variation map
    const newScene = {
      name: sceneName,
      role,
      bars,
      trackVariations: variationMap,
    };
    this.workflowState = {
      ...this.workflowState,
      scenes: [...this.workflowState.scenes, newScene],
      activeSceneIndex: this.workflowState.scenes.length,
    };

    this.pushHistory({ snapshot, undoSteps: Math.max(undoSteps, 1) });
    this.pendingRole = undefined;
    this.openSceneHub();
    return `${sceneName} scene created.`;
  }
}
