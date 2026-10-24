import type { ReactNode } from "react";

/**
 * 共享渲染层：把在 3 个以上模块里重复出现的结构收进来。
 *
 * 设计约束：**输出的类名与现有 styles.css 完全一致**，
 * 所以抽取过程不改变任何视觉效果（可用截图对比验证）。
 */

export function Panel({
  title,
  hint,
  actions,
  children,
  ariaLabel,
  className,
}: {
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`} aria-label={ariaLabel ?? title}>
      <div className="panel-head">
        <h2>{title}</h2>
        {hint !== undefined && <span className="hint">{hint}</span>}
        {actions}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export interface MetricItem {
  label: string;
  value: ReactNode;
  tone?: "good" | "bad";
  unit?: string;
  /** 栅格跨列，多列布局时用来占满整行 */
  span?: number;
}

export function Metrics({ items }: { items: MetricItem[] }) {
  return (
    <dl className="metrics">
      {items.map((m) => (
        <div
          key={m.label}
          className={`metric${m.tone ? ` is-${m.tone}` : ""}`}
          style={m.span ? { gridColumn: `span ${m.span}` } : undefined}
        >
          <dt>{m.label}</dt>
          <dd>
            {m.value}
            {m.unit && <span className="unit">{m.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface Column {
  label: string;
  /** 首列通常作为行标题 */
  rowHeader?: boolean;
}

export function DataTable({
  caption,
  columns,
  rows,
  empty = "暂无数据",
  minWidth,
  className,
}: {
  caption?: string;
  columns: Column[];
  rows: ReactNode[][];
  empty?: string;
  minWidth?: number;
  className?: string;
}) {
  return (
    <table className={`data-table${className ? ` ${className}` : ""}`}
      style={minWidth ? { minWidth } : undefined}>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.label} scope="col">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="empty">{empty}</td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                j === 0 && columns[0]?.rowHeader ? (
                  <th key={j} scope="row">{cell}</th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export interface StageDef {
  id: number;
  label: string;
}

export function Pipeline({
  stages,
  current,
  isDone,
  isSkipped,
  ariaLabel = "阶段",
}: {
  stages: readonly StageDef[];
  current: number;
  isDone?: (id: number) => boolean;
  isSkipped?: (id: number) => boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="pipeline" role="list" aria-label={ariaLabel}>
      {stages.map((s) => {
        const done = isDone?.(s.id) ?? current > s.id;
        const skipped = isSkipped?.(s.id) ?? false;
        return (
          <span
            key={s.id}
            role="listitem"
            className={`stage-chip${current === s.id ? " is-active" : done ? " is-done" : ""}${skipped ? " is-skip" : ""}`}
          >
            <b>{s.id}</b>
            {s.label}
          </span>
        );
      })}
    </div>
  );
}

export interface ChipItem {
  label: ReactNode;
  note?: ReactNode;
  variant?: "plain" | "visited";
  title?: string;
}

export function ChipRow({
  items,
  ariaLabel,
  emptyText = "（空）",
}: {
  items: ChipItem[];
  ariaLabel?: string;
  emptyText?: string;
}) {
  return (
    <div className="stack-row" aria-label={ariaLabel}>
      {items.length === 0 ? (
        <span className="muted" style={{ fontSize: 13 }}>{emptyText}</span>
      ) : (
        items.map((item, i) => (
          <span
            key={i}
            title={item.title}
            className={`stack-chip${item.variant === "visited" ? " is-visited" : ""}`}
          >
            {item.label}
            {item.note !== undefined && <span className="seq-no">{item.note}</span>}
          </span>
        ))
      )}
    </div>
  );
}

export function AddrBox({
  label,
  value,
  hint,
  mono = true,
  wide,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="addr-box" style={wide ? { flex: "1 1 260px" } : undefined}>
      <div className="muted" style={{ fontSize: 10.5 }}>{label}</div>
      <div style={mono ? { fontFamily: "var(--mono)" } : undefined}>{value}</div>
      {hint !== undefined && <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{hint}</div>}
    </div>
  );
}

export function CodePanel({
  title = "代码联动",
  language = "C++",
  lines,
  firstLine,
  activeLine,
  footer,
}: {
  title?: string;
  language?: string;
  lines: string[];
  firstLine: number;
  activeLine?: number;
  footer?: ReactNode;
}) {
  return (
    <Panel title={title} hint={language}>
      <pre className="code-block">
        {lines.map((line, i) => {
          const no = firstLine + i;
          return (
            <code key={no} className={`code-line${activeLine === no ? " is-active" : ""}`}>
              <span className="ln" aria-hidden="true">{no}</span>
              {line}
            </code>
          );
        })}
      </pre>
      {footer}
    </Panel>
  );
}

export function Legend({ items }: { items: { color: string; label: string; outline?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i
            style={
              it.outline
                ? { background: "var(--surface)", border: `2px solid ${it.color}` }
                : { background: it.color }
            }
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}