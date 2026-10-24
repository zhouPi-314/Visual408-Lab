import type { Frame, Issue, Simulator } from "../../protocol";
import type {
  GanttSegment,
  ProcResult,
  SchedAlgorithm,
  SchedEvent,
  SchedInput,
  SchedProcess,
  SchedState,
} from "./types";

const META = {
  id: "os.scheduling",
  subject: "os" as const,
  title: "进程调度：FCFS / SJF / 时间片轮转",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·操作系统·处理机调度", kind: "syllabus" as const },
    { label: "调度过程的逐事件推演（本项目原创实现）", kind: "original" as const },
  ],
};

export const ALGO_NAME: Record<SchedAlgorithm, string> = {
  fcfs: "先来先服务 FCFS",
  sjf: "短作业优先 SJF",
  rr: "时间片轮转 RR",
};

export const DEFAULT_PROCESSES: SchedProcess[] = [
  { pid: "P1", arrive: 0, burst: 3 },
  { pid: "P2", arrive: 1, burst: 2 },
  { pid: "P3", arrive: 2, burst: 1 },
];

export function parseProcesses(raw: string): SchedProcess[] {
  return raw
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [pid, arrive, burst] = line.split(/[,\s]+/);
      return { pid: pid ?? `P${i + 1}`, arrive: Number(arrive), burst: Number(burst) };
    });
}

export function formatProcesses(list: SchedProcess[]): string {
  return list.map((p) => `${p.pid}, ${p.arrive}, ${p.burst}`).join("; ");
}

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<SchedInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  if (!["fcfs", "sjf", "rr"].includes(String(v.algorithm))) {
    issues.push({ path: "algorithm", message: "算法只能是 fcfs / sjf / rr", severity: "error" });
  }
  if (!Number.isInteger(v.quantum) || (v.quantum as number) < 1 || (v.quantum as number) > 10) {
    issues.push({ path: "quantum", message: "时间片只能是 1–10", severity: "error" });
  }
  if (!Array.isArray(v.processes) || v.processes.length === 0) {
    issues.push({ path: "processes", message: "至少需要一个进程", severity: "error" });
  } else {
    if (v.processes.length > 6) issues.push({ path: "processes", message: "最多 6 个进程（保证甘特图可读）", severity: "error" });
    v.processes.forEach((p, i) => {
      if (!p.pid || typeof p.pid !== "string") issues.push({ path: `processes[${i}].pid`, message: "进程名不能为空", severity: "error" });
      if (!Number.isInteger(p.arrive) || p.arrive < 0 || p.arrive > 20) {
        issues.push({ path: `processes[${i}].arrive`, message: "到达时间必须是 0–20 的整数", severity: "error" });
      }
      if (!Number.isInteger(p.burst) || p.burst < 1 || p.burst > 10) {
        issues.push({ path: `processes[${i}].burst`, message: "运行时间必须是 1–10 的整数", severity: "error" });
      }
    });
  }
  return issues;
}

export const simulate: Simulator<SchedInput, SchedState, SchedEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as SchedInput;
  const frames: Frame<SchedState, SchedEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const procs = [...input.processes].sort((a, b) => a.arrive - b.arrive || a.pid.localeCompare(b.pid));
  const remaining: Record<string, number> = {};
  for (const p of procs) remaining[p.pid] = p.burst;

  let ready: SchedProcess[] = [];
  /** 时间片用完被挂起的进程：要等同一时刻新到达者先入队，再排到队尾 */
  const deferred: SchedProcess[] = [];
  let running: SchedProcess | undefined;
  let quantumLeft = input.quantum;
  const segments: GanttSegment[] = [];
  const results: ProcResult[] = [];
  const firstStart: Record<string, number> = {};
  let time = 0;
  let next = 0;

  const snapshot = (): Omit<SchedState, "running"> => ({
    algorithm: input.algorithm,
    quantum: input.quantum,
    time,
    processes: procs,
    ready: ready.map((p) => p.pid),
    segments: segments.map((s) => ({ ...s })),
    results: results.map((r) => ({ ...r })),
    remaining: { ...remaining },
    stats: averages(),
  });

  const push = (event: SchedEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: { ...snapshot(), ...(running ? { running: running.pid } : {}) },
      event,
      narration,
    });
  };

  const record = (pid: string | null, from: number, to: number) => {
    if (to <= from) return;
    const last = segments[segments.length - 1];
    if (last && last.pid === pid && last.end === from) last.end = to;
    else segments.push({ pid, start: from, end: to });
  };

  function averages() {
    if (results.length === 0) return { avgWait: 0, avgTurnaround: 0 };
    const sumW = results.reduce((a, r) => a + r.wait, 0);
    const sumT = results.reduce((a, r) => a + r.turnaround, 0);
    return { avgWait: sumW / results.length, avgTurnaround: sumT / results.length };
  }

  const pickNext = (): SchedProcess | undefined => {
    if (ready.length === 0) return undefined;
    if (input.algorithm === "sjf") {
      // 非抢占式短作业优先：在已到达者中挑运行时间最短的
      const best = ready.reduce((b, p) => (p.burst < b.burst ? p : b), ready[0]!);
      ready = ready.filter((p) => p !== best);
      return best;
    }
    return ready.shift();
  };

  push({ type: "ARRIVE", pid: "", time: 0 }, `开始：${ALGO_NAME[input.algorithm]}${input.algorithm === "rr" ? `，时间片 q=${input.quantum}` : ""}`);

  let guard = 0;
  while (results.length < procs.length && guard < 500) {
    guard += 1;

    // 新到达
    while (next < procs.length && procs[next]!.arrive <= time) {
      const p = procs[next]!;
      ready.push(p);
      next += 1;
      push({ type: "ARRIVE", pid: p.pid, time }, `t=${time}：${p.pid} 到达（运行时间 ${p.burst}）`);
    }
    // 同一时刻「新到达者优先入队，被剥夺者排到队尾」——这是 RR 的标准约定
    if (deferred.length > 0) {
      ready.push(...deferred);
      deferred.length = 0;
    }

    if (!running) {
      const picked = pickNext();
      if (!picked) {
        const nextArrive = next < procs.length ? procs[next]!.arrive : time + 1;
        const from = time;
        time = Math.max(nextArrive, time + 1);
        record(null, from, time);
        push({ type: "IDLE", from, to: time }, `CPU 空闲（${from}–${time}），等待进程到达`);
        continue;
      }
      running = picked;
      quantumLeft = input.quantum;
      if (firstStart[picked.pid] === undefined) firstStart[picked.pid] = time;
      push({ type: "DISPATCH", pid: picked.pid, time }, `t=${time}：调度 ${picked.pid} 上 CPU（还需 ${remaining[picked.pid]}）`);
    }

    // 执行 1 个时间单位
    const pid = running.pid;
    remaining[pid] = (remaining[pid] ?? 0) - 1;
    quantumLeft -= 1;
    const startTick = time;
    time += 1;
    record(pid, startTick, time);

    if (remaining[pid] === 0) {
      const end = time;
      const proc = running;
      const wait = end - proc.arrive - proc.burst;
      const turnaround = end - proc.arrive;
      results.push({
        pid,
        arrive: proc.arrive,
        burst: proc.burst,
        start: firstStart[pid] ?? proc.arrive,
        end,
        wait,
        turnaround,
      });
      running = undefined;
      push({ type: "COMPLETE", pid, time: end, wait, turnaround }, `t=${end}：${pid} 完成，周转 ${turnaround}，等待 ${wait}`);
      continue;
    }

    if (input.algorithm === "rr" && quantumLeft === 0) {
      const preempted = running;
      deferred.push(preempted);
      running = undefined;
      push({ type: "PREEMPT", pid: preempted.pid, time }, `t=${time}：${preempted.pid} 时间片用完，回到就绪队列（剩余 ${remaining[pid]}）`);
    }
  }

  const final = averages();
  push(
    { type: "DONE", avgWait: final.avgWait, avgTurnaround: final.avgTurnaround },
    `结束：平均等待 ${final.avgWait.toFixed(2)}，平均周转 ${final.avgTurnaround.toFixed(2)}`,
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: SchedInput = {
  algorithm: "fcfs",
  quantum: 1,
  processes: DEFAULT_PROCESSES,
};
