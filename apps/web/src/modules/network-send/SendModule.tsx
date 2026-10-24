import { module as sendModule } from "@visual408/sim-core/modules/network-send";
import { STAGES } from "@visual408/sim-core/modules/network-send";
import type { Frame, Issue, SendEvent, SendInput, SendState } from "@visual408/sim-core";
import { AddrBox, Metrics, Panel, Pipeline } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const PRESETS: { label: string; patch: Partial<SendInput>; note: string }[] = [
  { label: "跨子网", patch: { dstIp: "192.168.20.50", prefix: 24 }, note: "目的在不同网段，交给网关" },
  { label: "同子网", patch: { dstIp: "192.168.10.50", prefix: 24 }, note: "直接投递给目的主机" },
  { label: "小 MTU", patch: { mtu: 1000 }, note: "IP 包超过 MTU，需要分片" },
  { label: "大块数据", patch: { dataBytes: 8000 }, note: "分更多段" },
];

function Inputs({ input, onChange }: { input: SendInput; onChange: (n: SendInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field"><span>数据量 (B)</span>
        <select value={input.dataBytes} onChange={(e) => onChange({ ...input, dataBytes: Number(e.target.value) })}>
          {[500, 1000, 3000, 8000].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="field"><span>MSS</span>
        <select value={input.mss} onChange={(e) => onChange({ ...input, mss: Number(e.target.value) })}>
          {[536, 1000, 1460].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="field"><span>MTU</span>
        <select value={input.mtu} onChange={(e) => onChange({ ...input, mtu: Number(e.target.value) })}>
          {[576, 1000, 1500].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="field field-grow"><span>源 IP</span>
        <input type="text" value={input.srcIp} spellCheck={false}
          onChange={(e) => onChange({ ...input, srcIp: e.target.value })} style={{ fontFamily: "var(--mono)" }} />
      </label>
      <label className="field field-grow"><span>目的 IP</span>
        <input type="text" value={input.dstIp} spellCheck={false}
          onChange={(e) => onChange({ ...input, dstIp: e.target.value })} style={{ fontFamily: "var(--mono)" }} />
      </label>
      <label className="field"><span>前缀</span>
        <select value={input.prefix} onChange={(e) => onChange({ ...input, prefix: Number(e.target.value) })}>
          {[8, 16, 24, 25, 26].map((v) => <option key={v} value={v}>/{v}</option>)}
        </select>
      </label>
      <div className="field" style={{ flexBasis: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-quiet" title={p.note}
              onClick={() => onChange({ ...input, ...p.patch })}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}



function Stack({ s }: { s: SendState }) {
  const first = s.packets[0];
  if (!first) return null;
  return (
    <div className="encap">
      <div className="encap-label">链路层帧（以太网）</div>
      <div className="encap-frame">
        <span className="encap-part eth">以太网头 14</span>
        <div className="encap-ip">
          <span className="encap-part ip">IP 头 20</span>
          <div className="encap-tcp">
            <span className="encap-part tcp">TCP 头 20</span>
            <span className="encap-part data">数据 {first.payload}</span>
          </div>
        </div>
        <span className="encap-part eth">FCS 4</span>
      </div>
      <div className="encap-note">
        目的 MAC <code>{s.dstMac}</code> · 类型 <code>0x0800</code> · TTL <code>{s.input.ttl}</code>
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<SendState, SendEvent> | undefined }) {
  const s = frame?.state;
  if (!s) return <section className="panel"><div className="panel-body"><p className="empty">应用输入后开始</p></div></section>;

  return (
    <section className="panel" aria-label="发送链路">
      <div className="panel-head">
        <h2>数据怎么被一层层包起来</h2>
        <span className="hint">{s.segments.length} 段 · {s.packets.length} 包{s.needsFragmentation ? ` · ${s.fragments.length} 分片` : ""}</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        <Pipeline stages={STAGES} current={s.stage} ariaLabel="发送链路阶段" />

        <div>
          <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>TCP 分段（每段 ≤ MSS {s.input.mss}）</strong>
          <div className="stack-row">
            {s.segments.map((seg) => (
              <span key={seg.index} className="stack-chip">
                #{seg.index + 1} <span className="muted">{seg.bytes}B</span>
                <span className="seq-no">{seg.seqStart}–{seg.seqEnd}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mini-grid">
          <div className="addr-box">
            <div className="muted" style={{ fontSize: 10.5 }}>子网判断</div>
            <div style={{ fontSize: 12 }}>
              {s.srcNetwork}/{s.input.prefix} → {s.dstNetwork}/{s.input.prefix}
            </div>
            <div style={{ fontSize: 11.5, color: s.sameSubnet ? "var(--hit)" : "var(--accent)" }}>
              {s.sameSubnet ? "同子网：直接投递" : "跨子网：交给网关"}
            </div>
          </div>
          <div className="addr-box">
            <div className="muted" style={{ fontSize: 10.5 }}>下一跳 / ARP 目标</div>
            <div>{s.nextHop}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>目的 MAC {s.dstMac}</div>
          </div>
        </div>

        <Stack s={s} />

        {s.needsFragmentation && (
          <div>
            <strong style={{ fontSize: 12.5, color: "var(--miss)" }}>IP 分片（每片载荷按 8 字节对齐）</strong>
            <table className="data-table" style={{ marginTop: 6 }}>
              <thead><tr><th scope="col">片</th><th scope="col">偏移</th><th scope="col">载荷</th><th scope="col">MF</th></tr></thead>
              <tbody>
                {s.fragments.map((f) => (
                  <tr key={f.index}>
                    <th scope="row">{f.index + 1}</th>
                    <td className="mono">{f.offset}</td>
                    <td className="mono">{f.bytes}</td>
                    <td className="mono">{f.more ? 1 : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<SendState, SendEvent> | undefined }) {
  const s = frame?.state;
  const payload = s?.input.dataBytes ?? 0;
  const overhead = s?.overhead ?? 0;
  const total = payload + overhead;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="链路上的字节">
        <Metrics
          items={[
            { label: "有效载荷", value: payload },
            { label: "头部开销", value: overhead, tone: "bad" },
            { label: "总字节", value: total },
            {
              label: "开销占比",
              value: total > 0 ? ((overhead / total) * 100).toFixed(1) : "0.0",
              unit: "%",
              span: 3,
            },
          ]}
        />
      </Panel>

      <section className="panel" aria-label="要点">
        <div className="panel-head"><h2>三个最容易混的点</h2></div>
        <div className="panel-body" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          <p style={{ marginTop: 0 }}>
            <strong>分段 ≠ 分片</strong>：TCP 按 MSS 分段，IP 按 MTU 分片，两者在不同层、可能同时发生。
          </p>
          <p>
            <strong>跨子网时目的 MAC 是网关</strong>，不是最终主机——链路层只负责相邻一跳。
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>ARP 只解析下一跳</strong>：跨子网时问的是网关的 MAC。
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<SendInput, SendState, SendEvent> = {
  meta: sendModule.meta,
  defaultInput: sendModule.defaultInput,
  simulate: sendModule.simulate,
  Inputs,
  Stage,
  Side,
};