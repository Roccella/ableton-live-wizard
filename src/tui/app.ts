import blessed from "neo-blessed";
import { LiveState, Track } from "../types.js";
import { buildAgentPanelContent } from "./agent-panel.js";
import { buildPromptPanelContent, measurePromptPanelHeight } from "./prompt-panel.js";
import { createCompanionService } from "../companion/factory.js";
import { PromptContext, WizardCompanionEvent, WizardCompanionService } from "../companion/types.js";
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
  getKeyChoices,
  getGenreLabel,
  getScaleChoices,
  GuidedActionHooks,
  GuidedActionPausedError,
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
import { debugLog, getDebugLogPath } from "../util.js";

type FocusArea = "agent" | "session";
type SessionArea = "toolbar" | "grid" | "footer";
type SidebarPane = "chat" | "input" | "debug";
type ToolbarAction = "undo" | "redo" | "tempo_down" | "tempo_up" | "play_toggle";
type FooterAction = "add_track" | "add_scene";
type DeleteTarget =
  | { key: string; label: string; run: () => Promise<void> }
  | undefined;
type PendingOperation = {
  key: string;
  label: string;
  cancelable: boolean;
};
type AgentOption = {
  id: string;
  label: string;
  enabled: boolean;
};
type GuidedMode = "prepare" | "genre" | "scale_mode" | "key" | "build" | "chain" | "free";
type ExtendedGuidedMode = GuidedMode | "custom_input";
type AgentViewState = {
  question?: string;
  helperText?: string;
  options: AgentOption[];
  mode: ExtendedGuidedMode;
  selectedIndex: number;
};
type GuidedSnapshot = {
  guidedState: GuidedSessionState;
  mode: Exclude<GuidedMode, "free">;
};
type GuidedHistoryEntry = {
  snapshot: GuidedSnapshot;
  undoSteps: number;
};
type PausedAction = {
  label: string;
  cleanupUndoSteps: number;
  partialMessages: string[];
  snapshot: GuidedSnapshot;
  action: (hooks: GuidedActionHooks) => Promise<string>;
  onSuccess: (response: string) => void;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = ["undo", "redo", "tempo_down", "tempo_up", "play_toggle"];
const FOOTER_ACTIONS: FooterAction[] = ["add_track", "add_scene"];
const SPINNER_FRAMES = ["|", "/", "-", "\\"];
const MIN_PROMPT_HEIGHT = 7;
const MAX_PROMPT_HEIGHT = 12;
const MIN_DEBUG_HEIGHT = 5;
const MAX_DEBUG_HEIGHT = 6;
const DEBUG_HEIGHT_RATIO = 0.18;
const CLIP_GLYPH = "░░░░░░";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const truncate = (value: string, length: number): string =>
  value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1))}~`;

const renderButton = (label: string, active: boolean): string =>
  active ? `{black-fg}{cyan-bg}[ ${label} ]{/cyan-bg}{/black-fg}` : `[ ${label} ]`;

const isModifiedNewlineKey = (key: blessed.Widgets.Events.IKeyEventArg): boolean => {
  const sequence = key.sequence ?? "";
  return (
    key.full === "S-enter" ||
    key.full === "S-return" ||
    key.full === "linefeed" ||
    sequence === "\n" ||
    sequence === "\x1b\r" ||
    sequence === "\x1b[13;2u" ||
    sequence === "\x1b[27;2;13~" ||
    ((key.name === "enter" || key.name === "return") && key.shift) ||
    key.name === "linefeed" ||
    key.full === "M-enter" ||
    key.full === "M-return" ||
    key.full === "C-j"
  );
};

export class WizardTuiApp {
  private readonly service: WizardCompanionService;
  private readonly screen: blessed.Widgets.Screen;
  private readonly conversationBox: blessed.Widgets.BoxElement;
  private readonly promptBox: blessed.Widgets.BoxElement;
  private readonly transportBox: blessed.Widgets.BoxElement;
  private readonly sessionBox: blessed.Widgets.BoxElement;
  private readonly instructionsBox: blessed.Widgets.BoxElement;
  private readonly statusBox: blessed.Widgets.BoxElement;
  private readonly overlayBox: blessed.Widgets.BoxElement;
  private currentState?: LiveState;
  private focusArea: FocusArea = "agent";
  private sessionArea: SessionArea = "grid";
  private sidebarPane: SidebarPane = "input";
  private toolbarIndex = 0;
  private footerIndex = 0;
  private selectedTrackIndex = 0;
  private gridRow = -1;
  private gridColumn = 0;
  private isPromptOpen = false;
  private readonly conversationLines: string[] = [];
  private readonly statusLines: string[] = [];
  private promptDraft = "";
  private promptCursorIndex = 0;
  private pendingDelete?: { key: string; deadline: number };
  private pendingOperation?: PendingOperation;
  private cancelRequested = false;
  private spinnerIndex = 0;
  private spinnerTimer?: NodeJS.Timeout;
  private agentQuestion?: string;
  private agentHelperText?: string;
  private agentOptions: AgentOption[] = [];
  private selectedAgentOptionIndex = 0;
  private agentMode: ExtendedGuidedMode = "prepare";
  private guidedState: GuidedSessionState = createGuidedSessionState();
  private readonly guidedHistory: GuidedHistoryEntry[] = [];
  private pausedAction?: PausedAction;
  private unsubscribeService?: () => void;
  private promptReturnState?: AgentViewState;
  private cursorBlinkVisible = true;
  private cursorBlinkTimer?: NodeJS.Timeout;
  private readonly panePinnedToBottom: Record<SidebarPane, boolean> = {
    chat: true,
    input: true,
    debug: true,
  };

  constructor(service?: WizardCompanionService) {
    this.service = service ?? createCompanionService();
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
      title: "Ableton Live Wizard",
      terminal: process.env.WIZARD_TUI_TERM ?? "xterm",
      mouse: false,
      warnings: false,
    });

    this.conversationBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      bottom: MIN_PROMPT_HEIGHT + MIN_DEBUG_HEIGHT,
      border: "line",
      label: " Chat ",
      tags: true,
      scrollable: true,
      alwaysScroll: true,
    });

    this.promptBox = blessed.box({
      parent: this.screen,
      bottom: MIN_DEBUG_HEIGHT,
      left: 0,
      width: "100%",
      height: MIN_PROMPT_HEIGHT,
      border: "line",
      label: " Input ",
      tags: true,
      mouse: false,
      scrollable: true,
      style: {
        focus: {
          border: {
            fg: "cyan",
          },
        },
      },
    });

    this.transportBox = blessed.box({
      parent: this.screen,
      hidden: true,
      width: 0,
      height: 0,
      tags: true,
    });

    this.sessionBox = blessed.box({
      parent: this.screen,
      hidden: true,
      width: 0,
      height: 0,
      tags: true,
      scrollable: true,
    });

    this.instructionsBox = blessed.box({
      parent: this.screen,
      hidden: true,
      width: 0,
      height: 0,
      tags: true,
    });

    this.statusBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: "100%",
      height: MIN_DEBUG_HEIGHT,
      border: "line",
      label: " Debug Log ",
      tags: true,
      scrollable: true,
      alwaysScroll: true,
    });

    this.overlayBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      align: "center",
      valign: "middle",
      hidden: true,
      tags: true,
      style: {
        bg: "black",
        fg: "white",
      },
    });

    this.bindEvents();
  }

  async start(): Promise<void> {
    this.pushConversation("• Ready. Sidebar mode active.");
    this.pushConversation("• Use up/down + enter for suggestions, or pick `Type something else` to type.");
    this.pushConversation("• Use tab to cycle chat/input/debug and pageup/pagedown to scroll.");
    this.guidedState = createGuidedSessionState();
    this.guidedHistory.length = 0;
    this.openPrepareOptions();
    this.unsubscribeService = this.service.subscribe((event) => this.handleServiceEvent(event));
    this.pushStatus(`Debug log: ${getDebugLogPath()}`);
    const catalog = await this.service.getResourceCatalog();
    this.pushStatus(`Resource catalog: ${catalog.length} entries available.`);
    await this.refreshState("State refreshed");
    this.focusAgent();
  }

  private bindEvents(): void {
    this.screen.key(["q", "C-c"], () => this.shutdown());
    this.screen.key(["escape"], () => {
      if (!this.pendingOperation) {
        return;
      }
      this.requestPause();
    });
    this.screen.key(["tab", "S-tab"], (_ch, key) => {
      if (this.pendingOperation) {
        return;
      }
      this.cycleSidebarPane(key.full === "S-tab" ? -1 : 1);
    });
    this.screen.key(["r"], () => {
      if (this.pendingOperation) {
        return;
      }
      void this.safeRun("key:refresh", () => this.refreshState("State refreshed"));
    });
    this.screen.key(["up"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (!this.isPromptOpen) {
        this.navigateAgent("up");
      }
    });
    this.screen.key(["down"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (!this.isPromptOpen) {
        this.navigateAgent("down");
      }
    });
    this.screen.key(["pageup"], () => {
      this.scrollSidebarPane(-4);
    });
    this.screen.key(["pagedown"], () => {
      this.scrollSidebarPane(4);
    });
    this.screen.key(["home"], () => {
      this.scrollSidebarPaneTo("top");
    });
    this.screen.key(["end"], () => {
      this.scrollSidebarPaneTo("bottom");
    });
    this.screen.key(["enter"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (!this.isPromptOpen) {
        void this.safeRun("key:agent-enter", () => this.activateAgentSelection());
      }
    });

    this.screen.on("keypress", (ch, key) => {
      if (this.pendingOperation) {
        return;
      }

      if (this.isPromptOpen) {
        this.handlePromptKeypress(ch, key);
        return;
      }

      if (!ch || !/^[\x20-\x7E]$/.test(ch)) {
        return;
      }

      if (key.ctrl || key.meta || key.shift) {
        return;
      }

      this.openPromptEditor(ch);
    });
  }

  private async refreshState(message?: string): Promise<void> {
    try {
      debugLog("tui", "refresh_state:start", {
        focusArea: this.focusArea,
        sessionArea: this.sessionArea,
        gridRow: this.gridRow,
        gridColumn: this.gridColumn,
      });
      this.currentState = await this.service.refreshState();
      this.pendingDelete = undefined;
      this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.trackCount() - 1);
      this.gridRow = clamp(this.gridRow, -1, this.sceneCount() - 1);
      this.gridColumn = clamp(this.gridColumn, 0, this.gridMaxColumn());
      if (message) {
        this.pushStatus(message);
      }
      debugLog("tui", "refresh_state:success", {
        trackCount: this.currentState.trackOrder.length,
        sceneCount: this.currentState.sceneOrder.length,
      });
      this.renderAll();
    } catch (error) {
      debugLog("tui", "refresh_state:error", error);
      this.pushStatus(`Refresh failed: ${(error as Error).message}`);
      this.renderAll();
    }
  }

  private renderAll(): void {
    this.renderPromptInput();
    this.renderConversation();
    this.renderStatus();
    this.renderFocus();
    this.renderOverlay();
    this.screen.render();
  }

  private renderConversation(): void {
    const screenHeight = typeof this.screen.height === "number" ? this.screen.height : Number(this.screen.height ?? 0);
    const innerHeight = Math.max(1, screenHeight - this.currentPromptPanelHeight() - this.currentDebugPanelHeight() - 2);
    const previousScroll = this.conversationBox.getScroll();

    this.conversationBox.setContent(
      buildAgentPanelContent({
        conversationLines: this.conversationLines,
        viewportHeight: innerHeight,
      }),
    );
    if (this.panePinnedToBottom.chat) {
      this.conversationBox.setScrollPerc(100);
    } else {
      this.conversationBox.setScroll(previousScroll);
    }
  }

  private renderTransport(): void {
    const bpm = this.currentState?.transport.bpm ?? 120;
    const isPlaying = this.isTransportPlaying();
    const selectedTrack = this.getSelectedTrack();
    const selectedScene = this.getSelectedScene();
    const active = (index: number): boolean =>
      this.focusArea === "session" && this.sessionArea === "toolbar" && this.toolbarIndex === index;
    const buttonLabel = (action: ToolbarAction, fallback: string): string =>
      this.pendingOperation?.key === `toolbar:${action}` ? this.spinnerFrame() : fallback;
    const playLabel = isPlaying ? "Stop" : "Play";

    const buttons = [
      renderButton(buttonLabel("undo", "Undo"), active(0)),
      renderButton(buttonLabel("redo", "Redo"), active(1)),
      renderButton(buttonLabel("tempo_down", "-"), active(2)),
      `{bold}${bpm} BPM{/bold}`,
      renderButton(buttonLabel("tempo_up", "+"), active(3)),
      renderButton(buttonLabel("play_toggle", playLabel), active(4)),
    ];

    this.transportBox.setContent(
      `${buttons.join("  ")}\n` +
        `Companion {bold}${this.service.describeConnection()}{/bold}  Playback ${isPlaying ? "{green-fg}PLAY{/green-fg}" : "{red-fg}STOP{/red-fg}"}  ` +
        `Track ${selectedTrack?.name ?? "-"}  Scene ${selectedScene?.name ?? "-"}  Focus {bold}${this.focusArea === "agent" ? "Chat" : "Session"}{/bold}`,
    );
  }

  private renderPromptInput(): void {
    const promptHeight = this.currentPromptPanelHeight();
    const debugHeight = this.currentDebugPanelHeight();
    const previousScroll = this.promptBox.getScroll();
    this.promptBox.height = promptHeight;
    this.promptBox.bottom = debugHeight;
    this.conversationBox.bottom = promptHeight + debugHeight;
    this.promptBox.setContent(
      buildPromptPanelContent({
        question: this.agentQuestion,
        helperText: this.agentHelperText,
        options: this.agentOptions,
        selectedIndex: this.selectedAgentOptionIndex,
        highlightSelection: this.focusArea === "agent" && !this.isPromptOpen,
        promptDraft: this.promptDraft,
        isPromptOpen: this.isPromptOpen,
        cursorVisible: this.cursorBlinkVisible,
        cursorIndex: this.promptCursorIndex,
      }),
    );
    if (this.panePinnedToBottom.input) {
      this.promptBox.setScrollPerc(100);
    } else {
      this.promptBox.setScroll(previousScroll);
    }
  }

  private renderSession(): void {
    const state = this.currentState;
    if (!state) {
      this.sessionBox.setContent("No state available.");
      return;
    }

    const trackIds = state.trackOrder;
    const sceneIds = state.sceneOrder;
    const clipWidth = CLIP_GLYPH.length;
    const sceneNameWidth = 14;
    const lines: string[] = [];

    const headerCells = trackIds.map((trackId, index) =>
      this.decorateSessionCell(
        truncate(state.tracks[trackId].name, clipWidth).padEnd(clipWidth),
        this.sessionArea === "grid" && this.gridRow === -1 && this.gridColumn === index && this.focusArea === "session",
      ),
    );

    lines.push(`${headerCells.join(" ")}  ${"Scene".padEnd(sceneNameWidth)}  Act`);

    for (let sceneIndex = 0; sceneIndex < sceneIds.length; sceneIndex += 1) {
      const sceneId = sceneIds[sceneIndex];
      const scene = state.scenes[sceneId];
      const row: string[] = [];

      for (let trackIndex = 0; trackIndex < trackIds.length; trackIndex += 1) {
        const trackId = trackIds[trackIndex];
        const clip = state.tracks[trackId].clips[`clip_${sceneIndex}`];
        const selected = this.focusArea === "session" && this.sessionArea === "grid" && this.gridRow === sceneIndex && this.gridColumn === trackIndex;
        row.push(this.renderClipCell(clip ? (clip.isPlaying ? "playing" : "filled") : "empty", selected));
      }

      const sceneColumn = this.decorateSessionCell(
        truncate(scene.name, sceneNameWidth).padEnd(sceneNameWidth),
        this.focusArea === "session" && this.sessionArea === "grid" && this.gridRow === sceneIndex && this.gridColumn === trackIds.length,
      );
      const actionLabel =
        this.pendingOperation?.key === `scene_action:${scene.id}` ? this.spinnerFrame() : scene.isTriggered ? "⏹" : "▶";
      const actionColumn = this.decorateSessionCell(
        actionLabel.padEnd(3),
        this.focusArea === "session" && this.sessionArea === "grid" && this.gridRow === sceneIndex && this.gridColumn === trackIds.length + 1,
      );
      lines.push(`${row.join(" ")}  ${sceneColumn}  ${actionColumn}`);
    }

    const footerButtons = FOOTER_ACTIONS.map((action, index) =>
      renderButton(
        this.pendingOperation?.key === `footer:${action}`
          ? this.spinnerFrame()
          : action === "add_track"
            ? "Add track +"
            : "Add scene +",
        this.focusArea === "session" && this.sessionArea === "footer" && this.footerIndex === index,
      ),
    );
    lines.push("");
    lines.push(`${footerButtons[0]}    ${footerButtons[1]}`);
    lines.push(`Tracks: ${trackIds.length}  Scenes: ${sceneIds.length}`);

    this.sessionBox.setContent(lines.join("\n"));
  }

  private renderInstructions(): void {
    const deletable = this.currentDeleteTarget();
    const deleteHint = deletable
      ? `Press backspace 2 times to delete ${deletable.label}.`
      : "Backspace x2 deletes the selected track, clip or scene when applicable.";
    this.instructionsBox.setContent(
      "- Use shift+tab to switch between agent and session view\n" +
        "- In chat, use up/down + enter to pick a guided option; press down past the last option to type\n" +
        "- Use arrows to navigate session buttons, tracks, clips and scenes\n" +
        "- Press enter to select a track, clip or scene and jump to chat for changes\n" +
        `- ${deleteHint}`,
    );
  }

  private renderStatus(): void {
    const previousScroll = this.statusBox.getScroll();
    this.statusBox.height = this.currentDebugPanelHeight();
    this.statusBox.setContent(this.statusLines.join("\n"));
    if (this.panePinnedToBottom.debug) {
      this.statusBox.setScrollPerc(100);
    } else {
      this.statusBox.setScroll(previousScroll);
    }
  }

  private renderFocus(): void {
    const active = { fg: "cyan" };
    const inactive = { fg: "white" };

    this.conversationBox.style.border = this.sidebarPane === "chat" ? active : inactive;
    this.promptBox.style.border = this.sidebarPane === "input" || this.pendingOperation?.key === "prompt" ? active : inactive;
    this.statusBox.style.border = this.sidebarPane === "debug" ? active : inactive;
  }

  private renderOverlay(): void {
    if (!this.pendingOperation) {
      this.overlayBox.hide();
      this.overlayBox.setContent("");
      return;
    }

    const frame = this.spinnerFrame();
    const label = truncate(this.pendingOperation.label, 48);
    this.overlayBox.setContent(
      `{center}{cyan-fg}{bold}${frame} ${label} ${frame}{/bold}{/cyan-fg}\n` +
        `{white-fg}${this.cancelRequested ? "Pause requested... finishing the current safe boundary." : "Working... controls are temporarily disabled."}{/white-fg}{/center}`,
    );
    this.overlayBox.show();
    this.overlayBox.setFront();
  }

  private toggleFocus(): void {
    debugLog("tui", "toggle_focus", { from: this.focusArea });
    if (this.focusArea === "session") {
      this.focusAgent();
      return;
    }
    this.focusSession();
  }

  private focusAgent(): void {
    debugLog("tui", "focus_agent");
    this.focusArea = "agent";
    this.isPromptOpen = false;
    this.stopCursorBlink();
    this.sidebarPane = "input";
    this.screen.focusPush(this.promptBox);
    this.renderAll();
  }

  private focusSession(): void {
    debugLog("tui", "focus_session", { sessionArea: this.sessionArea, gridRow: this.gridRow, gridColumn: this.gridColumn });
    this.focusArea = "session";
    this.isPromptOpen = false;
    this.screen.focusPush(this.sessionBox);
    this.renderAll();
  }

  private navigateSession(direction: "left" | "right" | "up" | "down"): void {
    debugLog("tui", "navigate_session", {
      direction,
      before: {
        sessionArea: this.sessionArea,
        gridRow: this.gridRow,
        gridColumn: this.gridColumn,
        toolbarIndex: this.toolbarIndex,
        footerIndex: this.footerIndex,
      },
    });
    this.pendingDelete = undefined;

    if (this.sessionArea === "toolbar") {
      if (direction === "left") this.toolbarIndex = clamp(this.toolbarIndex - 1, 0, TOOLBAR_ACTIONS.length - 1);
      if (direction === "right") this.toolbarIndex = clamp(this.toolbarIndex + 1, 0, TOOLBAR_ACTIONS.length - 1);
      if (direction === "down") {
        this.sessionArea = "grid";
        this.gridRow = -1;
      }
      this.renderAll();
      return;
    }

    if (this.sessionArea === "footer") {
      if (direction === "left") this.footerIndex = clamp(this.footerIndex - 1, 0, FOOTER_ACTIONS.length - 1);
      if (direction === "right") this.footerIndex = clamp(this.footerIndex + 1, 0, FOOTER_ACTIONS.length - 1);
      if (direction === "up") this.sessionArea = "grid";
      this.renderAll();
      return;
    }

    if (direction === "left") {
      this.gridColumn = clamp(this.gridColumn - 1, 0, this.gridMaxColumn());
    } else if (direction === "right") {
      this.gridColumn = clamp(this.gridColumn + 1, 0, this.gridMaxColumn());
    } else if (direction === "up") {
      if (this.gridRow === -1) {
        this.sessionArea = "toolbar";
      } else if (this.gridRow === 0) {
        this.gridRow = -1;
      } else {
        this.gridRow = clamp(this.gridRow - 1, -1, this.sceneCount() - 1);
      }
    } else if (direction === "down") {
      if (this.gridRow >= this.sceneCount() - 1) {
        this.sessionArea = "footer";
      } else if (this.gridRow === -1) {
        this.gridRow = 0;
      } else {
        this.gridRow = clamp(this.gridRow + 1, -1, this.sceneCount() - 1);
      }
    }

    if (this.gridColumn < this.trackCount()) {
      this.selectedTrackIndex = clamp(this.gridColumn, 0, this.trackCount() - 1);
    }
    debugLog("tui", "navigate_session:after", {
      sessionArea: this.sessionArea,
      gridRow: this.gridRow,
      gridColumn: this.gridColumn,
      selectedTrackIndex: this.selectedTrackIndex,
    });
    this.renderAll();
  }

  private async activateSelection(): Promise<void> {
    debugLog("tui", "activate_selection", {
      sessionArea: this.sessionArea,
      targetKind: this.currentGridTargetKind(),
      gridRow: this.gridRow,
      gridColumn: this.gridColumn,
      track: this.getSelectedTrack()?.id,
      scene: this.getSelectedScene()?.id,
    });
    if (this.sessionArea === "toolbar") {
      await this.runToolbarAction(TOOLBAR_ACTIONS[this.toolbarIndex]);
      return;
    }

    if (this.sessionArea === "footer") {
      await this.runFooterAction(FOOTER_ACTIONS[this.footerIndex]);
      return;
    }

    const targetKind = this.currentGridTargetKind();
    if (targetKind === "scene_action") {
      const sceneId = this.getSelectedScene()?.id ?? `scene_${this.selectedSceneIndex() + 1}`;
      await this.withSpinner(`scene_action:${sceneId}`, `Firing scene ${this.selectedSceneIndex() + 1}`, async () => {
        const result = await this.service.fireScene(this.selectedSceneIndex());
        this.pushStatus(result.message);
        await this.refreshState();
      });
      return;
    }

    if (targetKind === "track") {
      this.pushConversation(`• Selected track ${this.getSelectedTrack()?.name}. Ask changes below.`);
      this.openPromptEditor();
      return;
    }

    if (targetKind === "clip") {
      this.pushConversation(
        `• Selected clip ${this.getSelectedTrack()?.name} / ${this.selectedClipId()}. Ask changes below.`,
      );
      this.openPromptEditor();
      return;
    }

    if (targetKind === "scene") {
      this.pushConversation(`• Selected scene ${this.getSelectedScene()?.name}. Ask changes below.`);
      this.openPromptEditor();
    }
  }

  private async runToolbarAction(action: ToolbarAction): Promise<void> {
    debugLog("tui", "run_toolbar_action:start", { action });
    const bpm = this.currentState?.transport.bpm ?? 120;

    await this.withSpinner(`toolbar:${action}`, `Toolbar action ${action}`, async () => {
      if (action === "undo") {
        const result = await this.service.undoLast();
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      if (action === "redo") {
        const result = await this.service.redoLast();
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      if (action === "tempo_down") {
        const result = await this.service.setTempo(Math.max(20, bpm - 1));
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      if (action === "tempo_up") {
        const result = await this.service.setTempo(Math.min(300, bpm + 1));
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      const result = await this.playToggle();
      this.pushStatus(result);
      await this.refreshState();
    });
  }

  private async runFooterAction(action: FooterAction): Promise<void> {
    debugLog("tui", "run_footer_action:start", { action });
    await this.withSpinner(`footer:${action}`, `Footer action ${action}`, async () => {
      if (action === "add_track") {
        const name = `Track ${this.trackCount() + 1}`;
        const result = await this.service.applyOperation("create_track", { name });
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }

      const name = `Scene ${this.sceneCount() + 1}`;
      const result = await this.service.applyOperation("create_scene", { name });
      this.pushStatus(result.message);
      await this.refreshState();
    });
  }

  private async handleDeleteKey(): Promise<void> {
    debugLog("tui", "handle_delete_key", {
      target: this.currentDeleteTarget()?.label,
      pendingDelete: this.pendingDelete,
    });
    const target = this.currentDeleteTarget();
    if (!target) {
      this.pushStatus("Nothing deletable is selected.");
      return;
    }

    const now = Date.now();
    if (this.pendingDelete?.key === target.key && this.pendingDelete.deadline > now) {
      this.pendingDelete = undefined;
      await this.withSpinner(`delete:${target.key}`, `Delete ${target.label}`, async () => {
        await target.run();
        await this.refreshState();
      });
      return;
    }

    this.pendingDelete = {
      key: target.key,
      deadline: now + 1500,
    };
    this.pushStatus(`Press backspace again to delete ${target.label}.`);
  }

  private currentDeleteTarget(): DeleteTarget {
    if (this.sessionArea !== "grid") {
      return undefined;
    }

    const targetKind = this.currentGridTargetKind();
    const track = this.getSelectedTrack();
    const scene = this.getSelectedScene();
    const clipId = this.selectedClipId();
    const clip = track?.clips[clipId];

    if (targetKind === "track" && track) {
      return {
        key: `track:${track.id}`,
        label: `track ${track.name}`,
        run: async () => {
          const result = await this.service.applyOperation("delete_track", { trackRef: track.id });
          this.pushStatus(result.message);
        },
      };
    }

    if (targetKind === "clip" && track && clip) {
      return {
        key: `clip:${track.id}:${clipId}`,
        label: `clip ${track.name}/${clipId}`,
        run: async () => {
          const result = await this.service.applyOperation("delete_clip", {
            trackRef: track.id,
            clipRef: clipId,
          });
          this.pushStatus(result.message);
        },
      };
    }

    if (targetKind === "scene" && scene) {
      return {
        key: `scene:${scene.id}`,
        label: `scene ${scene.name}`,
        run: async () => {
          const result = await this.service.applyOperation("delete_scene", { sceneRef: scene.id });
          this.pushStatus(result.message);
        },
      };
    }

    return undefined;
  }

  private async handlePromptSubmit(rawValue: string): Promise<void> {
    const input = rawValue
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
    this.promptDraft = "";
    this.promptCursorIndex = 0;
    this.isPromptOpen = false;
    this.stopCursorBlink();

    if (!input) {
      this.focusAgent();
      return;
    }

    if (this.agentMode === "custom_input" && input.toLowerCase() === "go back") {
      this.restorePromptReturnState();
      this.pushConversation("• Back to suggestions.");
      this.focusAgent();
      return;
    }

    this.pushConversation(`> ${input}`);
    debugLog("tui", "prompt_submit", { input });

    try {
      await this.withSpinner("prompt", `Prompt: ${input}`, async () => {
        const response = await this.executePrompt(input);
        this.pushConversation(`• ${response}`);
        await this.refreshState();
      });
    } catch (error) {
      const message = `Prompt error: ${(error as Error).message}`;
      this.pushConversation(`• ${message}`);
      this.pushStatus(message);
    }

    if (!this.isPromptOpen) {
      this.focusAgent();
    } else {
      this.renderAll();
    }
  }

  private async executePrompt(input: string): Promise<string> {
    const promptContext = await this.resolvePromptContext();
    debugLog("tui", "execute_prompt:start", {
      input,
      selectedTrack: promptContext.selectedTrackId,
      selectedScene: promptContext.selectedSceneId,
      selectedClipId: promptContext.selectedClipId,
    });
    const guidedResponse = await this.tryHandleGuidedInput(input);

    if (guidedResponse) {
      return guidedResponse;
    }

    if (input === "help") {
      return "Commands: suggest, play, stop, undo, redo, refresh, tempo <n|+|->, scene play, clip play, analyze clip, vary clip <resolve|question|mini_roll>, create track [name], create scene [name], delete track, delete clip, delete scene, instrument <role|query>, create clip [bars], pattern <name> [bars], b/l/p/d.";
    }
    if (input === "suggest") {
      this.guidedState = createGuidedSessionState();
      this.guidedHistory.length = 0;
      this.openPrepareOptions();
      return "Suggestions reopened.";
    }
    if (input === "refresh") {
      const response = await this.service.submitPrompt(input, promptContext);
      return response.message;
    }
    if (input === "play") {
      return this.playToggle();
    }

    const response = await this.service.submitPrompt(input, promptContext);
    return response.message;
  }

  private async resolvePromptContext(): Promise<PromptContext> {
    const liveState = await this.service.getState(true);
    this.currentState = liveState;

    const liveContext: PromptContext = {
      selectedTrackId: liveState.selectedTrackId,
      selectedSceneId: liveState.selectedSceneId,
      selectedClipId: liveState.selectedClipId,
    };

    const targetKind = this.currentGridTargetKind();
    if (targetKind === "clip") {
      const track = this.getSelectedTrack();
      const scene = this.getSelectedScene();
      return {
        selectedTrackId: track?.id ?? liveContext.selectedTrackId,
        selectedSceneId: scene?.id ?? liveContext.selectedSceneId,
        selectedClipId: scene ? `clip_${scene.index}` : liveContext.selectedClipId,
      };
    }

    if (targetKind === "scene") {
      const scene = this.getSelectedScene();
      return {
        selectedTrackId: liveContext.selectedTrackId,
        selectedSceneId: scene?.id ?? liveContext.selectedSceneId,
        selectedClipId: liveContext.selectedClipId,
      };
    }

    if (targetKind === "track") {
      const track = this.getSelectedTrack();
      return {
        selectedTrackId: track?.id ?? liveContext.selectedTrackId,
        selectedSceneId: liveContext.selectedSceneId,
        selectedClipId: liveContext.selectedClipId,
      };
    }

    return liveContext;
  }

  private currentGridTargetKind(): "track" | "clip" | "scene" | "scene_action" {
    if (this.gridRow === -1) {
      return "track";
    }
    const trackCount = this.trackCount();
    if (this.gridColumn < trackCount) {
      return "clip";
    }
    if (this.gridColumn === trackCount) {
      return "scene";
    }
    return "scene_action";
  }

  private gridMaxColumn(): number {
    if (this.gridRow === -1) {
      return Math.max(this.trackCount() - 1, 0);
    }
    return Math.max(this.trackCount() + 1, 1);
  }

  private trackCount(): number {
    return Math.max(this.currentState?.trackOrder.length ?? 1, 1);
  }

  private sceneCount(): number {
    return Math.max(this.currentState?.sceneOrder.length ?? 1, 1);
  }

  private getSelectedTrack(): Track | undefined {
    if (!this.currentState) return undefined;
    const trackId = this.currentState.trackOrder[this.selectedTrackIndex];
    return trackId ? this.currentState.tracks[trackId] : undefined;
  }

  private getSelectedScene() {
    if (!this.currentState || this.gridRow < 0) return undefined;
    const sceneId = this.currentState.sceneOrder[this.selectedSceneIndex()];
    return sceneId ? this.currentState.scenes[sceneId] : undefined;
  }

  private selectedClipId(): string {
    return `clip_${this.selectedSceneIndex()}`;
  }

  private selectedSceneIndex(): number {
    return clamp(this.gridRow, 0, this.sceneCount() - 1);
  }

  private isTransportPlaying(): boolean {
    if (!this.currentState) {
      return false;
    }

    if (this.currentState.transport.isPlaying) {
      return true;
    }

    return this.currentState.trackOrder.some((trackId) =>
      Object.values(this.currentState?.tracks[trackId].clips ?? {}).some((clip) => clip.isPlaying),
    );
  }

  private hasAnyClip(): boolean {
    if (!this.currentState) {
      return false;
    }

    return this.currentState.trackOrder.some((trackId) => Object.keys(this.currentState?.tracks[trackId].clips ?? {}).length > 0);
  }

  private async playToggle(): Promise<string> {
    if (this.isTransportPlaying()) {
      const result = await this.service.stopPlayback();
      return result.message;
    }

    const selectedTrack = this.getSelectedTrack();
    const selectedClipId = this.selectedClipId();
    const selectedClip = selectedTrack?.clips[selectedClipId];
    if (selectedTrack && selectedClip) {
      const result = await this.service.fireClip(selectedTrack.id, selectedClipId);
      return result.message;
    }

    const selectedScene = this.getSelectedScene();
    if (selectedScene) {
      const sceneState = await this.service.refreshState();
      const hasSceneClip = sceneState.trackOrder.some((trackId) => Boolean(sceneState.tracks[trackId].clips[`clip_${selectedScene.index}`]));
      if (hasSceneClip) {
        const result = await this.service.fireScene(selectedScene.index);
        return result.message;
      }
    }

    if (this.hasAnyClip() && this.currentState) {
      const firstSceneIndex = this.currentState.sceneOrder.findIndex((sceneId, index) =>
        this.currentState?.trackOrder.some((trackId) => Boolean(this.currentState?.tracks[trackId].clips[`clip_${index}`])),
      );

      if (firstSceneIndex >= 0) {
        const result = await this.service.fireScene(firstSceneIndex);
        return result.message;
      }
    }

    return "Nothing to play yet. Create a clip or scene first.";
  }

  private decorateSessionCell(content: string, selected: boolean): string {
    return selected ? `{black-fg}{cyan-bg}${content}{/cyan-bg}{/black-fg}` : content;
  }

  private renderClipCell(state: "empty" | "filled" | "playing", selected: boolean): string {
    if (selected) {
      return this.decorateSessionCell(CLIP_GLYPH, true);
    }

    if (state === "playing") {
      return `{green-fg}${CLIP_GLYPH}{/green-fg}`;
    }
    if (state === "filled") {
      return `{white-fg}${CLIP_GLYPH}{/white-fg}`;
    }
    return `{gray-fg}${CLIP_GLYPH}{/gray-fg}`;
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
      const result = await this.service.undoLast();
      this.pushStatus(result.message);
    }

    this.restoreGuidedSnapshot(entry.snapshot);
    return "Last guided step undone.";
  }

  private requestPause(): void {
    if (!this.pendingOperation) {
      return;
    }

    if (!this.pendingOperation.cancelable) {
      this.pushStatus("Current action cannot be paused safely.");
      this.renderAll();
      return;
    }

    if (this.cancelRequested) {
      return;
    }

    this.cancelRequested = true;
    this.pushStatus(`Pause requested for ${this.pendingOperation.label}.`);
    this.renderAll();
  }

  private isLocalGuidedChoice(choiceId: string): boolean {
    return (
      choiceId === "prepare_keep" ||
      choiceId === "chain_prompt" ||
      choiceId === "back" ||
      choiceId === "genre_house" ||
      choiceId === "genre_drum_n_bass" ||
      choiceId.startsWith("scale_") ||
      choiceId.startsWith("key_")
    );
  }

  private async runCancelableGuidedAction(
    label: string,
    snapshot: GuidedSnapshot,
    action: (hooks: GuidedActionHooks) => Promise<string>,
    onSuccess: (response: string) => void,
    accumulatedCleanupUndoSteps = 0,
  ): Promise<string> {
    let executedMutations = 0;
    const hooks: GuidedActionHooks = {
      checkPause: () => {
        if (this.cancelRequested) {
          throw new GuidedActionPausedError(executedMutations);
        }
      },
      recordMutation: () => {
        executedMutations += 1;
      },
    };

    try {
      const response = await this.withSpinner(
        "prompt",
        `Prompt: ${label}`,
        async () => {
          const value = await action(hooks);
          onSuccess(value);
          await this.refreshState();
          return value;
        },
        true,
      );
      this.pausedAction = undefined;
      return response;
    } catch (error) {
      if (error instanceof GuidedActionPausedError) {
        const partialMessages = error.messages ?? [];
        partialMessages.forEach((message) => this.pushStatus(message));
        this.pausedAction = {
          label,
          cleanupUndoSteps: accumulatedCleanupUndoSteps + error.executedMutations,
          partialMessages,
          snapshot,
          action,
          onSuccess,
        };
        this.openPausedActionOptions();
        this.pushStatus(`Paused ${label}. ${partialMessages.length} change message${partialMessages.length === 1 ? "" : "s"} captured.`);
        this.pushConversation(`• Paused ${label}.`);
        return `Paused ${label}.`;
      }
      throw error;
    } finally {
      this.cancelRequested = false;
    }
  }

  private setAgentPrompt(
    question: string,
    helperText: string | undefined,
    options: AgentOption[],
    mode: ExtendedGuidedMode,
  ): void {
    this.agentQuestion = question;
    this.agentHelperText = helperText;
    this.agentOptions =
      mode === "free" || mode === "custom_input"
        ? options
        : [...options, { id: "type_something_else", label: "Type something else", enabled: true }];
    this.agentMode = mode;
    this.selectedAgentOptionIndex = this.defaultAgentOptionIndex(this.agentOptions);
  }

  private openPrepareOptions(): void {
    this.setAgentPrompt(
      "How do you want to start?",
      "Pick a suggestion below, or type what you want.",
      [
        { id: "prepare_clear", label: "Clear the current set", enabled: true },
        { id: "prepare_keep", label: "Keep what is already in Live", enabled: true },
      ],
      "prepare",
    );
  }

  private openGenreOptions(): void {
    this.setAgentPrompt(
      "Pick a genre.",
      "This fixed starter uses curated instruments, clips and scene order.",
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

    this.setAgentPrompt(
      `${getGenreLabel(genreId)}: pick a scale.`,
      "This fixed guide uses the chosen key to transpose the harmonic material.",
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

    this.setAgentPrompt(
      `${getGenreLabel(genreId)} ${scaleMode}: pick a key.`,
      "These keys are fixed for the current prototype.",
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

    this.setAgentPrompt(
      `${getGenreLabel(genreId)}: what should we build next?`,
      "Pick an element or an arrangement step. New elements fill the scenes that already exist.",
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

    const chainOptions = getChainOptions(genreId);
    const undoOption = this.guidedHistory.length > 0 ? [{ id: "guided_undo", label: "Undo", enabled: true }] : [];
    this.setAgentPrompt(
      "Do you want to chain the scenes?",
      "Pick one fixed scene order. For now, the selection is saved and the first scene is fired; auto-advance comes next.",
      [
        ...chainOptions.map((option) => ({ id: `chain_${option.id}`, label: option.label, enabled: true })),
        ...undoOption,
        { id: "back", label: "Back", enabled: true },
      ],
      "chain",
    );
  }

  private openFreeMode(): void {
    this.setAgentPrompt(
      "Free command mode.",
      "Type what you want, or type `suggest` to reopen the guided starters.",
      [],
      "free",
    );
  }

  private openCustomPromptEntry(): void {
    this.promptReturnState = this.captureAgentViewState();
    this.setAgentPrompt(
      "",
      undefined,
      [],
      "custom_input",
    );
    this.openPromptEditor();
  }

  private openPausedActionOptions(): void {
    const cleanupUndoSteps = this.pausedAction?.cleanupUndoSteps ?? 0;
    this.setAgentPrompt(
      "Action paused.",
      cleanupUndoSteps > 0
        ? `Review the partial progress. ${this.pausedAction?.partialMessages.length ?? 0} change message${(this.pausedAction?.partialMessages.length ?? 0) === 1 ? "" : "s"} captured so far. Clean up will attempt ${cleanupUndoSteps} undo step${cleanupUndoSteps === 1 ? "" : "s"}.`
        : "Review the partial progress and choose whether to continue or clean it up.",
      [
        { id: "paused_continue", label: "Continue paused action", enabled: true },
        { id: "paused_cleanup", label: "Clean up paused action", enabled: true },
      ],
      "build",
    );
  }

  private async tryHandleGuidedInput(input: string): Promise<string | undefined> {
    if (this.agentOptions.length === 0) {
      return undefined;
    }

    const normalized = input.trim().toLowerCase();
    const choice = this.agentOptions.find((option, index) =>
      normalized === String(index + 1) ||
      normalized === option.id.toLowerCase() ||
      normalized === option.label.toLowerCase(),
    );

    if (!choice) {
      return undefined;
    }

    if (!choice.enabled) {
      return `${choice.label} is disabled for now. I left it visible to make the roadmap explicit.`;
    }

    if (choice.id === "type_something_else") {
      this.openCustomPromptEntry();
      return "Type something or `go back`.";
    }

    if (choice.id === "paused_continue") {
      if (!this.pausedAction) {
        return "No paused action.";
      }

      const paused = this.pausedAction;
      return this.runCancelableGuidedAction(
        paused.label,
        paused.snapshot,
        paused.action,
        paused.onSuccess,
        paused.cleanupUndoSteps,
      );
    }

    if (choice.id === "paused_cleanup") {
      if (!this.pausedAction) {
        return "No paused action.";
      }

      const paused = this.pausedAction;
      return this.withSpinner("prompt", "Clean up paused action", async () => {
        for (let index = 0; index < paused.cleanupUndoSteps; index += 1) {
          const result = await this.service.undoLast();
          this.pushStatus(result.message);
        }
        this.restoreGuidedSnapshot(paused.snapshot);
        this.pausedAction = undefined;
        await this.refreshState("Paused action cleaned up.");
        return "Paused action cleaned up.";
      });
    }

    if (choice.id === "prepare_clear") {
      const snapshot = this.captureGuidedSnapshot("prepare");
      this.guidedState = createGuidedSessionState();
      return this.runCancelableGuidedAction(
        choice.label,
        snapshot,
        async (hooks) => {
          const messages = await clearSessionForGuidedStart(this.service, hooks);
          messages.forEach((message) => this.pushStatus(message));
          return "Cleared the current set. Pick a genre.";
        },
        () => {
          this.guidedHistory.push({ snapshot, undoSteps: 1 });
          this.openGenreOptions();
        },
      );
    }

    if (choice.id === "prepare_keep") {
      this.guidedState = createGuidedSessionState();
      this.openGenreOptions();
      return "Keeping the current set. Pick a genre.";
    }

    if (choice.id === "genre_house" || choice.id === "genre_drum_n_bass") {
      const genreId: GuidedGenreId = choice.id === "genre_house" ? "house" : "drum_n_bass";
      this.guidedState = {
        ...this.guidedState,
        genre: genreId,
      };
      this.openScaleModeOptions();
      return `${getGenreLabel(genreId)} selected. Tempo will be applied on the first build step.`;
    }

    if (choice.id === "scale_minor" || choice.id === "scale_major") {
      const scaleMode: GuidedScaleMode = choice.id === "scale_minor" ? "minor" : "major";
      this.guidedState = chooseScaleMode(this.guidedState, scaleMode);
      this.openKeyOptions();
      return `${scaleMode === "minor" ? "Minor" : "Major"} selected.`;
    }

    if (choice.id.startsWith("key_")) {
      const key = choice.id.replace("key_", "");
      this.guidedState = chooseKey(this.guidedState, key);
      this.openBuildOptions();
      return `Key ${key} selected.`;
    }

    if (choice.id === "guided_undo") {
      return this.performGuidedUndo();
    }

    if (choice.id.startsWith("foundation_")) {
      const stepId = choice.id.replace("foundation_", "");
      if (!isGuidedFoundationId(stepId)) return "Unknown foundation step.";
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const snapshot = this.captureGuidedSnapshot("build");
      return this.runCancelableGuidedAction(
        choice.label,
        snapshot,
        async (hooks) => {
          const messages = await applyFoundationStep(this.service, genreId, this.guidedState, stepId, hooks);
          messages.forEach((message) => this.pushStatus(message));
          return `${choice.label} done.`;
        },
        () => {
          this.guidedHistory.push({ snapshot, undoSteps: 1 });
          this.guidedState = markFoundationCompleted(this.guidedState, stepId);
          this.openBuildOptions();
        },
      );
    }

    if (choice.id.startsWith("continuation_")) {
      const stepId = choice.id.replace("continuation_", "");
      if (!isGuidedContinuationId(stepId)) return "Unknown continuation step.";
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const snapshot = this.captureGuidedSnapshot("build");
      return this.runCancelableGuidedAction(
        choice.label,
        snapshot,
        async (hooks) => {
          const messages = await applyContinuationStep(this.service, genreId, this.guidedState, stepId, hooks);
          messages.forEach((message) => this.pushStatus(message));
          return `${choice.label} done.`;
        },
        () => {
          this.guidedHistory.push({ snapshot, undoSteps: 1 });
          this.guidedState = markContinuationCompleted(this.guidedState, stepId);
          this.openBuildOptions();
        },
      );
    }

    if (choice.id === "chain_prompt") {
      this.openChainOptions();
      return "Pick a fixed chain.";
    }

    if (choice.id.startsWith("chain_")) {
      const chainId = choice.id.replace("chain_", "");
      if (!isGuidedChainId(chainId)) return "Unknown chain.";
      const genreId = this.guidedState.genre;
      if (!genreId) {
        this.openGenreOptions();
        return "Choose a genre first.";
      }

      const snapshot = this.captureGuidedSnapshot("chain");
      return this.runCancelableGuidedAction(
        choice.label,
        snapshot,
        async (hooks) => {
          const messages = await applyChainChoice(this.service, genreId, chainId, hooks);
          messages.forEach((message) => this.pushStatus(message));
          return `${choice.label} selected.`;
        },
        () => {
          this.guidedHistory.push({ snapshot, undoSteps: 1 });
          this.guidedState = selectChain(this.guidedState, chainId);
          this.openFreeMode();
        },
      );
    }

    if (choice.id === "back") {
      if (this.agentMode === "genre") {
        this.openPrepareOptions();
        return "Back to set preparation.";
      }
      if (this.agentMode === "scale_mode") {
        this.openGenreOptions();
        return "Back to genre selection.";
      }
      if (this.agentMode === "key") {
        this.openScaleModeOptions();
        return "Back to scale selection.";
      }
      if (this.agentMode === "build") {
        this.openKeyOptions();
        return "Back to key selection.";
      }
      if (this.agentMode === "chain") {
        this.openBuildOptions();
        return "Back to build options.";
      }
    }

    return undefined;
  }

  private spinnerFrame(): string {
    return SPINNER_FRAMES[this.spinnerIndex % SPINNER_FRAMES.length];
  }

  private currentPromptPanelHeight(): number {
    return measurePromptPanelHeight(
      {
        question: this.agentQuestion,
        helperText: this.agentHelperText,
        options: this.agentOptions,
        selectedIndex: this.selectedAgentOptionIndex,
        highlightSelection: this.focusArea === "agent" && !this.isPromptOpen,
        promptDraft: this.promptDraft,
        isPromptOpen: this.isPromptOpen,
        cursorVisible: this.cursorBlinkVisible,
      },
      MIN_PROMPT_HEIGHT,
      MAX_PROMPT_HEIGHT,
    );
  }

  private currentDebugPanelHeight(): number {
    const screenHeight = typeof this.screen.height === "number" ? this.screen.height : Number(this.screen.height ?? 0);
    const proposed = Math.floor(screenHeight * DEBUG_HEIGHT_RATIO);
    return clamp(proposed, MIN_DEBUG_HEIGHT, MAX_DEBUG_HEIGHT);
  }

  private pushConversation(message: string): void {
    this.conversationLines.push(message);
    debugLog("tui:conversation", message);
  }

  private pushStatus(message: string, options?: { log?: boolean }): void {
    this.statusLines.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (options?.log !== false) {
      debugLog("tui:status", message);
    }
  }

  private handleServiceEvent(event: WizardCompanionEvent): void {
    if (event.type === "debug") {
      this.pushStatus(`[${event.scope}] ${event.message}`, { log: false });
      this.renderAll();
      return;
    }

    if (event.type === "operation") {
      const marker = event.phase === "start" ? "▶" : event.phase === "success" ? "✓" : "✕";
      this.pushStatus(`${marker} ${event.action}`, { log: false });
      this.renderAll();
      return;
    }

    this.pushStatus(event.message, { log: false });
    this.renderAll();
  }

  private async safeRun(label: string, fn: () => Promise<void>): Promise<void> {
    if (this.pendingOperation) {
      const message = `Busy: ${this.pendingOperation.label}`;
      debugLog("tui", "safe_run:busy", { label, pendingOperation: this.pendingOperation });
      this.pushStatus(message);
      this.renderAll();
      return;
    }
    try {
      debugLog("tui", "safe_run:start", { label });
      await fn();
      debugLog("tui", "safe_run:success", { label });
    } catch (error) {
      const message = `${label} failed: ${(error as Error).message}`;
      debugLog("tui", "safe_run:error", { label, error });
      this.pushStatus(message);
      this.pushConversation(`• ${message}`);
      this.renderAll();
    }
  }

  private async withSpinner<T>(
    key: string,
    label: string,
    fn: () => Promise<T>,
    cancelable = false,
  ): Promise<T> {
    if (this.pendingOperation) {
      throw new Error(`Operation already in progress: ${this.pendingOperation.label}`);
    }

    this.pendingOperation = { key, label, cancelable };
    this.cancelRequested = false;
    this.spinnerIndex = 0;
    this.promptBox.setLabel(key === "prompt" ? ` Input ${this.spinnerFrame()} ` : " Input ");
    this.spinnerTimer = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER_FRAMES.length;
      this.promptBox.setLabel(this.pendingOperation?.key === "prompt" ? ` Input ${this.spinnerFrame()} ` : " Input ");
      this.renderAll();
    }, 100);

    debugLog("tui", "spinner:start", { key, label });
    this.renderAll();

    try {
      return await fn();
    } finally {
      if (this.spinnerTimer) {
        clearInterval(this.spinnerTimer);
        this.spinnerTimer = undefined;
      }
      debugLog("tui", "spinner:stop", { key, label });
      this.pendingOperation = undefined;
      this.cancelRequested = false;
      this.promptBox.setLabel(" Input ");
      this.renderAll();
    }
  }

  private handlePromptKeypress(ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg): void {
    if (key.full === "escape") {
      this.promptDraft = "";
      this.promptCursorIndex = 0;
      this.isPromptOpen = false;
      this.stopCursorBlink();
      this.focusAgent();
      return;
    }

    if (isModifiedNewlineKey(key)) {
      this.insertPromptText("\n");
      this.renderAll();
      return;
    }

    if (key.name === "enter") {
      void this.handlePromptSubmit(this.promptDraft);
      return;
    }

    if ((key.meta && key.name === "left") || key.full === "M-left" || key.full === "M-b") {
      this.movePromptCursorByWord(-1);
      return;
    }

    if ((key.meta && key.name === "right") || key.full === "M-right" || key.full === "M-f") {
      this.movePromptCursorByWord(1);
      return;
    }

    if (key.name === "left") {
      this.movePromptCursorByChar(-1);
      return;
    }

    if (key.name === "right") {
      this.movePromptCursorByChar(1);
      return;
    }

    if (key.name === "up") {
      this.movePromptCursorVertically(-1);
      return;
    }

    if (key.name === "down") {
      this.movePromptCursorVertically(1);
      return;
    }

    if (key.name === "home" || key.full === "C-a") {
      this.movePromptCursorToLineEdge("start");
      return;
    }

    if (key.name === "end" || key.full === "C-e") {
      this.movePromptCursorToLineEdge("end");
      return;
    }

    if (key.name === "backspace") {
      this.deletePromptBackward();
      return;
    }

    if (key.name === "delete") {
      this.deletePromptForward();
      return;
    }

    if (key.ctrl && key.name === "u") {
      this.promptDraft = "";
      this.promptCursorIndex = 0;
      this.renderAll();
      return;
    }

    if (key.name === "tab") {
      return;
    }

    if (ch && /^[\x20-\x7E]$/.test(ch)) {
      this.insertPromptText(ch);
    }
  }

  private insertPromptText(text: string): void {
    this.promptDraft =
      `${this.promptDraft.slice(0, this.promptCursorIndex)}${text}${this.promptDraft.slice(this.promptCursorIndex)}`;
    this.promptCursorIndex += text.length;
    this.panePinnedToBottom.input = true;
    this.renderAll();
  }

  private deletePromptBackward(): void {
    if (this.promptCursorIndex === 0) {
      return;
    }
    this.promptDraft =
      `${this.promptDraft.slice(0, this.promptCursorIndex - 1)}${this.promptDraft.slice(this.promptCursorIndex)}`;
    this.promptCursorIndex -= 1;
    this.renderAll();
  }

  private deletePromptForward(): void {
    if (this.promptCursorIndex >= this.promptDraft.length) {
      return;
    }
    this.promptDraft =
      `${this.promptDraft.slice(0, this.promptCursorIndex)}${this.promptDraft.slice(this.promptCursorIndex + 1)}`;
    this.renderAll();
  }

  private movePromptCursorByChar(delta: -1 | 1): void {
    this.promptCursorIndex = clamp(this.promptCursorIndex + delta, 0, this.promptDraft.length);
    this.panePinnedToBottom.input = true;
    this.renderAll();
  }

  private movePromptCursorToLineEdge(edge: "start" | "end"): void {
    const { lineStart, lineEnd } = this.getPromptCursorLineBounds();
    this.promptCursorIndex = edge === "start" ? lineStart : lineEnd;
    this.panePinnedToBottom.input = true;
    this.renderAll();
  }

  private movePromptCursorVertically(delta: -1 | 1): void {
    const lines = this.promptDraft.split("\n");
    const { lineIndex, column } = this.getPromptCursorPosition();
    const targetLineIndex = clamp(lineIndex + delta, 0, Math.max(lines.length - 1, 0));
    const targetLineLength = (lines[targetLineIndex] ?? "").length;
    const targetColumn = clamp(column, 0, targetLineLength);

    let nextIndex = 0;
    for (let index = 0; index < targetLineIndex; index += 1) {
      nextIndex += (lines[index] ?? "").length + 1;
    }
    nextIndex += targetColumn;

    this.promptCursorIndex = clamp(nextIndex, 0, this.promptDraft.length);
    this.panePinnedToBottom.input = true;
    this.renderAll();
  }

  private movePromptCursorByWord(direction: -1 | 1): void {
    if (direction < 0) {
      let index = this.promptCursorIndex;
      while (index > 0 && /\s/.test(this.promptDraft[index - 1] ?? "")) {
        index -= 1;
      }
      while (index > 0 && !/\s/.test(this.promptDraft[index - 1] ?? "")) {
        index -= 1;
      }
      this.promptCursorIndex = index;
    } else {
      let index = this.promptCursorIndex;
      while (index < this.promptDraft.length && /\s/.test(this.promptDraft[index] ?? "")) {
        index += 1;
      }
      while (index < this.promptDraft.length && !/\s/.test(this.promptDraft[index] ?? "")) {
        index += 1;
      }
      this.promptCursorIndex = index;
    }

    this.panePinnedToBottom.input = true;
    this.renderAll();
  }

  private getPromptCursorPosition(): { lineIndex: number; column: number } {
    const beforeCursor = this.promptDraft.slice(0, this.promptCursorIndex);
    const lines = beforeCursor.split("\n");
    return {
      lineIndex: lines.length - 1,
      column: lines.at(-1)?.length ?? 0,
    };
  }

  private getPromptCursorLineBounds(): { lineStart: number; lineEnd: number } {
    const beforeCursor = this.promptDraft.slice(0, this.promptCursorIndex);
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    const nextBreak = this.promptDraft.indexOf("\n", this.promptCursorIndex);
    return {
      lineStart,
      lineEnd: nextBreak === -1 ? this.promptDraft.length : nextBreak,
    };
  }

  private defaultAgentOptionIndex(options: AgentOption[]): number {
    const firstEnabled = options.findIndex((option) => option.enabled);
    return firstEnabled >= 0 ? firstEnabled : 0;
  }

  private navigateAgent(direction: "up" | "down"): void {
    if (this.agentOptions.length === 0) {
      return;
    }

    if (direction === "up") {
      this.selectedAgentOptionIndex = clamp(this.selectedAgentOptionIndex - 1, 0, this.agentOptions.length - 1);
    } else {
      this.selectedAgentOptionIndex = clamp(this.selectedAgentOptionIndex + 1, 0, this.agentOptions.length - 1);
    }

    this.renderAll();
  }

  private async activateAgentSelection(): Promise<void> {
    const option = this.agentOptions[this.selectedAgentOptionIndex];
    if (!option) {
      this.openPromptEditor();
      return;
    }

    try {
      if (option.id !== "type_something_else" && option.id !== "prompt_go_back") {
        this.pushConversation(`> ${option.label}`);
      }
      const response = await this.tryHandleGuidedInput(option.id);
      if (response) {
        this.pushConversation(`• ${response}`);
        if (this.isLocalGuidedChoice(option.id)) {
          this.renderAll();
        }
      } else {
        this.pushConversation(`• ${option.label} is not implemented yet.`);
      }
    } catch (error) {
      const message = `Prompt error: ${(error as Error).message}`;
      this.pushConversation(`• ${message}`);
      this.pushStatus(message);
    }

    this.focusAgent();
  }

  private openPromptEditor(seed = ""): void {
    this.focusArea = "agent";
    this.isPromptOpen = true;
    this.sidebarPane = "input";
    this.promptDraft = seed;
    this.promptCursorIndex = seed.length;
    this.selectedAgentOptionIndex = -1;
    this.panePinnedToBottom.input = true;
    this.startCursorBlink();
    this.renderAll();
    this.screen.focusPush(this.promptBox);
  }

  private cycleSidebarPane(direction: -1 | 1): void {
    const panes: SidebarPane[] = ["chat", "input", "debug"];
    const currentIndex = panes.indexOf(this.sidebarPane);
    const nextIndex = (currentIndex + direction + panes.length) % panes.length;
    this.sidebarPane = panes[nextIndex];
    this.renderAll();
  }

  private scrollSidebarPane(amount: number): void {
    const pane = this.sidebarPane;
    const target = pane === "chat" ? this.conversationBox : pane === "debug" ? this.statusBox : this.promptBox;
    if (amount < 0) {
      this.panePinnedToBottom[pane] = false;
    }
    target.scroll(amount);
    this.screen.render();
  }

  private scrollSidebarPaneTo(edge: "top" | "bottom"): void {
    const pane = this.sidebarPane;
    const target = pane === "chat" ? this.conversationBox : pane === "debug" ? this.statusBox : this.promptBox;
    if (edge === "top") {
      this.panePinnedToBottom[pane] = false;
      target.setScroll(0);
    } else {
      this.panePinnedToBottom[pane] = true;
      target.setScrollPerc(100);
    }
    this.screen.render();
  }

  private shutdown(): void {
    this.unsubscribeService?.();
    this.stopCursorBlink();
    this.screen.destroy();
    process.exit(0);
  }

  private captureAgentViewState(): AgentViewState {
    return {
      question: this.agentQuestion,
      helperText: this.agentHelperText,
      options: this.agentOptions.map((option) => ({ ...option })),
      mode: this.agentMode,
      selectedIndex: this.selectedAgentOptionIndex,
    };
  }

  private restoreAgentViewState(state: AgentViewState): void {
    this.agentQuestion = state.question;
    this.agentHelperText = state.helperText;
    this.agentOptions = state.options.map((option) => ({ ...option }));
    this.agentMode = state.mode;
    this.selectedAgentOptionIndex = state.selectedIndex;
    this.renderAll();
  }

  private restorePromptReturnState(): void {
    if (this.promptReturnState) {
      this.restoreAgentViewState(this.promptReturnState);
      this.promptReturnState = undefined;
      return;
    }
    this.openPrepareOptions();
  }

  private startCursorBlink(): void {
    this.stopCursorBlink();
    this.cursorBlinkVisible = true;
  }

  private stopCursorBlink(): void {
    if (this.cursorBlinkTimer) {
      clearInterval(this.cursorBlinkTimer);
      this.cursorBlinkTimer = undefined;
    }
    this.cursorBlinkVisible = true;
  }
}
