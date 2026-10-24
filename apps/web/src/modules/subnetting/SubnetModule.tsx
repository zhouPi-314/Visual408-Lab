import { module as subnet } from "@visual408/sim-core/modules/subnetting";
import type { Frame, Issue, SubnetEvent, SubnetInput, SubnetState } from "@visual408/sim-core";
import type { ModuleRenderer } from "../../app/types";

const PRESETS = [8, 16, 24, 25, 26, 30];

function BitRow({
  label,
  bits,
  prefix,
  active,
}: {
  label: string;
  bits: number[];
  prefix: number;
  active: boolean;
}) {
  return (
    <div className={`bitrow${active ? " is-active" : ""}`}>
      <span className="bitrow-label">{label}</span>
      <div className="bitcells">
        {[0, 1, 2, 3].map((group) => (
          <div key={group} className="bitgroup">
            {bits.slice(group * 8, group * 8 + 8).map((bit, k) => {
              const i = group * 8 + k;
              const isNet = i < prefix;
              return (
                <span
                  key={i}
                  className={`bitcell ${isNet ? "is-net" : "is-host"}${bit ? " is-one" : ""}${i === prefix - 1 ? " is-edge" : ""}`}
                  title={`第 ${i + 1} 位（${isNet ? "网络号" : "主机号"}）`}
                >
                  {bit}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Inputs({ input, onChange }: { input: SubnetInput; onChange: (n: SubnetInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field" style={{ flex: "0 1 220px" }}>
        <span>IPv4 地址</span>
        <input type="text" value={input.ip} spellCheck={false}
          onChange={(e) => onChange({ ...input, ip: e.target.value })} style={{ fontFamily: "var(--mono)" }} />
      </label>
      <label className="field" style={{ flex: "1 1 260px" }}>
        <span>前缀长度 /{input.prefix}</span>
        <input type="range" min={0} max={32} value={input.prefix}
          onChange={(e) => onChange({ ...input, prefix: Number(e.target.value) })}
          aria-label="前缀长度" style={{ accentColor: "var(--primary)" }} />
      </label>
      <div className="bits-legend">
        {PRESETS.map((p) => (
          <button key={p} type="button" className="btn btn-quiet"
            onClick={() => onChange({ ...input, prefix: p })}>/{p}</button>
        ))}
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<SubnetState, SubnetEvent> | undefined }) {
  const s = frame?.state;
  if (!s) return <section className="panel"><div className="panel-body"><p className="empty">应用输入后开始</p></div></section>;

  return (
    <section className="panel" aria-label="子网划分">
      <div className="panel-head">
        <h2>32 位逐位对照</h2>
        <span className="hint">前 {s.prefix} 位网络号（蓝）· 后 {32 - s.prefix} 位主机号（青）</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 10 }}>
        <BitRow label={s.ip} bits={s.ipBits} prefix={s.prefix} active={s.stage === 1} />
        <BitRow label="掩码" bits={s.maskBits} prefix={s.prefix} active={s.stage === 2} />
        <BitRow label="网络" bits={s.networkBits} prefix={s.prefix} active={s.stage === 3} />
        <BitRow label="广播" bits={s.broadcastBits} prefix={s.prefix} active={s.stage === 4} />

        <div className="addr-flow" style={{ marginTop: 6 }}>
          <div className="addr-box">
            <div className="muted" style={{ fontSize: 10.5 }}>网络地址</div>
            <div>{s.network}</div>
          </div>
          <div className="addr-box">
            <div className="muted" style={{ fontSize: 10.5 }}>广播地址</div>
            <div>{s.broadcast}</div>
          </div>
          <div className="addr-box">
            <div className="muted" style={{ fontSize: 10.5 }}>可用范围</div>
            <div style={{ fontSize: 12 }}>{s.hostCount > 0 ? `${s.firstHost} – ${s.lastHost}` : "无"}</div>
          </div>
          <div className="addr-box">
            <div className="muted" style={{ fontSize: 10.5 }}>可用主机数</div>
            <div>{s.hostCount}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<SubnetState, SubnetEvent> | undefined }) {
  const s = frame?.state;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel" aria-label="二进制">
        <div className="panel-head"><h2>十进制 ↔ 二进制</h2></div>
        <div className="panel-body">
          <table className="data-table">
            <thead><tr><th scope="col">段</th><th scope="col">十进制</th><th scope="col">二进制</th></tr></thead>
            <tbody>
              {[0, 1, 2, 3].map((g) => (
                <tr key={g}>
                  <th scope="row">{g + 1}</th>
                  <td className="mono">{(s ? Number(s.ip.split(".")[g]) : 0)}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>
                    {(s ? s.ipBits.slice(g * 8, g * 8 + 8).join("") : "00000000")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-label="速查">
        <div className="panel-head"><h2>常见前缀速查</h2></div>
        <div className="panel-body" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          <table className="data-table">
            <thead><tr><th scope="col">前缀</th><th scope="col">掩码尾</th><th scope="col">可用主机</th></tr></thead>
            <tbody>
              {[[24, "0", "254"], [25, "128", "126"], [26, "192", "62"], [30, "252", "2"]].map(([p, tail, hosts]) => (
                <tr key={String(p)} className={s?.prefix === p ? "is-active" : undefined}>
                  <th scope="row">/{p}</th>
                  <td className="mono">255.255.255.{tail}</td>
                  <td className="mono">{hosts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field-note" style={{ marginTop: 8 }}>
            可用主机 = 2^(32−前缀) − 2；/31 与 /32 是特例（点对点 / 单主机）。
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<SubnetInput, SubnetState, SubnetEvent> = {
  meta: subnet.meta,
  defaultInput: subnet.defaultInput,
  simulate: subnet.simulate,
  Inputs,
  Stage,
  Side,
};
