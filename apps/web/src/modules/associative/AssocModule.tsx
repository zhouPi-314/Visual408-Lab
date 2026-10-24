import { module as assoc } from "@visual408/sim-core/modules/cache-associative";
import type { AssocEvent, AssocInput, AssocState, Frame, Issue } from "@visual408/sim-core";
import type { ModuleRenderer } from "../../app/types";

const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`;
const bin = (n: number, w: number) => n.toString(2).padStart(Math.max(w, 0), "0");

const PRESETS: { label: string; accesses: string[]; ways?: number }[] = [
  { label: "冲突演示", accesses: ["0x003", "0x043", "0x083", "0x003", "0x083"], ways: 2 },
  { label: "2 路 vs 1 路", accesses: ["0x003", "0x043", "0x083", "0x003", "0x083"], ways: 2 },
  { label: "同组抖动", accesses: ["0x003", "0x043", "0x083", "0x0C3", "0x003"], ways: 2 },
];

function Inputs({ input, onChange }: { input: AssocInput; onChange: (n: AssocInput) => void; issues: readonly Issue[] }) {
  const sets = Math.round(input.lines / input.ways);
  const offsetBits = Math.round(Math.log2(input.blockBytes));
  const setBits = Math.round(Math.log2(sets));
  const tagBits = input.addrBits - offsetBits - setBits;

  return (
    <div className="input-bar">
      <label className="field">
        <span>块大小</span>
        <select value={input.blockBytes} onChange={(e) => onChange({ ...input, blockBytes: Number(e.target.value) })}>
          {[4, 8, 16, 32, 64].map((v) => <option key={v} value={v}>{v} B</option>)}
        </select>
      </label>
      <label className="field">
        <span>总行数</span>
        <select value={input.lines} onChange={(e) => onChange({ ...input, lines: Number(e.target.value) })}>
          {[2, 4, 8, 16].map((v) => <option key={v} value={v}>{v} 行</option>)}
        </select>
      </label>
      <label className="field">
        <span>每组行数（相联度）</span>
        <select value={input.ways} onChange={(e) => onChange({ ...input, ways: Number(e.target.value) })}>
          {[1, 2, 4, 8].map((v) => <option key={v} value={v}>{v} 路</option>)}
        </select>
      </label>
      <label className="field field-grow">
        <span>访问地址（十六进制）</span>
        <textarea rows={2} spellCheck={false} value={input.accesses.join(", ")}
          onChange={(e) => onChange({ ...input, accesses: e.target.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <div className="bits-legend">
        <span className="pill pill-tag">tag {tagBits}</span>
        <span className="pill pill-index">组号 {setBits}</span>
        <span className="pill pill-offset">offset {offsetBits}</span>
        <span className="pill">{sets} 组</span>
      </div>
      <div className="field" style={{ flexBasis: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-quiet"
              onClick={() => onChange({ ...input, accesses: p.accesses, ways: p.ways ?? input.ways })}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<AssocState, AssocEvent> | undefined }) {
  const s = frame?.state;
  const offsetBits = s ? Math.round(Math.log2(s.blockBytes)) : 4;
  const setBits = s ? Math.round(Math.log2(s.sets)) : 2;
  const tagBits = s ? s.addrBits - offsetBits - setBits : 10;
  const c = s?.current;
  const activeSet = s?.activeLine === undefined ? -1 : Math.floor(s.activeLine / (s?.ways ?? 1));
  const activeWay = s?.activeLine === undefined ? -1 : s.activeLine % (s?.ways ?? 1);

  return (
    <section className="panel" aria-label="组相联 Cache 状态">
      <div className="panel-head">
        <h2>组相联 Cache</h2>
        <span className="hint">{s ? `${s.lines} 行 / ${s.ways} 路 = ${s.sets} 组` : "等待输入"}</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 16 }}>
        <div className="addr">
          <div className="addr-groups">
            {c ? (
              <>
                <span className="tag">{bin(c.tag, tagBits)}</span>
                <span className="index">{bin(c.index, setBits)}</span>
                <span className="offset">{bin(c.offset, offsetBits)}</span>
              </>
            ) : <span className="muted">应用输入后显示地址划分</span>}
          </div>
          {c && (
            <div className="addr-labels">
              <span style={{ color: "var(--tag)" }}>tag = {hex(c.tag)}</span>
              <span style={{ color: "var(--index)" }}>第 {c.index} 组</span>
              <span style={{ color: "var(--offset)" }}>块内 {hex(c.offset)}</span>
              <span className="addr-raw">地址 {hex(c.addr)}</span>
            </div>
          )}
        </div>

        <table className="data-table">
          <caption>每组 {s?.ways ?? 2} 路并行比较 tag；组满时按 LRU 淘汰</caption>
          <thead>
            <tr>
              <th scope="col">组</th>
              {Array.from({ length: s?.ways ?? 2 }, (_, w) => (
                <th key={w} scope="col">way {w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: s?.sets ?? 0 }, (_, set) => (
              <tr key={set} className={activeSet === set ? "is-active" : undefined}>
                <th scope="row">{set}</th>
                {Array.from({ length: s?.ways ?? 2 }, (_, w) => {
                  const line = s?.linesState[set * (s.ways) + w];
                  const isActive = activeSet === set && activeWay === w;
                  return (
                    <td key={w} className={`mono${isActive ? " yes" : ""}`}>
                      {line?.valid ? (
                        <span>
                          {hex(line.tag)} <span className="muted">/ 块 {line.block}</span>
                        </span>
                      ) : (
                        <span className="muted">空</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<AssocState, AssocEvent> | undefined }) {
  const s = frame?.state;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel" aria-label="统计">
        <div className="panel-head"><h2>统计</h2></div>
        <div className="panel-body">
          <dl className="metrics">
            <div className="metric is-good"><dt>命中</dt><dd>{s?.stats.hits ?? 0}</dd></div>
            <div className="metric is-bad"><dt>缺失</dt><dd>{s?.stats.misses ?? 0}</dd></div>
            <div className="metric"><dt>强制缺失</dt><dd>{s?.stats.compulsory ?? 0}</dd></div>
            <div className="metric"><dt>冲突缺失</dt><dd>{s?.stats.conflict ?? 0}</dd></div>
          </dl>
        </div>
      </section>

      <section className="panel" aria-label="要点">
        <div className="panel-head"><h2>相联度换来了什么</h2></div>
        <div className="panel-body" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          <p style={{ marginTop: 0 }}>
            <strong>直接映射</strong>每组只有 1 路，tag 不同就只能踢出；
            <strong>组相联</strong>给同一组留了多个位置，冲突缺失显著减少。
          </p>
          <p style={{ marginBottom: 0 }}>
            代价是<strong>比较器变多</strong>：n 路需要 n 个 tag 比较器并行工作，命中判定也要多选一。
            <strong>全相联</strong>是相联度的极端（只有一组），成本最高、冲突最少。
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<AssocInput, AssocState, AssocEvent> = {
  meta: assoc.meta,
  defaultInput: assoc.defaultInput,
  simulate: assoc.simulate,
  Inputs,
  Stage,
  Side,
};
