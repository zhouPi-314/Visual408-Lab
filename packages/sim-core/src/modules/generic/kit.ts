import type { Frame, Issue, SimMeta, Simulation } from "../../protocol";
import type { GenericState, MetricItem, ViewData } from "../../view";

export interface FrameSpec {
  /** 事件类型，测试里用来断言序列 */
  type: string;
  narration: string;
  views: ViewData[];
  metrics?: MetricItem[];
}

export type GenericEvent = { type: string };

/**
 * 通用模拟器：把「一串帧规格」包装成标准 Simulation。
 * 15 个新实验共用，避免每个模块重复样板。
 */
export function buildSimulation<I>(
  meta: SimMeta,
  input: I,
  spec: FrameSpec[],
  issues: Issue[] = [],
): Simulation<I, GenericState, GenericEvent> {
  const frames: Frame<GenericState, GenericEvent>[] = issues.some((i) => i.severity === "error")
    ? []
    : spec.map((s, i) => ({
        index: i,
        state: { views: s.views, ...(s.metrics ? { metrics: s.metrics } : {}) },
        event: { type: s.type },
        narration: s.narration,
      }));
  return { input, meta, frames, validate: () => issues };
}

export const ok = (path: string, message: string): Issue => ({ path, message, severity: "warning" });
export const bad = (path: string, message: string): Issue => ({ path, message, severity: "error" });

export const intIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
