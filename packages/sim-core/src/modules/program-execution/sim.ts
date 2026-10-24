import type { Frame, Issue, Simulator } from "../../protocol";
import type { AsmInstruction, ExecEvent, ExecInput, ExecState, PipeCell } from "./types";

const META = {
  id: "cross.program-execution-chain",
  subject: "cross" as const,
  title: "程序执行链路",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·数据结构/计算机组成原理/操作系统 交叉内容", kind: "syllabus" as const },
    { label: "教学抽象模型：5 级流水线 + 栈帧 + 时间片（非真实硬件）", kind: "original" as const },
  ],
};

export const STAGES = [
  { id: 1, label: "源程序" },
  { id: 2, label: "编译成指令" },
  { id: 3, label: "内存布局" },
  { id: 4, label: "流水线" },
  { id: 5, label: "进程视角" },
] as const;

export const PIPELINE_STAGES = ["IF", "ID", "EX", "MEM", "WB"] as const;

export const defaultInput: ExecInput = { arrayIndex: 3, quantum: 5 };

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<ExecInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  if (!Number.isInteger(v.arrayIndex) || (v.arrayIndex as number) < 0 || (v.arrayIndex as number) > 7) {
    issues.push({ path: "arrayIndex", message: "下标 i 必须是 0–7", severity: "error" });
  }
  if (!Number.isInteger(v.quantum) || (v.quantum as number) < 1 || (v.quantum as number) > 32) {
    issues.push({ path: "quantum", message: "时间片必须是 1–32 个周期", severity: "error" });
  }
  return issues;
}

/** 6 条抽象指令：把 a[i] = a[i] + 1 拆开 */
export function buildInstructions(): AsmInstruction[] {
  return [
    { index: 0, text: "lw   r1, i(r0)      ; 读下标 i", reads: ["r0"], writes: ["r1"], isLoad: true },
    { index: 1, text: "slli r2, r1, 2      ; i × 4 得字节偏移", reads: ["r1"], writes: ["r2"], isLoad: false },
    { index: 2, text: "add  r3, r2, r_base ; 数组元素地址", reads: ["r2", "r_base"], writes: ["r3"], isLoad: false },
    { index: 3, text: "lw   r4, 0(r3)      ; 读 a[i]", reads: ["r3"], writes: ["r4"], isLoad: true },
    { index: 4, text: "addi r4, r4, 1      ; 加一", reads: ["r4"], writes: ["r4"], isLoad: false },
    { index: 5, text: "sw   r4, 0(r3)      ; 写回 a[i]", reads: ["r3", "r4"], writes: [], isLoad: false },
  ];
}

/** 相邻两条指令是否构成 load-use 冒险（前一条是 load，后一条立刻用它） */
export function isLoadUse(prev: AsmInstruction, next: AsmInstruction): boolean {
  return prev.isLoad && prev.writes.some((r) => next.reads.includes(r));
}

export const simulate: Simulator<ExecInput, ExecState, ExecEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as ExecInput;
  const frames: Frame<ExecState, ExecEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const instructions = buildInstructions();
  const sourceLine = `a[${input.arrayIndex}] = a[${input.arrayIndex}] + 1;`;

  // 起始周期：相邻指令默认相差 1 拍；load-use 冒险多停 1 拍
  const start: number[] = [1];
  for (let i = 1; i < instructions.length; i++) {
    const gap = isLoadUse(instructions[i - 1]!, instructions[i]!) ? 2 : 1;
    start.push(start[i - 1]! + gap);
  }
  const totalCycles = Math.max(...instructions.map((_, i) => start[i]! + 4));
  const stalls = instructions.slice(1).filter((ins, i) => isLoadUse(instructions[i]!, ins)).length;
  const cpi = totalCycles / instructions.length;

  // 流水线表
  const pipe: PipeCell[][] = instructions.map(() =>
    Array.from({ length: totalCycles }, () => ({ stage: "" }) as PipeCell),
  );
  instructions.forEach((_, i) => {
    const s = start[i]!;
    const occupied = [
      { at: s, stage: "IF" as const },
      { at: s + 1, stage: "ID" as const },
      { at: s + 2, stage: "EX" as const },
      { at: s + 3, stage: "MEM" as const },
      { at: s + 4, stage: "WB" as const },
    ];
    for (const o of occupied) {
      if (o.at - 1 >= 0 && o.at - 1 < totalCycles) pipe[i]![o.at - 1] = { stage: o.stage };
      if (!instructions[i]!.isLoad && o.stage === "MEM") {
        // 非访存指令的 MEM 段是空操作（教学简化：保留位置但内容为空）
        pipe[i]![o.at - 1] = { stage: "MEM", stalled: false };
      }
    }
    // 标记停顿：gcd 之间那一拍
    if (i > 0 && s - start[i - 1]! === 2) {
      const stallAt = start[i - 1]! + 1; // 上一指令 ID 之后的拍
      if (stallAt - 1 >= 0) pipe[i - 1]![stallAt - 1] = { stage: "ID", stalled: true };
    }
  });

  const slices = Math.ceil(totalCycles / input.quantum);
  const switches = slices - 1;

  const memory = [
    { name: "i", offset: "sp+0", value: input.arrayIndex },
    { name: "a 基址", offset: "sp+8", value: 1000 },
    { name: `a[${input.arrayIndex}]`, offset: `sp+8+${input.arrayIndex * 4}`, value: 1 },
  ];

  const base = (extra: Partial<ExecState> = {}): Omit<ExecState, "stage"> => ({
    input,
    sourceLine,
    instructions,
    memory,
    arrayValue: 1,
    pipe,
    cycle: totalCycles,
    totalCycles,
    stalls,
    cpi,
    slices,
    switches,
    ...extra,
  });

  const push = (event: ExecEvent, narration: string, stage: number, extra: Partial<ExecState> = {}) => {
    frames.push({ index: frames.length, state: { ...base(extra), stage }, event, narration });
  };

  push({ type: "SOURCE", line: sourceLine }, `源程序只有一行：${sourceLine}（数组元素自增）`, 1);
  push({ type: "ASM", count: instructions.length }, `编译器把它拆成 ${instructions.length} 条指令：读下标 → 算地址 → 读元素 → 加一 → 写回`, 2);
  push({ type: "MEMORY", arrayValue: 1 }, `内存里：i 在栈上（${input.arrayIndex}），数组基址 1000，a[${input.arrayIndex}] 的值将从 0 变成 1`, 3);

  for (let c = 1; c <= totalCycles; c++) {
    const active = instructions
      .map((ins, i) => ({ i, stage: pipe[i]![c - 1]!.stage }))
      .filter((x) => x.stage !== "")
      .map((x) => `I${x.i + 1}.${x.stage}`)
      .join(" ");
    push(
      { type: "CYCLE", cycle: c, stalled: false },
      `第 ${c} 拍：${active}`,
      4,
      { cycle: c },
    );
  }

  for (let i = 1; i < instructions.length; i++) {
    if (isLoadUse(instructions[i - 1]!, instructions[i]!)) {
      push(
        { type: "STALL", after: i - 1 },
        `load-use 冒险：I${i} 立刻使用 I${i + 1} 刚读入的寄存器，需要停 1 拍（共 ${stalls} 处）`,
        4,
        { cycle: start[i]! - 1 },
      );
    }
  }

  push(
    { type: "SCHEDULE", slices, switches },
    input.quantum >= totalCycles
      ? `进程视角：整段只需要 ${totalCycles} 拍，一个时间片（${input.quantum} 拍）内就能跑完，无切换`
      : `进程视角：时间片 ${input.quantum} 拍 → 切成 ${slices} 片，发生 ${switches} 次上下文切换`,
    5,
  );

  push(
    { type: "DONE", totalCycles, stalls, cpi },
    `小结：${instructions.length} 条指令、${stalls} 次停顿、共 ${totalCycles} 拍，CPI = ${cpi.toFixed(2)}`,
    5,
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;
