import blessed from "neo-blessed";
import { getBridgeMode } from "../live-bridge/factory.js";
import { WizardMcpServer } from "../mcp/server.js";
import { BasicPatternName, InstrumentRole, LiveState, Track } from "../types.js";
import { buildAgentPanelContent } from "./agent-panel.js";
import { buildPromptPanelContent, measurePromptPanelHeight } from "./prompt-panel.js";
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
  GuidedScaleMode,
  GuidedSessionState,
  markContinuationCompleted,
  markFoundationCompleted,
  selectChain,
} from "../workflows/guided-starter.js";
import { debugLog, getDebugLogPath } from "../util.js";

type FocusArea = "agent" | "session";
type SessionArea = "toolbar" | "grid" | "footer";
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

const ROLE_TO_PATTERN: Record<InstrumentRole, BasicPatternName> = {
  bass: "bass-test",
  lead: "lead-riff",
  pad: "pad-block",
  pluck: "lead-riff",
  keys: "chord-stabs",
  drums: "house-kick",
  fx: "lead-riff",
};

const BASIC_PATTERNS: BasicPatternName[] = [
  "bass-test",
  "lead-riff",
  "pad-block",
  "chord-stabs",
  "house-kick",
  "house-snare",
  "house-hats",
  "house-bass",
  "house-chords",
  "dnb-breakbeat",
  "dnb-kick",
  "dnb-snare",
  "dnb-hats",
  "dnb-bass",
  "dnb-pads",
];
const PROMPT_ROLE_ALIASES: Record<string, InstrumentRole> = {
  b: "bass",
  l: "lead",
  p: "pad",
  d: "drums",
};
const TOOLBAR_ACTIONS: ToolbarAction[] = ["undo", "redo", "tempo_down", "tempo_up", "play_toggle"];
const FOOTER_ACTIONS: FooterAction[] = ["add_track", "add_scene"];
const SPINNER_FRAMES = ["|", "/", "-", "\\"];
const LEFT_WIDTH = "31%";
const RIGHT_WIDTH = "69%";
const MIN_PROMPT_HEIGHT = 7;
const MAX_PROMPT_HEIGHT = 14;
const CLIP_GLYPH = "░░░░░░";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const truncate = (value: string, length: number): string =>
  value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1))}~`;

const renderButton = (label: string, active: boolean): string =>
  active ? `{black-fg}{cyan-bg}[ ${label} ]{/cyan-bg}{/black-fg}` : `[ ${label} ]`;

export class WizardTuiApp {
  private readonly server: WizardMcpServer;
  private readonly screen: blessed.Widgets.Screen;
  private readonly conversationBox: blessed.Widgets.BoxElement;
  private readonly promptBox: blessed.Widgets.BoxElement;
  private readonly transportBox: blessed.Widgets.BoxElement;
  private readonly sessionBox: blessed.Widgets.BoxElement;
  private readonly instructionsBox: blessed.Widgets.BoxElement;
  private readonly statusBox: blessed.Widgets.BoxElement;
  private readonly overlayBox: blessed.Widgets.BoxElement;
  private currentState?: LiveState;
  private focusArea: FocusArea = "session";
  private sessionArea: SessionArea = "grid";
  private toolbarIndex = 0;
  private footerIndex = 0;
  private selectedTrackIndex = 0;
  private gridRow = -1;
  private gridColumn = 0;
  private isPromptOpen = false;
  private readonly conversationLines: string[] = [];
  private readonly statusLines: string[] = [];
  private promptDraft = "";
  private pendingDelete?: { key: string; deadline: number };
  private pendingOperation?: PendingOperation;
  private cancelRequested = false;
  private spinnerIndex = 0;
  private spinnerTimer?: NodeJS.Timeout;
  private agentQuestion?: string;
  private agentHelperText?: string;
  private agentOptions: AgentOption[] = [];
  private selectedAgentOptionIndex = 0;
  private agentMode: GuidedMode = "prepare";
  private guidedState: GuidedSessionState = createGuidedSessionState();
  private readonly guidedHistory: GuidedHistoryEntry[] = [];
  private pausedAction?: PausedAction;

  constructor(server?: WizardMcpServer) {
    this.server = server ?? new WizardMcpServer();
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
      width: LEFT_WIDTH,
      bottom: MIN_PROMPT_HEIGHT,
      border: "line",
      label: " Agent ",
      tags: true,
    });

    this.promptBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: LEFT_WIDTH,
      height: MIN_PROMPT_HEIGHT,
      border: "line",
      label: " Input ",
      tags: true,
      mouse: false,
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
      top: 0,
      left: LEFT_WIDTH,
      width: RIGHT_WIDTH,
      height: 5,
      border: "line",
      label: " Session Controls ",
      tags: true,
    });

    this.sessionBox = blessed.box({
      parent: this.screen,
      top: 5,
      left: LEFT_WIDTH,
      width: RIGHT_WIDTH,
      height: "56%",
      border: "line",
      label: " Session View ",
      tags: true,
      scrollable: true,
    });

    this.instructionsBox = blessed.box({
      parent: this.screen,
      top: "61%",
      left: LEFT_WIDTH,
      width: RIGHT_WIDTH,
      height: 7,
      border: "line",
      label: " Instructions ",
      tags: true,
    });

    this.statusBox = blessed.box({
      parent: this.screen,
      top: "61%+7",
      left: LEFT_WIDTH,
      width: RIGHT_WIDTH,
      bottom: 0,
      border: "line",
      label: " Status / Messages ",
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
    this.pushConversation("• Ready. Use `shift+tab` to switch between agent and session.");
    this.pushConversation("• Press `enter` on a track, clip or scene to select it and jump to chat.");
    this.guidedState = createGuidedSessionState();
    this.guidedHistory.length = 0;
    this.openPrepareOptions();
    this.pushStatus(`Debug log: ${getDebugLogPath()}`);
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
    this.screen.key(["S-tab"], () => {
      if (this.pendingOperation) {
        return;
      }
      this.toggleFocus();
    });
    this.screen.key(["r"], () => {
      if (this.pendingOperation) {
        return;
      }
      void this.safeRun("key:refresh", () => this.refreshState("State refreshed"));
    });

    this.screen.key(["left"], () => {
      if (this.pendingOperation) {
        return;
      }
      this.focusArea === "session" && this.navigateSession("left");
    });
    this.screen.key(["right"], () => {
      if (this.pendingOperation) {
        return;
      }
      this.focusArea === "session" && this.navigateSession("right");
    });
    this.screen.key(["up"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (this.focusArea === "agent" && !this.isPromptOpen) {
        this.navigateAgent("up");
        return;
      }
      if (this.focusArea === "session") {
        this.navigateSession("up");
      }
    });
    this.screen.key(["down"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (this.focusArea === "agent" && !this.isPromptOpen) {
        this.navigateAgent("down");
        return;
      }
      if (this.focusArea === "session") {
        this.navigateSession("down");
      }
    });
    this.screen.key(["enter"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (this.focusArea === "agent" && !this.isPromptOpen) {
        void this.safeRun("key:agent-enter", () => this.activateAgentSelection());
        return;
      }
      if (this.focusArea === "session") {
        void this.safeRun("key:enter", () => this.activateSelection());
      }
    });
    this.screen.key(["backspace"], () => {
      if (this.pendingOperation) {
        return;
      }
      if (this.focusArea === "session") {
        void this.safeRun("key:backspace", () => this.handleDeleteKey());
      }
    });

    this.screen.on("keypress", (ch, key) => {
      if (this.pendingOperation) {
        return;
      }

      if (this.focusArea === "agent" && this.isPromptOpen) {
        this.handlePromptKeypress(ch, key);
        return;
      }

      if (this.focusArea !== "agent" || this.isPromptOpen) {
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
      this.currentState = await this.server.refreshState();
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
    this.renderTransport();
    this.renderSession();
    this.renderInstructions();
    this.renderStatus();
    this.renderFocus();
    this.renderOverlay();
    this.screen.render();
  }

  private renderConversation(): void {
    const screenHeight = typeof this.screen.height === "number" ? this.screen.height : Number(this.screen.height ?? 0);
    const innerHeight = Math.max(1, screenHeight - this.currentPromptPanelHeight() - 2);

    this.conversationBox.setContent(
      buildAgentPanelContent({
        conversationLines: this.conversationLines,
        viewportHeight: innerHeight,
      }),
    );
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
        `Bridge {bold}${getBridgeMode()}{/bold}  Playback ${isPlaying ? "{green-fg}PLAY{/green-fg}" : "{red-fg}STOP{/red-fg}"}  ` +
        `Track ${selectedTrack?.name ?? "-"}  Scene ${selectedScene?.name ?? "-"}  Focus {bold}${this.focusArea === "agent" ? "Agent" : "Session"}{/bold}`,
    );
  }

  private renderPromptInput(): void {
    const promptHeight = this.currentPromptPanelHeight();
    this.promptBox.height = promptHeight;
    this.conversationBox.bottom = promptHeight;
    this.promptBox.setContent(
      buildPromptPanelContent({
        question: this.agentQuestion,
        helperText: this.agentHelperText,
        options: this.agentOptions,
        selectedIndex: this.selectedAgentOptionIndex,
        highlightSelection: this.focusArea === "agent" && !this.isPromptOpen,
        promptDraft: this.promptDraft,
        isPromptOpen: this.isPromptOpen,
      }),
    );
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
        "- In agent, use up/down + enter to pick a guided option; press down past the last option to type\n" +
        "- Use arrows to navigate session buttons, tracks, clips and scenes\n" +
        "- Press enter to select a track, clip or scene and jump to chat for changes\n" +
        `- ${deleteHint}`,
    );
  }

  private renderStatus(): void {
    this.statusBox.setContent(this.statusLines.slice(-8).join("\n"));
  }

  private renderFocus(): void {
    const active = { fg: "cyan" };
    const inactive = { fg: "white" };

    this.conversationBox.style.border = this.focusArea === "agent" ? active : inactive;
    this.promptBox.style.border = this.focusArea === "agent" || this.pendingOperation?.key === "prompt" ? active : inactive;
    this.transportBox.style.border = this.focusArea === "session" && this.sessionArea === "toolbar" ? active : inactive;
    this.sessionBox.style.border = this.focusArea === "session" && this.sessionArea === "grid" ? active : inactive;
    this.instructionsBox.style.border = this.focusArea === "session" && this.sessionArea === "footer" ? active : inactive;
    this.statusBox.style.border = inactive;
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
        const result = await this.server.fireScene(this.selectedSceneIndex());
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
        const result = await this.server.undoLast();
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      if (action === "redo") {
        const result = await this.server.redoLast();
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      if (action === "tempo_down") {
        const result = await this.server.setTempo(Math.max(20, bpm - 1));
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }
      if (action === "tempo_up") {
        const result = await this.server.setTempo(Math.min(300, bpm + 1));
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
        const result = await this.server.applyOperation("create_track", { name });
        this.pushStatus(result.message);
        await this.refreshState();
        return;
      }

      const name = `Scene ${this.sceneCount() + 1}`;
      const result = await this.server.applyOperation("create_scene", { name });
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
          const result = await this.server.applyOperation("delete_track", { trackRef: track.id });
          this.pushStatus(result.message);
        },
      };
    }

    if (targetKind === "clip" && track && clip) {
      return {
        key: `clip:${track.id}:${clipId}`,
        label: `clip ${track.name}/${clipId}`,
        run: async () => {
          const result = await this.server.applyOperation("delete_clip", {
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
          const result = await this.server.applyOperation("delete_scene", { sceneRef: scene.id });
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
    this.isPromptOpen = false;

    if (!input) {
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

    this.focusAgent();
  }

  private async executePrompt(input: string): Promise<string> {
    debugLog("tui", "execute_prompt:start", {
      input,
      selectedTrack: this.getSelectedTrack()?.id,
      selectedScene: this.getSelectedScene()?.id,
      selectedClipId: this.selectedClipId(),
    });
    const selectedTrack = this.getSelectedTrack();
    const selectedScene = this.getSelectedScene();
    const selectedClipId = this.selectedClipId();
    const promptRoleAlias = PROMPT_ROLE_ALIASES[input];
    const guidedResponse = await this.tryHandleGuidedInput(input);

    if (guidedResponse) {
      return guidedResponse;
    }

    if (input === "help") {
      return "Commands: suggest, play, stop, undo, redo, tempo <n|+|->, scene play, clip play, create track [name], create scene [name], delete track, delete clip, delete scene, instrument <role|query>, create clip [bars], pattern <name> [bars], b/l/p/d.";
    }
    if (input === "suggest") {
      this.guidedState = createGuidedSessionState();
      this.guidedHistory.length = 0;
      this.openPrepareOptions();
      return "Suggestions reopened.";
    }
    if (input === "refresh") {
      await this.refreshState("State refreshed");
      return "State refreshed";
    }
    if (input === "play") {
      return this.playToggle();
    }
    if (input === "stop") {
      const result = await this.server.stopPlayback();
      return result.message;
    }
    if (input === "undo") {
      return (await this.server.undoLast()).message;
    }
    if (input === "redo") {
      return (await this.server.redoLast()).message;
    }
    if (input === "scene play") {
      return (await this.server.fireScene(this.selectedSceneIndex())).message;
    }
    if (input === "clip play") {
      if (!selectedTrack) throw new Error("No selected track");
      return (await this.server.fireClip(selectedTrack.id, selectedClipId)).message;
    }
    if (promptRoleAlias) {
      if (!selectedTrack) throw new Error("No selected track");
      return (
        await this.server.applyOperation("select_instrument", {
          trackRef: selectedTrack.id,
          value: promptRoleAlias,
        })
      ).message;
    }
    if (input === "create track") {
      const name = `Track ${this.trackCount() + 1}`;
      return (await this.server.applyOperation("create_track", { name })).message;
    }
    if (input.startsWith("create track ")) {
      const name = input.slice("create track ".length).trim();
      if (!name) {
        throw new Error("Track name cannot be empty");
      }
      return (await this.server.applyOperation("create_track", { name })).message;
    }
    if (input === "create scene") {
      const name = `Scene ${this.sceneCount() + 1}`;
      return (await this.server.applyOperation("create_scene", { name })).message;
    }
    if (input.startsWith("create scene ")) {
      const name = input.slice("create scene ".length).trim();
      if (!name) {
        throw new Error("Scene name cannot be empty");
      }
      return (await this.server.applyOperation("create_scene", { name })).message;
    }
    if (input === "delete track") {
      if (!selectedTrack) throw new Error("No selected track");
      return (await this.server.applyOperation("delete_track", { trackRef: selectedTrack.id })).message;
    }
    if (input === "delete clip") {
      if (!selectedTrack) throw new Error("No selected track");
      return (
        await this.server.applyOperation("delete_clip", {
          trackRef: selectedTrack.id,
          clipRef: selectedClipId,
        })
      ).message;
    }
    if (input === "delete scene") {
      if (!selectedScene) throw new Error("No selected scene");
      return (await this.server.applyOperation("delete_scene", { sceneRef: selectedScene.id })).message;
    }
    if (input.startsWith("instrument ")) {
      if (!selectedTrack) throw new Error("No selected track");
      const value = input.slice("instrument ".length).trim();
      return (
        await this.server.applyOperation("select_instrument", {
          trackRef: selectedTrack.id,
          value,
        })
      ).message;
    }
    if (input.startsWith("tempo ")) {
      const raw = input.slice("tempo ".length).trim();
      const currentBpm = this.currentState?.transport.bpm ?? 120;
      const bpm = raw === "+" ? currentBpm + 1 : raw === "-" ? currentBpm - 1 : Number(raw);
      if (!Number.isFinite(bpm)) {
        throw new Error(`Invalid tempo value: ${raw}`);
      }
      return (await this.server.setTempo(clamp(Math.round(bpm), 20, 300))).message;
    }
    if (input.startsWith("create clip")) {
      if (!selectedTrack) throw new Error("No selected track");
      const barsRaw = input.slice("create clip".length).trim();
      const bars = barsRaw ? Number(barsRaw) : 4;
      if (!Number.isFinite(bars) || bars <= 0) {
        throw new Error(`Invalid bar count: ${barsRaw}`);
      }
      return (
        await this.server.applyOperation("create_midi_clip", {
          trackRef: selectedTrack.id,
          clipRef: selectedClipId,
          bars,
        })
      ).message;
    }
    if (input.startsWith("pattern ")) {
      if (!selectedTrack) throw new Error("No selected track");
      const parts = input.slice("pattern ".length).trim().split(/\s+/);
      const maybePattern = parts[0] as BasicPatternName;
      if (!BASIC_PATTERNS.includes(maybePattern)) {
        throw new Error(`Unknown pattern: ${maybePattern}`);
      }
      const bars = parts[1] ? Number(parts[1]) : undefined;
      return (
        await this.server.applyOperation("write_basic_notes", {
          trackRef: selectedTrack.id,
          clipRef: selectedClipId,
          pattern: maybePattern,
          bars,
        })
      ).message;
    }

    throw new Error(`Unknown prompt command: ${input}`);
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
      const result = await this.server.stopPlayback();
      return result.message;
    }

    const selectedTrack = this.getSelectedTrack();
    const selectedClipId = this.selectedClipId();
    const selectedClip = selectedTrack?.clips[selectedClipId];
    if (selectedTrack && selectedClip) {
      const result = await this.server.fireClip(selectedTrack.id, selectedClipId);
      return result.message;
    }

    const selectedScene = this.getSelectedScene();
    if (selectedScene) {
      const sceneState = await this.server.refreshState();
      const hasSceneClip = sceneState.trackOrder.some((trackId) => Boolean(sceneState.tracks[trackId].clips[`clip_${selectedScene.index}`]));
      if (hasSceneClip) {
        const result = await this.server.fireScene(selectedScene.index);
        return result.message;
      }
    }

    if (this.hasAnyClip() && this.currentState) {
      const firstSceneIndex = this.currentState.sceneOrder.findIndex((sceneId, index) =>
        this.currentState?.trackOrder.some((trackId) => Boolean(this.currentState?.tracks[trackId].clips[`clip_${index}`])),
      );

      if (firstSceneIndex >= 0) {
        const result = await this.server.fireScene(firstSceneIndex);
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
      const result = await this.server.undoLast();
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
    mode: GuidedMode,
  ): void {
    this.agentQuestion = question;
    this.agentHelperText = helperText;
    this.agentOptions = options;
    this.agentMode = mode;
    this.selectedAgentOptionIndex = this.defaultAgentOptionIndex(options);
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
          const result = await this.server.undoLast();
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
          const messages = await clearSessionForGuidedStart(this.server, hooks);
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
      const stepId = choice.id.replace("foundation_", "") as GuidedFoundationId;
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
          const messages = await applyFoundationStep(this.server, genreId, this.guidedState, stepId, hooks);
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
      const stepId = choice.id.replace("continuation_", "") as GuidedContinuationId;
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
          const messages = await applyContinuationStep(this.server, genreId, this.guidedState, stepId, hooks);
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
      const chainId = choice.id.replace("chain_", "") as GuidedChainId;
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
          const messages = await applyChainChoice(this.server, genreId, chainId, hooks);
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
      },
      MIN_PROMPT_HEIGHT,
      MAX_PROMPT_HEIGHT,
    );
  }

  private pushConversation(message: string): void {
    this.conversationLines.push(message);
    debugLog("tui:conversation", message);
  }

  private pushStatus(message: string): void {
    this.statusLines.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    debugLog("tui:status", message);
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
      this.isPromptOpen = false;
      this.focusAgent();
      return;
    }

    if (key.name === "up" && this.promptDraft.length === 0 && this.agentOptions.length > 0) {
      this.isPromptOpen = false;
      this.selectedAgentOptionIndex = this.agentOptions.length - 1;
      this.renderAll();
      return;
    }

    if ((key.full === "S-enter" || (key.shift && key.name === "enter")) || key.full === "M-enter" || key.full === "C-j") {
      this.promptDraft += "\n";
      this.renderAll();
      return;
    }

    if (key.name === "enter") {
      void this.handlePromptSubmit(this.promptDraft);
      return;
    }

    if (key.name === "backspace") {
      this.promptDraft = Array.from(this.promptDraft).slice(0, -1).join("");
      this.renderAll();
      return;
    }

    if (key.ctrl && key.name === "u") {
      this.promptDraft = "";
      this.renderAll();
      return;
    }

    if (key.name === "tab" || key.name === "down" || key.name === "left" || key.name === "right") {
      return;
    }

    if (ch && /^[\x20-\x7E]$/.test(ch)) {
      this.promptDraft += ch;
      this.renderAll();
    }
  }

  private defaultAgentOptionIndex(options: AgentOption[]): number {
    const firstEnabled = options.findIndex((option) => option.enabled);
    return firstEnabled >= 0 ? firstEnabled : 0;
  }

  private navigateAgent(direction: "up" | "down"): void {
    const hasPromptChoice = this.agentOptions.length > 0;
    const maxIndex = hasPromptChoice ? this.agentOptions.length : Math.max(this.agentOptions.length - 1, 0);

    if (this.agentOptions.length === 0) {
      return;
    }

    if (direction === "up") {
      this.selectedAgentOptionIndex = clamp(this.selectedAgentOptionIndex - 1, 0, maxIndex);
    } else {
      if (hasPromptChoice && this.selectedAgentOptionIndex >= this.agentOptions.length - 1) {
        this.selectedAgentOptionIndex = this.agentOptions.length;
        this.openPromptEditor();
        return;
      }
      this.selectedAgentOptionIndex = clamp(this.selectedAgentOptionIndex + 1, 0, maxIndex);
    }

    this.renderAll();
  }

  private async activateAgentSelection(): Promise<void> {
    if (this.agentOptions.length > 0 && this.selectedAgentOptionIndex === this.agentOptions.length) {
      this.openPromptEditor();
      return;
    }

    const option = this.agentOptions[this.selectedAgentOptionIndex];
    if (!option) {
      this.openPromptEditor();
      return;
    }

    this.pushConversation(`> ${option.label}`);

    try {
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
    this.promptDraft = seed;
    if (this.agentOptions.length > 0) {
      this.selectedAgentOptionIndex = this.agentOptions.length;
    }
    this.renderAll();
    this.screen.focusPush(this.promptBox);
  }

  private shutdown(): void {
    this.screen.destroy();
    process.exit(0);
  }
}
