import type { ModuleDefinition } from "../../protocol";

export interface ExecInput {
  /** 自增数组元素的源语句参数 */
  arrayIndex: number;
  /** 时间片长度（以时钟周期计） */
  quantum: number;
}

export interface AsmInstruction {
  index: number;
  text: string;
  /** 读的寄存器 */
  reads: string[];
  /** 写的寄存器 */
  writes: string[];
  /** 是否为访存指令（load） */
  isLoad: boolean;
}

export interface PipeCell {
  stage: "IF" | "ID" | "EX" | "MEM" | "WB" | "";
  /** 该拍是否因为冒险插入停顿 */
  stalled?: boolean;
}

export interface ExecState {
  input: ExecInput;
  stage: number;
  sourceLine: string;
  instructions: AsmInstruction[];
  /** 栈帧布局 */
  memory: { name: string; offset: string; value: number }[];
  arrayValue: number;
  /** 流水线表：行=指令，列=周期 */
  pipe: PipeCell[][];
  cycle: number;
  totalCycles: number;
  stalls: number;
  cpi: number;
  /** 进程视角：时间片数与切换次数 */
  slices: number;
  switches: number;
}

export type ExecEvent =
  | { type: "SOURCE"; line: string }
  | { type: "ASM"; count: number }
  | { type: "MEMORY"; arrayValue: number }
  | { type: "CYCLE"; cycle: number; stalled: boolean }
  | { type: "STALL"; after: number }
  | { type: "SCHEDULE"; slices: number; switches: number }
  | { type: "DONE"; totalCycles: number; stalls: number; cpi: number };

export type ExecModule = ModuleDefinition<ExecInput, ExecState, ExecEvent>;
