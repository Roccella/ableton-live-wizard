import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const nowIso = (): string => new Date().toISOString();

export interface DebugLogEntry {
  timestamp: string;
  scope: string;
  message: string;
  payload?: unknown;
}

export const randomId = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export const deepClone = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

export const stableHash = (value: unknown): string => {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const debugListeners = new Set<(entry: DebugLogEntry) => void>();

let debugLogDirEnsured = false;

const defaultDebugLogPath = (): string => {
  if (process.env.WIZARD_DEBUG_LOG_PATH) {
    return process.env.WIZARD_DEBUG_LOG_PATH;
  }

  if (process.versions.electron) {
    return path.join(os.homedir(), "Library", "Application Support", "Ableton Live Wizard", "logs", "wizard-debug.log");
  }

  return path.resolve(process.cwd(), "logs", "wizard-debug.log");
};

export const debugLog = (scope: string, message: string, payload?: unknown): void => {
  const debugLogPath = defaultDebugLogPath();
  const entry: DebugLogEntry = {
    timestamp: nowIso(),
    scope,
    message,
    payload,
  };
  try {
    if (!debugLogDirEnsured) {
      fs.mkdirSync(path.dirname(debugLogPath), { recursive: true });
      debugLogDirEnsured = true;
    }
    const serializedPayload =
      payload === undefined
        ? ""
        : ` ${JSON.stringify(
            payload,
            (_key, value) => {
              if (value instanceof Error) {
                return {
                  name: value.name,
                  message: value.message,
                  stack: value.stack,
                };
              }
              return value;
            },
            2,
          )}`;
    fs.appendFileSync(debugLogPath, `[${entry.timestamp}] [${scope}] ${message}${serializedPayload}\n`, "utf8");
  } catch {
    // Debug logging must never break the app.
  }

  for (const listener of debugListeners) {
    try {
      listener(entry);
    } catch {
      // Debug listeners must never break the app.
    }
  }
};

export const getDebugLogPath = (): string => defaultDebugLogPath();

export const addDebugLogListener = (listener: (entry: DebugLogEntry) => void): (() => void) => {
  debugListeners.add(listener);
  return () => {
    debugListeners.delete(listener);
  };
};
