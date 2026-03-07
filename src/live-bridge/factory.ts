import { MockLiveBridge } from "./mock-live-bridge.js";
import { RealLiveBridge } from "./real-live-bridge.js";
import { TcpLiveBridge } from "./tcp-live-bridge.js";
import { LiveBridge } from "./types.js";

export type BridgeMode = "mock" | "http" | "tcp";

export const getBridgeMode = (): BridgeMode => {
  const raw = (process.env.LIVE_BRIDGE ?? "mock").toLowerCase();
  if (raw === "tcp") return "tcp";
  if (raw === "http" || raw === "real") return "http";
  return "mock";
};

export const createLiveBridge = (): LiveBridge => {
  const mode = getBridgeMode();
  if (mode === "http") {
    return new RealLiveBridge();
  }
  if (mode === "tcp") {
    return new TcpLiveBridge();
  }
  return new MockLiveBridge();
};
