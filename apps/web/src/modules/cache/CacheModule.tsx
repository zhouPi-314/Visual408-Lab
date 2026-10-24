import { module as cache } from "@visual408/sim-core/modules/cache-direct-mapped";
import type { CacheEvent, CacheInput, CacheState, Frame, Issue } from "@visual408/sim-core";
import { CodePanel, DataTable, Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const PRESETS: { label: string; accesses: string[]; note: string }[] = [
  { label: "教学用例", accesses: ["0x0A3", "0x1A3", "0x2A3", "0x0A3"], note: "" },
  { label: "第 5 次命中", accesses: ["0x0A3", "0x1A3", "0x2A3", "0x0A3", "0x0A3"], note: "" },
  { label: "不同行不冲突", accesses: ["0x0A3", "0x0B3", "0x0A3"], note: "" },
];

const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`;
const bin = (n: number, width: number) => n.toString(2).padStart(Math.max(width, 0), "0");

const CPP = [
  "bool access(std::uint32_t addr) {",
  "    const std::uint32_t offset = addr & 0xF;        // 低 4 位",
  "    const std::uint32_t line   = (addr >> 4) & 0x7; // 中间 3 位",
  "    const std::uint32_t tag    = addr >> 7;         // 高位",
  "    // 命中判定只看「这一行当前的 tag」",
  "    if (lines[line].valid && lines[line].tag == tag) { ++hits; return true; }",
  "    ++misses;",
  "    lines[line] = Line{ true, tag, addr >> 4 };     // 装入",
  "    return false;",
  "}",
];
const CPP_FIRST = 11;

function Inputs({ input, onChange }: { input: CacheInput; onChange: (n: CacheInput) => void; issues: readonly Issue[] }) {
  const offsetBits = Math.round(Math.log2(input.blockBytes));
  const indexBits = Math.round(Math.log2(input.lines));
  const tagBits = input.addrBits - offsetBits - indexBits;

  return (
    <div className="input-bar">
      <label className="field">
        <span>地址位宽</span>
        <select value={input.addrBits} onChange={(e) => onChange({ ...input, addrBits: Number(e.target.value) })}>
          {[12, 16, 20, 32].map((v) => <option key={v} value={v}>{v} 位</option>)}
        </select>
      </label>
      <label className="field">
        <span>块大小</span>
        <select value={input.blockBytes} onChange={(e) => onChange({ ...input, blockBytes: Number(e.target.value) })}>
          {[4, 8, 16, 32, 64].map((v) => <option key={v} value={v}>{v} B</option>)}
        </select>
      </label>
      <label className="field">
        <span>Cache 行数</span>
        <select value={input.lines} onChange={(e) => onChange({ ...input, lines: Number(e.target.value) })}>
          {[2, 4, 8, 16].map((v) => <option key={v} value={v}>{v} 行</option>)}
        </select>
      </label>

      <label className="field field-grow">
        <span>访问地址（十六进制，逗号或换行分隔）</span>
        <textarea
          rows={2}
          spellCheck={false}
          value={input.accesses.join(", ")}
          onChange={(e) =>
            onChange({ ...input, accesses: e.target.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) })
          }
        />
      </label>

      <div className="bits-legend" aria-label="字段位数">
        <span className="pill pill-tag">tag {tagBits}</span>
        <span className="pill pill-index">index {indexBits}</span>
        <span className="pill pill-offset">offset {offsetBits}</span>
      </div>

      <div className="field" style={{ flexBasis: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-quiet"
              onClick={() => onChange({ ...input, accesses: p.accesses })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<CacheState, CacheEvent> | undefined }) {
  const state = frame?.state;
  const current = state?.current;
  const offsetBits = state ? Math.round(Math.log2(state.blockBytes)) : 4;
  const indexBits = state ? Math.round(Math.log2(state.lines.length)) : 3;
  const tagBits = state ? state.addrBits - offsetBits - indexBits : 9;

  return (
    <section className="panel" aria-label="Cache 状态">
      <div className="panel-head"><h2>地址拆分与 Cache 状态</h2>
        <span className="hint">{state ? `${state.addrBits} 位地址 / ${state.blockBytes} B 块 / ${state.lines.length} 行` : "等待输入"}</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 16 }}>
        {current ? (
          <div className="addr">
            <div className="addr-groups">
              <span className="tag" title="tag 位">{bin(current.tag, tagBits)}</span>
              <span className="index" title="index 位">{bin(current.index, indexBits)}</span>
              <span className="offset" title="offset 位">{bin(current.offset, offsetBits)}</span>
            </div>
            <div className="addr-labels">
              <span style={{ color: "var(--tag)" }}>tag = {hex(current.tag)}</span>
              <span style={{ color: "var(--index)" }}>第 {current.index} 行</span>
              <span style={{ color: "var(--offset)" }}>块内 {hex(current.offset)}</span>
              <span className="addr-raw">地址 {hex(current.addr)}</span>
            </div>
          </div>
        ) : (
          <p className="empty">应用输入后显示地址划分</p>
        )}

        <table className="data-table">
          <caption>直接映射 Cache：每行只能装一个主存块，index 相同即互相踢出</caption>
          <thead>
            <tr><th scope="col">行</th><th scope="col">有效位</th><th scope="col">tag</th><th scope="col">主存块</th></tr>
          </thead>
          <tbody>
            {(state?.lines ?? []).map((l, i) => (
              <tr key={i} className={state?.activeLine === i ? "is-active" : undefined}>
                <th scope="row">{i}</th>
                <td className={l.valid ? "yes" : "muted"}>{l.valid ? 1 : 0}</td>
                <td className="mono">{l.valid ? hex(l.tag) : "—"}</td>
                <td className="mono">{l.block >= 0 ? l.block : "—"}</td>
              </tr>
            ))}
            {(state?.lines.length ?? 0) === 0 && (
              <tr><td colSpan={4} className="empty">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<CacheState, CacheEvent> | undefined }) {
  const stats = frame?.state.stats;
  const active = frame?.code?.line;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="统计">
        <Metrics
          items={[
            { label: "命中", value: stats?.hits ?? 0, tone: "good" },
            { label: "缺失", value: stats?.misses ?? 0, tone: "bad" },
            { label: "强制缺失", value: stats?.compulsory ?? 0 },
            { label: "冲突缺失", value: stats?.conflict ?? 0 },
          ]}
        />
        <p className="field-note" style={{ marginTop: 10 }}>
          判定顺序：有效位 → tag 相同 → 命中；否则先判缺失类型，再装入。
        </p>
      </Panel>

      <CodePanel lines={CPP} firstLine={CPP_FIRST} activeLine={active} />
    </div>
  );
}

export const renderer: ModuleRenderer<CacheInput, CacheState, CacheEvent> = {
  meta: cache.meta,
  defaultInput: cache.defaultInput,
  simulate: cache.simulate,
  Inputs,
  Stage,
  Side,
};