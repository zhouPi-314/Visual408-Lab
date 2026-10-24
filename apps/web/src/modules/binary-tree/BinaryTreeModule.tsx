import { module as treeModule } from "@visual408/sim-core/modules/binary-tree-traversal";
import {
  ORDER_NAME,
  PRESET_TREE,
  formatTree,
  parseTreeInput,
  treeHeight,
} from "@visual408/sim-core/modules/binary-tree-traversal";
import type {
  Frame,
  Issue,
  TreeEvent,
  TreeInput,
  TreeOrder,
  TreeState,
} from "@visual408/sim-core";
import { CodePanel, Metrics, Panel } from "@visual408/display";
import type { ModuleRenderer } from "../../app/types";

const ORDERS: TreeOrder[] = ["pre", "in", "post", "level"];
const PRESETS: { label: string; tree: (string | null)[] }[] = [
  { label: "教学树", tree: PRESET_TREE },
  { label: "满二叉树", tree: ["A", "B", "C", "D", "E", "F", "G"] },
  { label: "退化链", tree: ["A", "B", null, "C", null, "D"] },
];

const CPP = [
  "void traverse(Node* n, std::vector<std::string>& out) {",
  "    if (!n) return;                                   // 空子树：直接返回",
  "    // 先序：这一行在左右递归之前；中序在两者之间；后序在之后",
  "    out.push_back(n->v);                              // 访问点",
  "    traverse(n->left, out);",
  "    traverse(n->right, out);",
  "}",
];
const CPP_FIRST = 6;

const NODE_R = 20;
const DX = 64;
const DY = 78;
const PAD = 42;

function layout(nodes: (string | null)[]) {
  const pos = new Map<number, { x: number; y: number }>();
  let cursor = 0;
  const walk = (i: number) => {
    if (i >= nodes.length || nodes[i] === null) return;
    walk(2 * i + 1);
    pos.set(i, { x: cursor++, y: Math.floor(Math.log2(i + 1)) });
    walk(2 * i + 2);
  };
  walk(0);
  return { pos, count: cursor };
}

function Inputs({ input, onChange }: { input: TreeInput; onChange: (n: TreeInput) => void; issues: readonly Issue[] }) {
  return (
    <div className="input-bar">
      <label className="field">
        <span>遍历序</span>
        <select value={input.order}
          onChange={(e) => {
            const order = e.target.value as TreeOrder;
            onChange({ ...input, order, mode: order === "level" ? "iterative" : input.mode });
          }}>
          {ORDERS.map((o) => <option key={o} value={o}>{ORDER_NAME[o]}遍历</option>)}
        </select>
      </label>
      <label className="field">
        <span>实现方式</span>
        <select value={input.mode} disabled={input.order === "level"}
          onChange={(e) => onChange({ ...input, mode: e.target.value as TreeInput["mode"] })}>
          <option value="recursive">递归（系统栈）</option>
          <option value="iterative">非递归（显式栈/队列）</option>
        </select>
      </label>
      <label className="field field-grow">
        <span>层序数组（_ 表示空位）</span>
        <textarea rows={2} spellCheck={false} value={formatTree(input.tree)}
          onChange={(e) => onChange({ ...input, tree: parseTreeInput(e.target.value) })} />
      </label>
      <div className="bits-legend">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet"
            onClick={() => onChange({ ...input, tree: p.tree })}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function Stage({ frame }: { frame: Frame<TreeState, TreeEvent> | undefined }) {
  const state = frame?.state;
  const nodes = state?.nodes ?? [];
  const { pos, count } = layout(nodes);
  const height = treeHeight(nodes);
  const width = Math.max(count * DX + PAD * 2, 320);
  const chartHeight = Math.max(height * DY + PAD * 2, 200);
  const visitedIds = new Set((state?.visited ?? []).map((v) => v.node));
  const stackIds = new Set((state?.stack ?? []).map((v) => v.node));
  const current = state?.current;

  return (
    <section className="panel" aria-label="二叉树与遍历状态">
      <div className="panel-head">
        <h2>树形与遍历状态</h2>
        <span className="hint">{state ? `${ORDER_NAME[state.order]} · ${pos.size} 个结点 · 深度 ${height}` : "等待输入"}</span>
      </div>
      <div className="panel-body">
        {pos.size === 0 ? (
          <p className="empty">空树：没有可访问的结点</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <svg
              width={width}
              height={chartHeight}
              role="img"
              aria-label={`二叉树渲染图，共 ${pos.size} 个结点`}
              style={{ display: "block", maxWidth: "100%" }}
            >
              {[...pos.entries()].map(([i, p]) => {
                const children = [2 * i + 1, 2 * i + 2].filter(
                  (c) => nodes[c] !== null && nodes[c] !== undefined,
                );
                return children.map((c) => {
                  const cp = pos.get(c);
                  if (!cp) return null;
                  return (
                    <line
                      key={`e-${i}-${c}`}
                      x1={PAD + p.x * DX} y1={PAD + p.y * DY}
                      x2={PAD + cp.x * DX} y2={PAD + cp.y * DY}
                      stroke="var(--line-strong)" strokeWidth={1.5}
                    />
                  );
                });
              })}

              {[...pos.entries()].map(([i, p]) => {
                const cx = PAD + p.x * DX;
                const cy = PAD + p.y * DY;
                const isCurrent = current === i;
                const isVisited = visitedIds.has(i);
                const inStack = stackIds.has(i);
                const fill = isVisited ? "var(--hit)" : isCurrent ? "var(--primary-soft)" : "var(--surface)";
                const stroke = inStack ? "var(--accent)" : isCurrent ? "var(--primary)" : "var(--line-strong)";
                return (
                  <g key={`n-${i}`}>
                    <circle
                      cx={cx} cy={cy} r={NODE_R}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isCurrent ? 3 : inStack ? 2.5 : 1.5}
                      strokeDasharray={inStack && !isCurrent ? "4 3" : undefined}
                    />
                    <text
                      x={cx} y={cy + 5} textAnchor="middle"
                      fontSize={14} fontWeight={600}
                      fill={isVisited ? "#fff" : "var(--ink)"}
                      fontFamily="var(--mono)"
                    >
                      {nodes[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div>
            <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>递归栈 / 队列</strong>
            <div className="stack-row">
              {(state?.order === "level" ? state.queue : state?.stack ?? []).length === 0 ? (
                <span className="muted" style={{ fontSize: 13 }}>（空）</span>
              ) : (
                (state?.order === "level" ? state.queue : state?.stack ?? []).map((s, i) => (
                  <span key={`${s.node}-${i}`} className="stack-chip">{s.label}</span>
                ))
              )}
            </div>
          </div>
          <div>
            <strong style={{ fontSize: 12.5, color: "var(--ink-2)" }}>访问序列</strong>
            <div className="stack-row">
              {(state?.visited ?? []).length === 0 ? (
                <span className="muted" style={{ fontSize: 13 }}>（还没有访问）</span>
              ) : (
                state!.visited.map((v, i) => (
                  <span key={`${v.node}-${i}`} className="stack-chip is-visited">
                    <span className="seq-no">{i + 1}</span>{v.label}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="legend">
          <span><i style={{ background: "var(--hit)" }} />已访问</span>
          <span><i style={{ background: "var(--primary-soft)", border: "2px solid var(--primary)" }} />当前结点</span>
          <span><i style={{ background: "var(--surface)", border: "2px dashed var(--accent)" }} />在栈中</span>
        </div>
      </div>
    </section>
  );
}

function Side({ frame }: { frame: Frame<TreeState, TreeEvent> | undefined }) {
  const state = frame?.state;
  const active = frame?.code?.line;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="当前进度">
        <Metrics
          items={[
            { label: "已访问", value: state?.visited.length ?? 0 },
            { label: "栈深", value: state?.stack.length ?? 0 },
            { label: "树高", value: state ? treeHeight(state.nodes) : 0 },
          ]}
        />
        <p className="field-note" style={{ marginTop: 10 }}>
          栈深等于「当前还没返回的祖先个数」；后序遍历时栈最深。
        </p>
      </Panel>

      <CodePanel lines={CPP} firstLine={CPP_FIRST} activeLine={active} />
    </div>
  );
}

export const renderer: ModuleRenderer<TreeInput, TreeState, TreeEvent> = {
  meta: treeModule.meta,
  defaultInput: treeModule.defaultInput,
  simulate: treeModule.simulate,
  Inputs,
  Stage,
  Side,
};