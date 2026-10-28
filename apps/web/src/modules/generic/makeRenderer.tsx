import { Metrics, Panel } from "@visual408/display";
import type { FieldDef, GenericModuleDef, GenericState } from "@visual408/sim-core";
import type { AnyRenderer } from "../../app/types";
import { GenericViews } from "./GenericViews";

/**
 * 通用渲染器工厂：只要模拟器提供 fields + views，就能得到一个完整实验页。
 * 15 个新实验共用这一份，不再逐个手写 UI。
 */
export function makeGenericRenderer(mod: GenericModuleDef<Record<string, never>> | GenericModuleDef<any>): AnyRenderer {
  const fields = mod.fields as FieldDef[];

  function Inputs({ input, onChange }: { input: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void; issues: readonly unknown[] }) {
    const presets = (mod.presets ?? []) as { label: string; patch: Record<string, unknown> }[];
    return (
      <div className="input-bar">
        {presets.length > 0 && (
          <div className="preset-row" role="group" aria-label="预设场景">
            <span className="preset-label">快速场景</span>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn btn-quiet preset-chip"
                onClick={() => onChange({ ...input, ...p.patch })}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {fields.map((f) => {
          const value = String(input[f.key] ?? "");
          if (f.type === "select") {
            return (
              <label key={f.key} className="field">
                <span>{f.label}</span>
                <select value={value} onChange={(e) => onChange({ ...input, [f.key]: e.target.value })}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            );
          }
          return (
            <label key={f.key} className={"field" + (f.type === "text" ? " field-grow" : "")}>
              <span>{f.label}</span>
              <input
                type={f.type === "number" ? "number" : "text"}
                value={value}
                placeholder={f.type === "text" ? f.placeholder : undefined}
                min={f.type === "number" ? f.min : undefined}
                max={f.type === "number" ? f.max : undefined}
                spellCheck={false}
                style={{ fontFamily: "var(--mono)", fontSize: 13 }}
                onChange={(e) => onChange({ ...input, [f.key]: e.target.value })}
              />
            </label>
          );
        })}
        <span className="field-note">{mod.summary}</span>
      </div>
    );
  }

  function Stage({ frame }: { frame: { state: GenericState } | undefined }) {
    return (
      <Panel title={mod.meta.title} hint={frame ? undefined : "调整参数后自动重算"}>
        {frame ? <GenericViews views={frame.state.views} /> : <p className="empty">应用输入后开始</p>}
      </Panel>
    );
  }

  function Side({ frame }: { frame: { state: GenericState } | undefined }) {
    const metrics = frame?.state.metrics ?? [];
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {metrics.length > 0 && (
          <Panel title="指标">
            <Metrics items={metrics.map((m) => ({ label: m.label, value: m.value, tone: m.tone }))} />
          </Panel>
        )}
        <Panel title="一句话要点">
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>{mod.takeaway}</p>
        </Panel>
      </div>
    );
  }

  return { meta: mod.meta, defaultInput: mod.defaultInput, simulate: mod.simulate, Inputs: Inputs as AnyRenderer["Inputs"], Stage, Side };
}