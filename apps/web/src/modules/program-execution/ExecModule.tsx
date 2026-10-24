import { module as exec } from "@visual408/sim-core/modules/program-execution";
import { STAGES } from "@visual408/sim-core/modules/program-execution";
import type { ExecEvent, ExecInput, ExecState, Frame, Issue } from "@visual408/sim-core";
import { Metrics, Panel, Pipeline } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const STAGE_COLOR: Record<string, string> = {
  IF: "var(--index)",
  ID: "var(--tag)",
  EX: "var(--offset)",
  MEM: "var(--accent)",
  WB: "var(--hit)",
};

function Inputs({ input, onChange }: { input: ExecInput; onChange: (n: ExecInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field">
        <span>数组下标 i</span>
        <select value={input.arrayIndex} onChange={(e) => onChange({ ...input, arrayIndex: Number(e.target.value) })}>
          {[0, 1, 3, 5, 7].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="field">
        <span>时间片（周期）</span>
        <select value={input.quantum} onChange={(e) => onChange({ ...input, quantum: Number(e.target.value) })}>
          {[3, 5, 12, 32].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <div className="bits-legend">
        <span className="pill pill-index">IF 取指</span>
        <span className="pill pill-tag">ID 译码</span>
        <span className="pill pill-offset">EX 执行</span>
        <span className="pill">MEM 访存</span>
        <span className="pill">WB 写回</span>
      </div>
    </div>
  );
}

function PipeTable({ s }: { s: ExecState }) {
  return (
    <table className="data-table pipe-table" style={{ minWidth: 640 }}>
      <caption>5 级流水线时空图（列 = 时钟周期，琥珀 = 本拍）</caption>
      <thead>
        <tr>
          <th scope="col">指令</th>
          {Array.from({ length: s.totalCycles }, (_, c) => (
            <th key={c} scope="col" className={s.cycle === c + 1 ? "yes" : undefined}>{c + 1}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {s.pipe.map((row, i) => (
          <tr key={i}>
            <th scope="row">I{i + 1}</th>
            {row.map((cell, c) => (
              <td key={c}
                className={s.cycle === c + 1 ? "is-active-cell" : undefined}
                title={cell.stage ? `${cell.stage} 段` : undefined}>
                {cell.stage ? (
                  <span style={{ color: STAGE_COLOR[cell.stage], fontWeight: 600, fontSize: 11 }}>
                    {cell.stage}
                    {cell.stalled ? "·停" : ""}
                  </span>
                ) : (
                  <span className="muted">·</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stage({ frame }: { frame: Frame<ExecState, ExecEvent> | undefined }) {
  const s = frame?.state;
  if (!s) return <Panel title="程序执行链路"><p className="empty">应用输入后开始</p></Panel>;

  return (
    <section className="panel" aria-label="程序执行链路">
      <div className="panel-head">
        <h2>一行 C++ 在硬件上发生了什么</h2>
        <span className="hint">{s.totalCycles} 拍 · {s.stalls} 次停顿</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        <Pipeline stages={STAGES} current={s.stage} ariaLabel="执行链路阶段" />

        <div>
          <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>源程序</strong>
          <pre className="code-block" style={{ marginTop: 6 }}>
            <code className="code-line"><span className="ln">1</span>{s.sourceLine}</code>
          </pre>
        </div>

        <div>
          <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>编译结果（教学简化指令集）</strong>
          <pre className="code-block" style={{ marginTop: 6 }}>
            {s.instructions.map((ins) => (
              <code key={ins.index} className="code-line">
                <span className="ln">I{ins.index + 1}</span>{ins.text}
              </code>
            ))}
          </pre>
        </div>

        <div style={{ overflowX: "auto" }}>
          <PipeTable s={s} />
        </div>

        <table className="data-table">
          <caption>栈帧布局（教学模型，非真实 ABI）</caption>
          <thead><tr><th scope="col">变量</th><th scope="col">位置</th><th scope="col">值</th></tr></thead>
          <tbody>
            {s.memory.map((m) => (
              <tr key={m.name}>
                <th scope="row">{m.name}</th>
                <td className="mono">{m.offset}</td>
                <td className="mono">{m.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<ExecState, ExecEvent> | undefined }) {
  const s = frame?.state;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="指标">
        <Metrics
          items={[
            { label: "指令数", value: s?.instructions.length ?? 0 },
            { label: "总周期", value: s?.totalCycles ?? 0 },
            { label: "停顿", value: s?.stalls ?? 0, tone: "bad" },
            { label: "CPI", value: (s?.cpi ?? 0).toFixed(2) },
            { label: "时间片数", value: s?.slices ?? 0 },
            { label: "上下文切换", value: s?.switches ?? 0, tone: "bad" },
          ]}
        />
      </Panel>

      <Panel title="这条链路在教什么">
        <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          <p style={{ marginTop: 0 }}>
            同一行代码，四种视角：<strong>语句</strong> → <strong>指令</strong> → <strong>流水线</strong> → <strong>进程</strong>。
          </p>
          <p>
            <strong>load-use 冒险</strong>：前一条 load 的结果下一条立刻要用，流水线必须停 1 拍；
            这就是 CPI 从理想值 1 升到 2 的直接原因。
          </p>
          <p style={{ marginBottom: 0 }}>
            时间片小于总周期时，进程会被切走——同一段代码在被调度器打断后要保存现场。
          </p>
        </div>
      </Panel>

      <p className="field-note">
        本实验是<strong>教学抽象模型</strong>：指令集与栈帧布局为讲解而简化，与真实 x86/ARM 实现有差异。
      </p>
    </div>
  );
}

export const renderer: ModuleRenderer<ExecInput, ExecState, ExecEvent> = {
  meta: exec.meta,
  defaultInput: exec.defaultInput,
  simulate: exec.simulate,
  Inputs,
  Stage,
  Side,
};
