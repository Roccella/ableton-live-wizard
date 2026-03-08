import { app, BrowserWindow, ipcMain, screen } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalWizardCompanionService } from "../companion/local-service.js";
import { getDebugLogPath } from "../util.js";
import { ElectronChatSession } from "./chat-session.js";
import { summarizeLiveState } from "./shared.js";

app.setName("Ableton Live Wizard");

// Set debug log path before any module calls debugLog, so util.ts picks up
// the correct cross-platform path instead of the macOS-only fallback.
if (!process.env.WIZARD_DEBUG_LOG_PATH) {
  process.env.WIZARD_DEBUG_LOG_PATH = path.join(app.getPath("userData"), "logs", "wizard-debug.log");
}

const mainLogPath = process.env.WIZARD_ELECTRON_MAIN_LOG_PATH
  ?? path.join(app.getPath("userData"), "logs", "electron-main.log");

let mainLogDirEnsured = false;
const logMain = (message: string, payload?: unknown): void => {
  const line =
    payload === undefined
      ? `[${new Date().toISOString()}] ${message}\n`
      : `[${new Date().toISOString()}] ${message} ${JSON.stringify(payload)}\n`;
  try {
    if (!mainLogDirEnsured) {
      fs.mkdirSync(path.dirname(mainLogPath), { recursive: true });
      mainLogDirEnsured = true;
    }
    fs.appendFileSync(mainLogPath, line, "utf8");
  } catch {
    // Startup logging must not crash the app.
  }
  console.log(line.trimEnd());
};

const service = new LocalWizardCompanionService();
const chatSession = new ElectronChatSession(service);

let mainWindow: BrowserWindow | undefined;

const bringWindowToFront = (window: BrowserWindow): void => {
  window.center();
  window.show();
  window.focus();
  window.moveTop();
  app.focus({ steal: true });
};

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const defaultWindowBounds = {
  width: 430,
  height: 920,
};

type WindowState = typeof defaultWindowBounds & {
  x?: number;
  y?: number;
};

const clampWindowState = (state: WindowState): WindowState => {
  if (state.x === undefined || state.y === undefined) {
    return {
      width: state.width,
      height: state.height,
    };
  }

  const windowX = state.x;
  const windowY = state.y;

  const displays = screen.getAllDisplays();
  const isVisibleOnAnyDisplay = displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return windowX < x + width && windowX + state.width > x && windowY < y + height && windowY + state.height > y;
  });

  if (isVisibleOnAnyDisplay) {
    return state;
  }

  const primary = screen.getPrimaryDisplay().workArea;
  return {
    width: Math.min(state.width, primary.width),
    height: Math.min(state.height, primary.height),
  };
};

const getWindowStatePath = (): string => path.join(app.getPath("userData"), "window-state.json");

const loadWindowState = (): WindowState => {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    return {
      width: typeof parsed.width === "number" ? parsed.width : defaultWindowBounds.width,
      height: typeof parsed.height === "number" ? parsed.height : defaultWindowBounds.height,
      x: typeof parsed.x === "number" ? parsed.x : undefined,
      y: typeof parsed.y === "number" ? parsed.y : undefined,
    };
  } catch {
    return { ...defaultWindowBounds };
  }
};

const saveWindowState = (window: BrowserWindow): void => {
  const bounds = window.getBounds();
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
  fs.mkdirSync(path.dirname(getWindowStatePath()), { recursive: true });
  fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
};

const createMainWindow = async (): Promise<void> => {
  const savedWindowState = clampWindowState(loadWindowState());
  logMain("createMainWindow:start", savedWindowState);
  const window = new BrowserWindow({
    width: savedWindowState.width,
    height: savedWindowState.height,
    x: savedWindowState.x,
    y: savedWindowState.y,
    minWidth: 360,
    minHeight: 680,
    backgroundColor: "#0c0e14",
    autoHideMenuBar: true,
    title: "Ableton Live Wizard",
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(currentDir, "preload.cjs"),
    },
  });

  mainWindow = window;

  window.once("ready-to-show", () => {
    logMain("window:ready-to-show");
    bringWindowToFront(window);
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });

  window.on("close", () => {
    logMain("window:close");
    saveWindowState(window);
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      logMain("window:will-navigate:blocked", { url });
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    logMain("window:new-window:blocked", { url });
    return { action: "deny" };
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    logMain("window:did-fail-load", { errorCode, errorDescription });
    window.loadURL(
      `data:text/html,${encodeURIComponent(`<html><body style="font-family:-apple-system;padding:24px;background:#081019;color:#e8edf2"><h1>Ableton Live Wizard</h1><p>Renderer failed to load.</p><pre>${String(errorCode)} ${errorDescription}</pre><p>Check ${mainLogPath}</p></body></html>`)}`,
    ).catch(() => {});
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    logMain("window:render-process-gone", details);
  });

  window.webContents.on("did-finish-load", () => {
    logMain("window:did-finish-load");
  });

  await window.loadFile(path.join(currentDir, "renderer", "index.html"));
  logMain("window:loadFile:resolved");
  bringWindowToFront(window);
};

service.subscribe((event) => {
  if (event.type === "debug") {
    logMain(`service:debug:${event.scope}`, event.message);
    return;
  }

  if (event.type === "operation") {
    logMain(`service:operation:${event.phase}`, event.action);
    return;
  }

  logMain("service:system", event.message);
});

ipcMain.handle("wizard:bootstrap", async () => {
  const [snapshot, catalog, state] = await Promise.all([
    chatSession.bootstrap(service.describeConnection()),
    service.getResourceCatalog(),
    service.getState(false),
  ]);

  return {
    ...snapshot,
    debugLogPath: getDebugLogPath(),
    resourceCount: catalog.length,
    state: summarizeLiveState(state),
  };
});
ipcMain.handle("wizard:submit-prompt", async (_event, input: string) =>
  chatSession.submitFreeform(String(input).slice(0, 2000), service.describeConnection()),
);
ipcMain.handle("wizard:choose-option", async (_event, optionId: string) =>
  chatSession.chooseOption(optionId, service.describeConnection()),
);
ipcMain.handle("wizard:set-window-title", async (_event, title: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(String(title));
  }
});

app.on("window-all-closed", () => {
  logMain("app:window-all-closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  logMain("app:activate", { windowCount: BrowserWindow.getAllWindows().length, hasMainWindow: Boolean(mainWindow) });
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    bringWindowToFront(mainWindow);
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on("browser-window-created", () => {
  logMain("app:browser-window-created");
});

app.on("web-contents-created", () => {
  logMain("app:web-contents-created");
});

process.on("uncaughtException", (error) => {
  logMain("process:uncaughtException", {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  logMain("process:unhandledRejection", reason);
});

logMain("app:waiting-for-ready");
app
  .whenReady()
  .then(async () => {
    logMain("app:ready");
    await createMainWindow();
  })
  .catch((error: unknown) => {
    const normalized =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error: String(error) };
    logMain("app:startup-failed", normalized);
    throw error;
  });
