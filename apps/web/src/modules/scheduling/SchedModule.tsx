import { module as sched } from "@visual408/sim-core/modules/scheduling";
import { ALGO_NAME, DEFAULT_PROCESSES, formatProcesses, parseProcesses } from "@visual408/sim-core/modules/scheduling";
import type {
  Frame,
  Issue,
  SchedAlgorithm,
  SchedEvent,
  SchedInput,
  SchedState,
} from "@visual408/sim-core";
import { Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const ALGOS: { id: SchedAlgorithm; label: string; note: string }[] = [
  { id: "fcfs", label: "FCFS", note: "按到达顺序，非抢占" },
  { id: "sjf", label: "SJF", note: "已到达者中挑最短，非抢占" },
  { id: "rr", label: "RR", note: "时间片用完就换人" },
];

const PID_COLORS = ["var(--index)", "var(--tag)", "var(--offset)", "var(--accent)", "var(--hit)", "var(--miss)"];

const PRESETS = [
  { label: "教学用例", data: formatProcesses(DEFAULT_PROCESSES) },
  { label: "长短混合", data: "P1, 0, 6; P2, 1, 1; P3, 2, 2" },
  { label: "有 CPU 空闲", data: "P1, 0, 1; P2, 5, 2" },
];

function Inputs({ input, onChange }: { input: SchedInput; onChange: (n: SchedInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field">
        <span>调度算法</span>
        <select value={input.algorithm}
          onChange={(e) => onChange({ ...input, algorithm: e.target.value as SchedAlgorithm })}>
          {ALGOS.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.note}</option>)}
        </select>
      </label>
      <label className="field">
        <span>时间片（RR）</span>
        <select value={input.quantum} disabled={input.algorithm !== "rr"}
          onChange={(e) => onChange({ ...input, quantum: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="field field-grow">
        <span>进程（每行：名称, 到达时间, 运行时间）</span>
        <textarea rows={2} spellCheck={false} value={formatProcesses(input.processes)}
          onChange={(e) => onChange({ ...input, processes: parseProcesses(e.target.value) })} />
      </label>
      <div className="bits-legend">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet"
            onClick={() => onChange({ ...input, processes: parseProcesses(p.data) })}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function Gantt({ state }: { state: SchedState | undefined }) {
  const segments = state?.segments ?? [];
  const total = Math.max(segments.at(-1)?.end ?? 1, 1);
  const W = 620;
  const H = 74;
  const pids = [...new Set((state?.processes ?? []).map((p) => p.pid))];
  const colorOf = (pid: string | null) =>
    pid === null ? "var(--line-strong)" : PID_COLORS[pids.indexOf(pid) % PID_COLORS.length];

  if (segments.length === 0) return <p className="empty">还没有开始调度</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W + 20} ${H}`} width="100%" height={H} role="img" aria-label="CPU 甘特图" style={{ display: "block" }}>
        {segments.map((s, i) => {
          const x = 10 + (s.start / total) * W;
          const w = ((s.end - s.start) / total) * W;
          return (
            <g key={i}>
              <rect x={x} y={18} width={Math.max(w, 1)} height={26} rx={3}
                fill={colorOf(s.pid)} opacity={s.pid === null ? 0.35 : 0.85} />
              <text x={x + Math.max(w, 1) / 2} y={35} textAnchor="middle" fontSize={11}
                fill="#fff" fontFamily="var(--mono)" fontWeight={600}>
                {Math.max(w, 1) > 22 ? (s.pid ?? "空闲") : ""}
              </text>
              <text x={x} y={58} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="var(--mono)">
                {s.start}
              </text>
            </g>
          );
        })}
        <text x={10 + W} y={58} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="var(--mono)">
          {total}
        </text>
      </svg>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<SchedState, SchedEvent> | undefined }) {
  const s = frame?.state;
  return (
    <section className="panel" aria-label="调度过程">
      <div className="panel-head">
        <h2>CPU 甘特图</h2>
        <span className="hint">{s ? `t=${s.time}` : "等待输入"}</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        <Gantt state={s} />

        <div>
          <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>就绪队列（队首在左）</strong>
          <div className="stack-row">
            {s?.running && <span className="stack-chip is-visited">运行中 {s.running}</span>}
            {(s?.ready ?? []).length === 0 ? (
              <span className="muted" style={{ fontSize: 13 }}>（空）</span>
            ) : (
              s!.ready.map((pid, i) => <span key={`${pid}-${i}`} className="stack-chip">{pid}</span>)
            )}
          </div>
        </div>

        <table className="data-table">
          <caption>已完成进程</caption>
          <thead>
            <tr>
              <th scope="col">进程</th><th scope="col">到达</th><th scope="col">运行</th>
              <th scope="col">完成</th><th scope="col">等待</th><th scope="col">周转</th>
            </tr>
          </thead>
          <tbody>
            {(s?.results ?? []).length === 0 ? (
              <tr><td colSpan={6} className="empty">还没有进程完成</td></tr>
            ) : (
              s!.results.map((r) => (
                <tr key={r.pid}>
                  <th scope="row">{r.pid}</th>
                  <td className="mono">{r.arrive}</td>
                  <td className="mono">{r.burst}</td>
                  <td className="mono">{r.end}</td>
                  <td className="mono">{r.wait}</td>
                  <td className="mono">{r.turnaround}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<SchedState, SchedEvent> | undefined }) {
  const s = frame?.state;
  const done = s?.results.length ?? 0;
  const total = s?.processes.length ?? 0;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="指标">
        <Metrics
          items={[
            { label: "平均等待", value: (s?.stats.avgWait ?? 0).toFixed(2) },
            { label: "平均周转", value: (s?.stats.avgTurnaround ?? 0).toFixed(2) },
            { label: "完成", value: `${done}/${total}` },
          ]}
        />
      </Panel>

      <section className="panel" aria-label="要点">
        <div className="panel-head"><h2>三种调度怎么看</h2></div>
        <div className="panel-body" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          <p style={{ marginTop: 0 }}>
            <strong>FCFS</strong> 简单但对短作业不利（护航效应）；<strong>SJF</strong> 平均等待最短，
            但长作业可能饥饿；<strong>RR</strong> 响应快，时间片过大退化成 FCFS、过小则切换开销高。
          </p>
          <p style={{ marginBottom: 0 }}>
            计算只用到两个式子：<span className="mono">周转 = 完成 − 到达</span>，
            <span className="mono">等待 = 周转 − 运行</span>。
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<SchedInput, SchedState, SchedEvent> = {
  meta: sched.meta,
  defaultInput: sched.defaultInput,
  simulate: sched.simulate,
  Inputs,
  Stage,
  Side,
};