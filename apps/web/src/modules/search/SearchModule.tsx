import { module as search } from "@visual408/sim-core/modules/search";
import { MODE_NAME } from "@visual408/sim-core/modules/search";
import type { Frame, Issue, SearchEvent, SearchInput, SearchState } from "@visual408/sim-core";
import { Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const PRESETS = [
  { label: "1..11 找 7", data: "1, 3, 5, 7, 9, 11", target: 7 },
  { label: "1..7 找 6", data: "1, 2, 3, 4, 5, 6, 7", target: 6 },
  { label: "找不到", data: "2, 4, 6, 8, 10", target: 7 },
];

function Inputs({ input, onChange }: { input: SearchInput; onChange: (n: SearchInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field"><span>查找方式</span>
        <select value={input.mode} onChange={(e) => onChange({ ...input, mode: e.target.value as SearchInput["mode"] })}>
          <option value="binary">折半查找（要求升序）</option>
          <option value="sequential">顺序查找</option>
        </select>
      </label>
      <label className="field"><span>目标值</span>
        <input type="text" inputMode="numeric" value={input.target}
          onChange={(e) => onChange({ ...input, target: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          style={{ fontFamily: "var(--mono)", width: 90 }} />
      </label>
      <label className="field field-grow"><span>数据（逗号分隔）</span>
        <textarea rows={2} spellCheck={false} value={input.data}
          onChange={(e) => onChange({ ...input, data: e.target.value })} />
      </label>
      <div className="bits-legend">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet"
            onClick={() => onChange({ ...input, data: p.data, target: p.target })}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<SearchState, SearchEvent> | undefined }) {
  const s = frame?.state;
  if (!s) return <Panel title="查找"><p className="empty">应用输入后开始</p></Panel>;
  const eliminated = new Set(s.eliminated);

  return (
    <Panel title={MODE_NAME[s.mode]} hint={"目标 " + s.target + " · 区间 [" + s.low + ", " + s.high + "]"}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="search-cells">
          {s.array.map((v, i) => {
            const isMid = s.mid === i;
            const isFound = s.found === i;
            const isOut = eliminated.has(i);
            return (
              <div key={i}
                className={"search-cell" + (isFound ? " is-found" : isMid ? " is-mid" : isOut ? " is-out" : "")}>
                <span className="search-index">{i}</span>
                <span className="search-value">{v}</span>
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--accent)" }} />当前 mid</span>
          <span><i style={{ background: "var(--hit)" }} />命中</span>
          <span><i style={{ background: "var(--line-strong)" }} />已排除</span>
        </div>
        <p className="field-note" style={{ margin: 0 }}>
          折半查找每次把候选区间砍半：比较次数约为 log₂n；顺序查找最坏要比 n 次。
        </p>
      </div>
    </Panel>
  );
}

function Side({ frame }: { frame: Frame<SearchState, SearchEvent> | undefined }) {
  const s = frame?.state;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="统计">
        <Metrics items={[
          { label: "比较次数", value: s?.compares ?? 0 },
          { label: "剩余候选", value: s ? Math.max(0, s.high - s.low + 1) : 0 },
          { label: "结果", value: s?.found === undefined ? "未找到" : "位置 " + s.found, tone: s?.found === undefined ? "bad" : "good" },
        ]} />
      </Panel>
      <Panel title="折半查找的前提">
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)" }}>
          折半查找**必须**作用在有序表上；顺序存储才支持随机访问，
          链表上无法 O(1) 取 mid，因此不适用。
        </p>
      </Panel>
    </div>
  );
}

export const renderer: ModuleRenderer<SearchInput, SearchState, SearchEvent> = {
  meta: search.meta, defaultInput: search.defaultInput, simulate: search.simulate, Inputs, Stage, Side,
};
