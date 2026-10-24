import { module as sorting } from "@visual408/sim-core/modules/sorting";
import { ALGO_NAME, DEFAULT_DATA } from "@visual408/sim-core/modules/sorting";
import type {
  Frame,
  Issue,
  SortAlgorithm,
  SortEvent,
  SortInput,
  SortState,
} from "@visual408/sim-core";
import { Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const ALGOS: { id: SortAlgorithm; label: string; note: string }[] = [
  { id: "insertion", label: "直接插入", note: "每趟把一个数插进前面的有序区" },
  { id: "bubble", label: "冒泡", note: "每趟把最大值冒到末尾" },
  { id: "quick", label: "快速", note: "选枢轴、划分、递归" },
];

const PRESETS = [
  { label: "教学序列", data: DEFAULT_DATA },
  { label: "近乎有序", data: "13, 27, 38, 49, 65, 76, 97" },
  { label: "逆序", data: "97, 76, 65, 49, 38, 27, 13" },
];

const BAR_W = 34;
const GAP = 10;
const CHART_H = 150;
const BASE_Y = 20 + CHART_H;

function Inputs({ input, onChange }: { input: SortInput; onChange: (n: SortInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field" style={{ flex: "1 1 200px" }}>
        <span>算法</span>
        <select value={input.algorithm} onChange={(e) => onChange({ ...input, algorithm: e.target.value as SortAlgorithm })}>
          {ALGOS.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.note}</option>)}
        </select>
      </label>
      <label className="field field-grow">
        <span>待排序列（1–99 的整数，逗号或空格分隔）</span>
        <textarea rows={2} spellCheck={false} value={input.data}
          onChange={(e) => onChange({ ...input, data: e.target.value })} />
      </label>
      <div className="bits-legend">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet"
            onClick={() => onChange({ ...input, data: p.data })}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<SortState, SortEvent> | undefined }) {
  const s = frame?.state;
  const array = s?.array ?? [];
  const settled = new Set(s?.settled ?? []);
  const [ci, cj] = s?.comparing ?? [-1, -1];
  const [si, sj] = s?.swapping ?? [-1, -1];
  const width = Math.max(array.length * (BAR_W + GAP) + GAP, 320);

  return (
    <section className="panel" aria-label="排序状态">
      <div className="panel-head">
        <h2>{s ? ALGO_NAME[s.algorithm] : "排序"}</h2>
        <span className="hint">
          {s?.keyValue !== undefined ? `手里拿着 ${s.keyValue}` : s ? `第 ${s.pass} 趟` : "等待输入"}
        </span>
      </div>
      <div className="panel-body">
        {array.length === 0 ? (
          <p className="empty">应用输入后开始</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${width} ${BASE_Y + 30}`} width="100%" height={BASE_Y + 30} role="img"
              aria-label={`排序数组，共 ${array.length} 个元素`} style={{ display: "block" }}>
              <line x1={0} y1={BASE_Y} x2={width} y2={BASE_Y} stroke="var(--line-strong)" />
              {array.map((value, i) => {
                const x = GAP + i * (BAR_W + GAP);
                const isHole = value === null;
                const h = isHole ? 0 : Math.max(6, (value / 99) * CHART_H);
                const y = BASE_Y - h;
                const isComparing = i === ci || i === cj;
                const isSwapping = i === si || i === sj;
                const isPivot = s?.pivot === i;
                const isSettled = settled.has(i) && !isComparing && !isSwapping;
                const fill = isSwapping
                  ? "var(--miss)"
                  : isPivot
                    ? "var(--tag)"
                    : isSettled
                      ? "var(--hit)"
                      : isComparing
                        ? "var(--accent)"
                        : "var(--index)";
                return (
                  <g key={i}>
                    {isHole ? (
                      <rect x={x} y={BASE_Y - CHART_H} width={BAR_W} height={CHART_H}
                        fill="none" stroke="var(--line-strong)" strokeDasharray="4 4" rx={4} />
                    ) : (
                      <rect x={x} y={y} width={BAR_W} height={h} rx={4} fill={fill}
                        opacity={isComparing || isSwapping || isPivot ? 0.95 : 0.82} />
                    )}
                    <text x={x + BAR_W / 2} y={BASE_Y + 16} textAnchor="middle" fontSize={11}
                      fontFamily="var(--mono)" fill={isHole ? "var(--ink-3)" : "var(--ink)"}>
                      {isHole ? "空" : value}
                    </text>
                    <text x={x + BAR_W / 2} y={BASE_Y + 28} textAnchor="middle" fontSize={9.5}
                      fill="var(--ink-3)" fontFamily="var(--mono)">{i}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <div className="legend" style={{ marginTop: 10 }}>
          <span><i style={{ background: "var(--index)" }} />未排序</span>
          <span><i style={{ background: "var(--accent)" }} />正在比较</span>
          <span><i style={{ background: "var(--miss)" }} />正在交换</span>
          <span><i style={{ background: "var(--tag)" }} />枢轴</span>
          <span><i style={{ background: "var(--hit)" }} />已就位</span>
        </div>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<SortState, SortEvent> | undefined }) {
  const s = frame?.state;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="统计">
        <Metrics
          items={[
            { label: "比较", value: s?.stats.compares ?? 0 },
            { label: "移动", value: s?.stats.moves ?? 0 },
            { label: "趟数", value: s?.pass ?? 0 },
          ]}
        />
      </Panel>

      <section className="panel" aria-label="复杂度与稳定性">
        <div className="panel-head"><h2>复杂度与稳定性</h2></div>
        <div className="panel-body" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          <table className="data-table">
            <thead><tr><th scope="col">算法</th><th scope="col">平均</th><th scope="col">最坏</th><th scope="col">稳定</th></tr></thead>
            <tbody>
              <tr className={s?.algorithm === "insertion" ? "is-active" : undefined}><th scope="row">插入</th><td className="mono">O(n²)</td><td className="mono">O(n²)</td><td className="yes">是</td></tr>
              <tr className={s?.algorithm === "bubble" ? "is-active" : undefined}><th scope="row">冒泡</th><td className="mono">O(n²)</td><td className="mono">O(n²)</td><td className="yes">是</td></tr>
              <tr className={s?.algorithm === "quick" ? "is-active" : undefined}><th scope="row">快速</th><td className="mono">O(nlogn)</td><td className="mono">O(n²)</td><td className="no">否</td></tr>
            </tbody>
          </table>
          <p className="field-note" style={{ marginTop: 8 }}>
            快排最坏出现在「每次枢轴都是最大/最小」，此时退化成 O(n²)。
          </p>
        </div>
      </section>
    </div>
  );
}

export const renderer: ModuleRenderer<SortInput, SortState, SortEvent> = {
  meta: sorting.meta,
  defaultInput: sorting.defaultInput,
  simulate: sorting.simulate,
  Inputs,
  Stage,
  Side,
};