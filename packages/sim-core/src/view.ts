/**
 * 通用视图描述：模拟器只产出「数据 + 状态」，由 Web 端统一渲染。
 * 这样新增实验不需要写渲染器，只需产出 views。
 */

import type { SimMeta, Simulator } from "./protocol";

export type CellState = "idle" | "active" | "done" | "warn" | "bad" | "ok";

export interface ViewCell {
  text: string;
  state?: CellState;
  sub?: string;
}

export type ViewData =
  | { kind: "chips"; label?: string; items: ViewCell[] }
  | { kind: "bars"; label?: string; max: number; items: { label: string; value: number; state?: CellState }[] }
  | { kind: "grid"; label?: string; columns: string[]; rowHeaders?: string[]; rows: ViewCell[][]; activeRow?: number }
  | { kind: "bits"; label?: string; groups: { label: string; bits: number[]; splitAt?: number }[] }
  | {
      kind: "timeline";
      label?: string;
      span: number;
      segments: { start: number; end: number; label: string; state?: CellState }[];
      markers?: { at: number; label: string }[];
    }
  | { kind: "fields"; label?: string; items: ViewCell[] }
  | { kind: "matrix"; label?: string; columns: string[]; rowHeaders: string[]; rows: (number | string)[][]; highlight?: [number, number][] };

export interface MetricItem {
  label: string;
  value: string | number;
  tone?: "good" | "bad";
}

export interface GenericState {
  views: ViewData[];
  metrics?: MetricItem[];
}

/** 通用模块：模拟器只负责帧与视图，表单由 fields 描述自动生成 */
export type FieldDef =
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "text"; placeholder?: string }
  | { key: string; label: string; type: "number"; min: number; max: number };

export interface GenericPreset {
  label: string;
  patch: Record<string, unknown>;
}

export interface GenericModuleDef<I> {
  meta: SimMeta;
  summary: string;
  takeaway: string;
  fields: FieldDef[];
  defaultInput: I;
  /** 一键场景：点一下就把一组参数填进去 */
  presets?: GenericPreset[];
  simulate: Simulator<I, GenericState, { type: string }>;
}

export interface GenericModuleMeta {
  id: string;
  subject: "ds" | "co" | "os" | "net" | "cross";
  title: string;
  syllabusVersion: string;
  summary: string;
  takeaway: string;
}