import { module as tcpModule } from "@visual408/sim-core/modules/tcp-handshake";
import type {
  Frame,
  Issue,
  TcpEvent,
  TcpInput,
  TcpPacket,
  TcpScenario,
  TcpState,
} from "@visual408/sim-core";
import { Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const SCENARIOS: { id: TcpScenario; label: string }[] = [
  { id: "normal", label: "正常（三次握手 + 四次挥手）" },
  { id: "rst-refused", label: "被拒绝（RST）" },
  { id: "last-ack-lost", label: "末次 ACK 丢失" },
  { id: "simultaneous-close", label: "同时关闭" },
];

const LEFT_X = 150;
const RIGHT_X = 550;
const TOP = 74;
const STEP_Y = 46;

function Inputs({ input, onChange }: { input: TcpInput; onChange: (n: TcpInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field" style={{ flex: "1 1 240px" }}>
        <span>场景</span>
        <select value={input.scenario} onChange={(e) => onChange({ ...input, scenario: e.target.value as TcpScenario })}>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>客户端 ISN</span>
        <input type="text" inputMode="numeric" value={input.clientIsn}
          onChange={(e) => onChange({ ...input, clientIsn: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </label>
      <label className="field">
        <span>服务端 ISN</span>
        <input type="text" inputMode="numeric" value={input.serverIsn}
          onChange={(e) => onChange({ ...input, serverIsn: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </label>
      <label className="field">
        <span>客户端数据</span>
        <select value={input.clientDataBytes}
          onChange={(e) => onChange({ ...input, clientDataBytes: Number(e.target.value) })}>
          {[0, 100, 1000, 1460].map((v) => <option key={v} value={v}>{v} B</option>)}
        </select>
      </label>
      <label className="field">
        <span>服务端数据</span>
        <select value={input.serverDataBytes}
          onChange={(e) => onChange({ ...input, serverDataBytes: Number(e.target.value) })}>
          {[0, 100, 200, 1000].map((v) => <option key={v} value={v}>{v} B</option>)}
        </select>
      </label>
    </div>
  );
}

function StateChip({ label, state }: { label: string; state: string }) {
  const tone =
    state === "ESTABLISHED" ? "is-good"
    : state === "TIME_WAIT" ? "is-warn"
    : state === "CLOSED" ? "is-muted"
    : "is-active";
  return (
    <div className={`state-chip ${tone}`}>
      <span>{label}</span>
      <strong className="mono">{state}</strong>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<TcpState, TcpEvent> | undefined }) {
  const state = frame?.state;
  const packets = state?.packets ?? [];
  const height = TOP + Math.max(packets.length, 1) * STEP_Y + 26;
  const currentIndex = state?.currentIndex;

  return (
    <section className="panel" aria-label="TCP 报文时序">
      <div className="panel-head">
        <h2>报文时序</h2>
        <span className="hint">每格 = 0.5 RTT · 虚线 = 丢失/重传</span>
      </div>
      <div className="panel-body">
        <div className="state-row">
          <StateChip label="客户端" state={state?.clientState ?? "CLOSED"} />
          <span className="state-arrow" aria-hidden="true">⇄</span>
          <StateChip label="服务端" state={state?.serverState ?? "CLOSED"} />
        </div>

        {packets.length === 0 ? (
          <p className="empty">还没有发出任何报文</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 700 ${height}`} width="100%" height={height} role="img"
              aria-label={`TCP 时序图，共 ${packets.length} 个报文`} style={{ display: "block" }}>
              {/* 生命线 */}
              <line x1={LEFT_X} y1={TOP - 26} x2={LEFT_X} y2={height - 14} stroke="var(--line-strong)" strokeDasharray="5 5" />
              <line x1={RIGHT_X} y1={TOP - 26} x2={RIGHT_X} y2={height - 14} stroke="var(--line-strong)" strokeDasharray="5 5" />
              <text x={LEFT_X} y={TOP - 36} textAnchor="middle" fontSize={13} fontWeight={650} fill="var(--ink)">客户端</text>
              <text x={RIGHT_X} y={TOP - 36} textAnchor="middle" fontSize={13} fontWeight={650} fill="var(--ink)">服务端</text>

              {packets.map((p: TcpPacket, i) => {
                const y = TOP + i * STEP_Y;
                const fromLeft = p.from === "C";
                const x1 = fromLeft ? LEFT_X : RIGHT_X;
                const x2 = fromLeft ? RIGHT_X : LEFT_X;
                const dir = fromLeft ? 1 : -1;
                const active = currentIndex === p.index;
                const color = p.lost ? "var(--miss)" : active ? "var(--primary)" : "var(--ink-2)";
                const label = `${p.flags}${p.bytes !== undefined ? ` · ${p.bytes}B` : ""}`;
                return (
                  <g key={p.index}>
                    <line x1={x1} y1={y} x2={x2 - dir * 10} y2={y}
                      stroke={color} strokeWidth={active ? 2.6 : 1.6}
                      strokeDasharray={p.lost ? "6 4" : undefined} />
                    <polygon
                      points={`${x2},${y} ${x2 - dir * 10},${y - 4} ${x2 - dir * 10},${y + 4}`}
                      fill={color} />
                    <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize={11.5}
                      fontFamily="var(--mono)" fontWeight={active ? 700 : 600} fill={color}>
                      {label}
                    </text>
                    <text x={(x1 + x2) / 2} y={y + 15} textAnchor="middle" fontSize={10.5}
                      fontFamily="var(--mono)" fill="var(--ink-3)">
                      seq={p.seq} ack={p.ack}{p.lost ? " · 丢失" : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<TcpState, TcpEvent> | undefined }) {
  const state = frame?.state;
  const packets = state?.packets ?? [];
  const last = packets[packets.length - 1];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="统计">
        <Metrics
          items={[
            { label: "报文数", value: packets.length },
            { label: "用时", value: state?.clock ?? 0, unit: "×0.5RTT" },
            { label: "丢失", value: packets.filter((p) => p.lost).length },
          ]}
        />
      </Panel>

      <section className="panel" aria-label="本步说明">
        <div className="panel-head"><h2>本步说明</h2></div>
        <div className="panel-body" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          {last ? <p style={{ margin: 0 }}>{last.note}</p> : <p style={{ margin: 0 }}>连接开始前，双方都在 CLOSED。</p>}
          <p className="field-note" style={{ marginTop: 10 }}>
            三次握手的本质：双方各自确认「自己的发送」和「对方的接收」都被见证。
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<TcpInput, TcpState, TcpEvent> = {
  meta: tcpModule.meta,
  defaultInput: tcpModule.defaultInput,
  simulate: tcpModule.simulate,
  Inputs,
  Stage,
  Side,
};