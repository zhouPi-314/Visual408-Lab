import type { ModuleDefinition } from "../../protocol";

export type SchedAlgorithm = "fcfs" | "sjf" | "rr";

export interface SchedProcess {
  pid: string;
  arrive: number;
  burst: number;
}

export interface SchedInput {
  algorithm: SchedAlgorithm;
  /** 时间片（仅 RR 使用） */
  quantum: number;
  processes: SchedProcess[];
}

export interface GanttSegment {
  pid: string | null;
  start: number;
  end: number;
}

export interface ProcResult {
  pid: string;
  arrive: number;
  burst: number;
  start: number;
  end: number;
  wait: number;
  turnaround: number;
}

export interface SchedState {
  algorithm: SchedAlgorithm;
  quantum: number;
  time: number;
  processes: SchedProcess[];
  ready: string[];
  running?: string;
  segments: GanttSegment[];
  results: ProcResult[];
  remaining: Record<string, number>;
  stats: { avgWait: number; avgTurnaround: number };
}

export type SchedEvent =
  | { type: "ARRIVE"; pid: string; time: number }
  | { type: "DISPATCH"; pid: string; time: number }
  | { type: "PREEMPT"; pid: string; time: number }
  | { type: "COMPLETE"; pid: string; time: number; wait: number; turnaround: number }
  | { type: "IDLE"; from: number; to: number }
  | { type: "DONE"; avgWait: number; avgTurnaround: number };

export type SchedModule = ModuleDefinition<SchedInput, SchedState, SchedEvent>;
