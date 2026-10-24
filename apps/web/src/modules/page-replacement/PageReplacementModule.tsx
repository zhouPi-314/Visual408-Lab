import { module as pageModule } from "@visual408/sim-core/modules/page-replacement";
import { BELADY_PRESET, REF_PRESET } from "@visual408/sim-core/modules/page-replacement";
import type {
  ReplacementAlg,
  ReplacementEvent,
  ReplacementInput,
  ReplacementState,
  Frame,
  Issue,
} from "@visual408/sim-core";
import { useState } from "react";
import { CodePanel, Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const CPP = [
  "int simulate(const std::vector<int>& ref, int alg) {",
  "    for (auto& f : frames) if (f.page == page) { f.lastUsed = i; hit = true; }",
  "    if (hit) continue;",
  "    ++faults;",
  "    int victim = chooseVictim(alg, frames);  // FIFO / LRU / OPT",
  "    load(victim, page);",
  "}",
];
const CPP_FIRST = 8;

const ALGS: { id: ReplacementAlg; label: string; note: string }[] = [
  { id: "FIFO", label: "FIFO", note: "淘汰最早调入的页" },
  { id: "LRU", label: "LRU", note: "淘汰最久未使用的页" },
  { id: "OPT", label: "OPT", note: "淘汰将来最晚才会用到的页（理论上界）" },
];

function Inputs({ input, onChange }: { input: ReplacementInput; onChange: (n: ReplacementInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field">
        <span>置换算法</span>
        <select value={input.alg} onChange={(e) => onChange({ ...input, alg: e.target.value as ReplacementAlg })}>
          {ALGS.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.note}</option>)}
        </select>
      </label>
      <label className="field">
        <span>物理块数</span>
        <select value={input.frames} onChange={(e) => onChange({ ...input, frames: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} 块</option>)}
        </select>
      </label>
      <label className="field field-grow">
        <span>引用串（页号 0–9，逗号或空格分隔）</span>
        <textarea rows={2} spellCheck={false} value={input.ref}
          onChange={(e) => onChange({ ...input, ref: e.target.value })} />
      </label>
      <div className="bits-legend">
        <button type="button" className="btn btn-quiet" onClick={() => onChange({ ...input, ref: REF_PRESET, frames: 3 })}>
          经典用例（20 次）
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => onChange({ ...input, ref: BELADY_PRESET, frames: 3 })}>
          Belady 异常
        </button>
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<ReplacementState, ReplacementEvent> | undefined }) {
  const state = frame?.state;
  const history = state?.history ?? [];
  const capacity = state?.slots.length ?? 0;
  const ev = frame?.event;
  const activeColumn = ev && ev.type === "ACCESS" ? ev.column : Math.max(history.length - 1, -1);
  // 小屏救命开关：只显示当前列附近的一段，避免横向滚动找列
  const [compact, setCompact] = useState(false);
  const windowStart = compact ? Math.max(0, activeColumn - 3) : 0;
  const windowEnd = compact ? Math.min(history.length, activeColumn + 4) : history.length;
  const shown = history.slice(windowStart, windowEnd);

  return (
    <section className="panel" aria-label="页面置换过程">
      <div className="panel-head">
        <h2>置换过程表</h2>
        <span className="hint">每列一次访问：× 缺页 · · 命中</span>
        <button type="button" className="btn btn-quiet" style={{ marginLeft: "auto" }}
          aria-pressed={compact}
          onClick={() => setCompact((v) => !v)}>
          {compact ? "显示全部列" : "只看当前列"}
        </button>
      </div>
      <div className="panel-body" style={{ overflowX: "auto" }}>
        {history.length === 0 ? (
          <p className="empty">还没有访问记录</p>
        ) : (
          <table className="data-table" style={{ minWidth: Math.max(shown.length * 38, 320) }}>
            <caption>物理块状态（共 {capacity} 块）</caption>
            <thead>
              <tr>
                <th scope="col" style={{ width: 68 }}>块 \ 访问</th>
                {shown.map((h, i) => (
                  <th key={windowStart + i} scope="col"
                    className={`mono${windowStart + i === activeColumn ? " yes" : ""}`}
                    title={h.hit ? `命中页 ${h.page}` : `缺页：页 ${h.page}`}>
                    {h.page}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: capacity }, (_, slot) => (
                <tr key={slot}>
                  <th scope="row">块 {slot}</th>
                  {shown.map((h, i) => {
                    const v = h.frames[slot];
                    const justLoaded = windowStart + i === activeColumn && !h.hit && v === h.page;
                    return (
                      <td key={windowStart + i} className={`mono${justLoaded ? " no" : ""}`}>
                        {v === null || v === undefined ? <span className="muted">·</span> : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">结果</th>
                {shown.map((h, i) => (
                  <td key={windowStart + i} className={h.hit ? "yes" : "no"} aria-label={h.hit ? "命中" : "缺页"}>
                    {h.hit ? "·" : "×"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<ReplacementState, ReplacementEvent> | undefined }) {
  const stats = frame?.state.stats;
  const accessed = frame?.state.accessed ?? 0;
  const rate = accessed > 0 && stats ? stats.faults / accessed : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="统计">
        <Metrics
          items={[
            { label: "已访问", value: accessed },
            { label: "命中", value: stats?.hits ?? 0, tone: "good" },
            { label: "缺页", value: stats?.faults ?? 0, tone: "bad" },
            { label: "缺页率", value: (rate * 100).toFixed(1), unit: "%", span: 3 },
          ]}
        />
      </Panel>

      <CodePanel
        lines={CPP}
        firstLine={CPP_FIRST}
        activeLine={frame?.code?.line}
        footer={
          <p className="field-note" style={{ marginTop: 8 }}>
            FIFO 看「装入时间」，会出 Belady 异常；LRU 看「最近使用」，命中时必须更新次序；OPT 只能做理论上界。
          </p>
        }
      />
    </div>
  );
}

export const renderer: ModuleRenderer<ReplacementInput, ReplacementState, ReplacementEvent> = {
  meta: pageModule.meta,
  defaultInput: pageModule.defaultInput,
  simulate: pageModule.simulate,
  Inputs,
  Stage,
  Side,
};