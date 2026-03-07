import fs from "node:fs";
import path from "node:path";

export const nowIso = (): string => new Date().toISOString();

export const randomId = (prefix: string): string => {
  const value = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${value}`;
};

export const deepClone = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

const debugLogPath = process.env.WIZARD_DEBUG_LOG_PATH || path.resolve(process.cwd(), "logs", "wizard-debug.log");

export const debugLog = (scope: string, message: string, payload?: unknown): void => {
  try {
    fs.mkdirSync(path.dirname(debugLogPath), { recursive: true });
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
    fs.appendFileSync(debugLogPath, `[${nowIso()}] [${scope}] ${message}${serializedPayload}\n`, "utf8");
  } catch {
    // Debug logging must never break the app.
  }
};

export const getDebugLogPath = (): string => debugLogPath;
