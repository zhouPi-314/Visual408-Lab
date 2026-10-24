import { module as graph } from "@visual408/sim-core/modules/graph-traversal";
import { MODE_NAME, DEFAULT_EDGES } from "@visual408/sim-core/modules/graph-traversal";
import type { GraphEvent, GraphInput, GraphState, Frame, Issue } from "@visual408/sim-core";
import { ChipRow, Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const PRESETS = [
  { label: "五结点", edges: DEFAULT_EDGES, nodes: 5 },
  { label: "两个分量", edges: "0-1, 1-2, 3-4", nodes: 6 },
  { label: "三角形", edges: "0-1, 1-2, 2-0", nodes: 3 },
];

function Inputs({ input, onChange }: { input: GraphInput; onChange: (n: GraphInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field"><span>遍历方式</span>
        <select value={input.mode} onChange={(e) => onChange({ ...input, mode: e.target.value as GraphInput["mode"] })}>
          <option value="bfs">广度优先 BFS（队列）</option>
          <option value="dfs">深度优先 DFS（栈）</option>
        </select>
      </label>
      <label className="field"><span>起点</span>
        <select value={input.start} onChange={(e) => onChange({ ...input, start: Number(e.target.value) })}>
          {Array.from({ length: input.nodes }, (_, i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>
      <label className="field field-grow"><span>边表（a-b，逗号分隔）</span>
        <textarea rows={2} spellCheck={false} value={input.edges}
          onChange={(e) => onChange({ ...input, edges: e.target.value })} />
      </label>
      <label className="field"><span>结点数</span>
        <select value={input.nodes} onChange={(e) => onChange({ ...input, nodes: Number(e.target.value) })}>
          {[3, 4, 5, 6, 7, 8].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <div className="field" style={{ flexBasis: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-quiet"
              onClick={() => onChange({ ...input, edges: p.edges, nodes: p.nodes })}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<GraphState, GraphEvent> | undefined }) {
  const s = frame?.state;
  if (!s) return <Panel title="图的遍历"><p className="empty">应用输入后开始</p></Panel>;
  const W = 420;
  const cx = W / 2;
  const cy = 190;
  const R = 140;
  const pos = Array.from({ length: s.n }, (_, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / s.n;
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });
  const visited = new Set(s.visited);

  return (
    <Panel title="遍历过程" hint={MODE_NAME[s.mode] + " · " + s.n + " 个结点"}>
      <div style={{ display: "grid", gap: 14 }}>
        <svg viewBox={"0 0 " + W + " 370"} width="100%" role="img" aria-label="图与遍历状态" style={{ maxWidth: 460 }}>
          {s.matrix.flatMap((row, i) =>
            row.map((v, j) =>
              v && j > i ? (
                <line key={i + "-" + j} x1={pos[i]!.x} y1={pos[i]!.y} x2={pos[j]!.x} y2={pos[j]!.y}
                  stroke="var(--line-strong)" strokeWidth={1.6} />
              ) : null,
            ),
          )}
          {s.treeEdges.map(([a, b], k) => (
            <line key={"t" + k} x1={pos[a]!.x} y1={pos[a]!.y} x2={pos[b]!.x} y2={pos[b]!.y}
              stroke="var(--hit)" strokeWidth={2.6} strokeDasharray="6 3" />
          ))}
          {pos.map((p, i) => {
            const isVisited = visited.has(i);
            const isCurrent = s.current === i;
            const inFrontier = s.frontier.includes(i);
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={22}
                  fill={isVisited ? "var(--hit)" : isCurrent ? "var(--primary-soft)" : "var(--surface)"}
                  stroke={isCurrent ? "var(--primary)" : inFrontier ? "var(--accent)" : "var(--line-strong)"}
                  strokeWidth={isCurrent ? 3 : inFrontier ? 2.5 : 1.5} />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={14} fontWeight={600}
                  fontFamily="var(--mono)" fill={isVisited ? "#fff" : "var(--ink)"}>{i}</text>
              </g>
            );
          })}
        </svg>

        <div>
          <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            {s.mode === "bfs" ? "队列（队首在左）" : "栈（栈顶在右）"}
          </strong>
          <ChipRow items={s.frontier.map((n) => ({ label: n }))} />
        </div>

        <div>
          <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>访问序列</strong>
          <ChipRow
            items={s.visited.map((n, i) => ({ label: n, note: i + 1, variant: "visited" as const }))}
            emptyText="（还没有访问）"
          />
        </div>
      </div>
    </Panel>
  );
}

function Side({ frame }: { frame: Frame<GraphState, GraphEvent> | undefined }) {
  const s = frame?.state;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="统计">
        <Metrics items={[
          { label: "已访问", value: s?.visited.length ?? 0, tone: "good" },
          { label: "剩余", value: s ? s.n - s.visited.length : 0 },
          { label: "树边", value: s?.treeEdges.length ?? 0 },
        ]} />
      </Panel>
      <Panel title="两种遍历的差别">
        <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          <p style={{ marginTop: 0 }}><strong>BFS 用队列</strong>：先入先出，按层扩散，得到最短边数路径。</p>
          <p style={{ marginBottom: 0 }}><strong>DFS 用栈</strong>：后入先出，一条路走到黑，天然适合判连通与拓扑排序。</p>
        </div>
      </Panel>
    </div>
  );
}

export const renderer: ModuleRenderer<GraphInput, GraphState, GraphEvent> = {
  meta: graph.meta, defaultInput: graph.defaultInput, simulate: graph.simulate, Inputs, Stage, Side,
};
