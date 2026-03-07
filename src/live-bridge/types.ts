import { LiveState, OperationPlan, OperationResult } from "../types.js";

export interface LiveBridge {
  getState(): Promise<LiveState>;
  previewOperation(plan: OperationPlan): Promise<string>;
  applyOperation(plan: OperationPlan): Promise<OperationResult>;
  undoLast(): Promise<OperationResult>;
  redoLast?(): Promise<OperationResult>;
}
