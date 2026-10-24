import { module as cross } from "@visual408/sim-core/modules/va-access-chain";
import { STAGES } from "@visual408/sim-core/modules/va-access-chain";
import type {
  CacheLineState,
  CrossEvent,
  CrossInput,
  CrossState,
  Frame,
  Issue,
} from "@visual408/sim-core";
import { Metrics, Panel, Pipeline } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const hex = (n: number | undefined, width = 4) =>
  n === undefined ? "—" : `0x${n.toString(16).toUpperCase().padStart(width, "0")}`;

const PRESETS: { label: string; accesses: string[]; note: string }[] = [
  { label: "标准链路", accesses: ["0x1A3C", "0x1A44", "0x1A3C", "0x2A7C", "0x1A3C"], note: "TLB / 页表 / Cache 三层各不相同" },
  { label: "冲突缺失", accesses: ["0x1A3C", "0x1B3C", "0x1A3C"], note: "同一 index 被不同 VPN 挤掉" },
  { label: "同一页内", accesses: ["0x1A3C", "0x1A40", "0x1A48"], note: "同页不同块，TLB 命中但 Cache 未必" },
];

const fmtTable = (t: { vpn: number; pfn: number }[]) => t.map((e) => e.vpn + ":" + e.pfn).join(", ");
const parseTable = (raw: string) =>
  raw.split(/[,\s]+/).filter(Boolean).map((pair) => {
    const parts = pair.split(":");
    return { vpn: Number(parts[0]), pfn: Number(parts[1]) };
  }).filter((e) => Number.isInteger(e.vpn) && Number.isInteger(e.pfn));

function Inputs({ input, onChange }: { input: CrossInput; onChange: (n: CrossInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field">
        <span>TLB 项数</span>
        <select value={input.tlbEntries} onChange={(e) => onChange({ ...input, tlbEntries: Number(e.target.value) })}>
          {[2, 4, 8].map((v) => <option key={v} value={v}>{v} 项</option>)}
        </select>
      </label>
      <label className="field">
        <span>物理页帧</span>
        <select value={input.frameCount} onChange={(e) => onChange({ ...input, frameCount: Number(e.target.value) })}>
          {[2, 4, 8].map((v) => <option key={v} value={v}>{v} 帧</option>)}
        </select>
      </label>
      <label className="field" style={{ flex: "1 1 220px" }}>
        <span>页表（VPN:PFN，可编辑）</span>
        <input type="text" value={fmtTable(input.pageTable)} spellCheck={false}
          style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}
          onChange={(ev) => {
            const next = parseTable(ev.target.value);
            if (next.length > 0) onChange({ ...input, pageTable: next });
          }} />
      </label>
      <label className="field field-grow">
        <span>虚拟地址序列（16 位十六进制）</span>
        <textarea rows={2} spellCheck={false} value={input.accesses.join(", ")}
          onChange={(e) => onChange({ ...input, accesses: e.target.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <div className="bits-legend">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet" title={p.note}
            onClick={() => onChange({ ...input, accesses: p.accesses })}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function StageBar({ state }: { state: CrossState | undefined }) {
  const done = new Set(state?.doneStages ?? []);
  return (
    <Pipeline
      stages={STAGES}
      current={state?.stage ?? 0}
      isDone={(id) => done.has(id)}
      // 第 4 阶段（缺页处理）在本次访问没有缺页时是「跳过」
      isSkipped={(id) => id === 4 && done.size > 0 && !done.has(4) && (state?.stage ?? 0) > 4}
      ariaLabel="访问链路阶段"
    />
  );
}

function AddressFlow({ state }: { state: CrossState | undefined }) {
  const c = state?.current;
  if (!c) return <p className="empty">应用输入后开始</p>;
  return (
    <div className="addr-flow">
      <div className="addr-box">
        <div className="muted" style={{ fontSize: 10.5 }}>虚拟地址</div>
        <div>{hex(c.va)}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
          VPN <strong style={{ color: "var(--tag)" }}>{c.vpn}</strong> · offset{" "}
          <strong style={{ color: "var(--offset)" }}>{hex(c.offset, 3)}</strong>
        </div>
      </div>
      <span aria-hidden="true" style={{ color: "var(--ink-3)" }}>→</span>
      <div className="addr-box">
        <div className="muted" style={{ fontSize: 10.5 }}>物理地址</div>
        <div>{hex(c.pa)}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
          PFN <strong style={{ color: "var(--index)" }}>{c.pfn ?? "—"}</strong> · offset{" "}
          <strong style={{ color: "var(--offset)" }}>{hex(c.offset, 3)}</strong>
        </div>
      </div>
      <span aria-hidden="true" style={{ color: "var(--ink-3)" }}>→</span>
      <div className="addr-box">
        <div className="muted" style={{ fontSize: 10.5 }}>Cache 三段</div>
        <div style={{ fontSize: 12 }}>
          tag <strong style={{ color: "var(--tag)" }}>{c.tag !== undefined ? hex(c.tag, 2) : "—"}</strong>{" "}
          index <strong style={{ color: "var(--index)" }}>{c.index ?? "—"}</strong>{" "}
          offset <strong style={{ color: "var(--offset)" }}>{c.blockOffset ?? "—"}</strong>
        </div>
      </div>
    </div>
  );
}

function TlbAndFrames({ state }: { state: CrossState | undefined }) {
  return (
    <div className="mini-grid">
      <div>
        <h3 className="mini-title">TLB</h3>
        <table className="data-table">
          <thead><tr><th scope="col">VPN</th><th scope="col">PFN</th></tr></thead>
          <tbody>
            {(state?.tlb ?? []).length === 0 ? (
              <tr><td colSpan={2} className="empty">空</td></tr>
            ) : (
              state!.tlb.map((e) => (
                <tr key={e.vpn} className={state?.current?.vpn === e.vpn ? "is-active" : undefined}>
                  <td className="mono">{e.vpn}</td><td className="mono">{e.pfn}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mini-title">物理页帧</h3>
        <table className="data-table">
          <thead><tr><th scope="col">PFN</th><th scope="col">驻留 VPN</th></tr></thead>
          <tbody>
            {(state?.frames ?? []).length === 0 ? (
              <tr><td colSpan={2} className="empty">空</td></tr>
            ) : (
              state!.frames.map((f) => (
                <tr key={f.pfn} className={state?.current?.pfn === f.pfn ? "is-active" : undefined}>
                  <td className="mono">{f.pfn}</td><td className="mono">{f.vpn}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CacheTable({ state }: { state: CrossState | undefined }) {
  const lines: CacheLineState[] = state?.cache ?? [];
  return (
    <table className="data-table">
      <caption>Cache（与 co.cache-direct-mapped 共用同一内核）</caption>
      <thead>
        <tr><th scope="col">行</th><th scope="col">有效</th><th scope="col">tag</th><th scope="col">主存块</th></tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className={state?.current?.cacheLine === i ? "is-active" : undefined}>
            <th scope="row">{i}</th>
            <td className={l.valid ? "yes" : "muted"}>{l.valid ? 1 : 0}</td>
            <td className="mono">{l.valid ? hex(l.tag, 2) : "—"}</td>
            <td className="mono">{l.block >= 0 ? l.block : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stage({ frame }: { frame: Frame<CrossState, CrossEvent> | undefined }) {
  const state = frame?.state;
  return (
    <section className="panel" aria-label="虚拟地址访问链路">
      <div className="panel-head">
        <h2>访问链路</h2>
        <span className="hint">一次访存 = 8 个阶段，四层命中相互独立</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        <StageBar state={state} />
        <AddressFlow state={state} />
        <TlbAndFrames state={state} />
        <CacheTable state={state} />
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<CrossState, CrossEvent> | undefined }) {
  const s = frame?.state.stats;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="四层统计">
        <Metrics
          items={[
            { label: "TLB 命中", value: s?.tlbHits ?? 0, tone: "good" },
            { label: "TLB 缺失", value: s?.tlbMisses ?? 0, tone: "bad" },
            { label: "缺页", value: s?.pageFaults ?? 0, tone: "bad" },
            { label: "Cache 命中", value: s?.cacheHits ?? 0, tone: "good" },
            { label: "Cache 缺失", value: s?.cacheMisses ?? 0, tone: "bad" },
          ]}
        />
      </Panel>

      <section className="panel" aria-label="要点">
        <div className="panel-head"><h2>这条链路在教什么</h2></div>
        <div className="panel-body" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          <p style={{ marginTop: 0 }}>
            <strong>TLB 命中 ≠ Cache 命中。</strong>TLB 只解决「虚拟页 → 物理页」，
            至于物理地址落在哪一行 Cache，要另外算 tag/index。
          </p>
          <p style={{ marginBottom: 0 }}>
            缺页才需要动页表与物理帧；Cache 缺失只需要从主存搬一个块。
            <strong>两者是不同层次的事件。</strong>
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<CrossInput, CrossState, CrossEvent> = {
  meta: cross.meta,
  defaultInput: cross.defaultInput,
  simulate: cross.simulate,
  Inputs,
  Stage,
  Side,
};