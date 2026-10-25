import type { CellState, ViewData, ViewCell } from "@visual408/sim-core";

const TONE: Record<CellState, { bg: string; fg: string; border: string }> = {
  idle: { bg: "var(--surface-2)", fg: "var(--ink-2)", border: "var(--line)" },
  active: { bg: "var(--primary-soft)", fg: "var(--primary-hover)", border: "var(--primary)" },
  done: { bg: "var(--hit-soft)", fg: "var(--hit)", border: "var(--hit)" },
  ok: { bg: "var(--hit-soft)", fg: "var(--hit)", border: "var(--hit)" },
  warn: { bg: "var(--accent-soft)", fg: "var(--accent)", border: "var(--accent)" },
  bad: { bg: "var(--miss-soft)", fg: "var(--miss)", border: "var(--miss)" },
};

function tone(state: CellState | undefined) {
  return TONE[state ?? "idle"];
}

function Cell({ cell }: { cell: ViewCell }) {
  const t = tone(cell.state);
  return (
    <span
      className="gv-cell"
      style={{ background: t.bg, color: t.fg, borderColor: t.border }}
      title={cell.sub}
    >
      {cell.text}
      {cell.sub && <small>{cell.sub}</small>}
    </span>
  );
}

/** 一个 ViewData → 一段可读的图形；所有实验共用 */
export function View({ view }: { view: ViewData }) {
  return (
    <div className="gv-block">
      {view.label && <div className="gv-label">{view.label}</div>}

      {view.kind === "chips" && (
        <div className="gv-row">
          {view.items.length === 0 ? <span className="muted">（空）</span> : view.items.map((c, i) => <Cell key={i} cell={c} />)}
        </div>
      )}

      {view.kind === "fields" && (
        <div className="gv-row">
          {view.items.map((c, i) => <Cell key={i} cell={c} />)}
        </div>
      )}

      {view.kind === "bars" && (
        <div className="gv-bars">
          {view.items.map((b, i) => {
            const t = tone(b.state);
            const pct = Math.max(2, Math.min(100, (b.value / Math.max(view.max, 1)) * 100));
            return (
              <div key={i} className="gv-bar-row">
                <span className="gv-bar-label">{b.label}</span>
                <span className="gv-bar-track">
                  <span className="gv-bar-fill" style={{ width: pct + "%", background: t.fg }} />
                </span>
                <span className="gv-bar-value">{b.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {view.kind === "grid" && (
        <div className="gv-table-wrap">
          <table className="data-table gv-table">
            <thead>
              <tr>
                {view.rowHeaders && <th scope="col" />}
                {view.columns.map((c) => <th key={c} scope="col">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row, r) => (
                <tr key={r} className={view.activeRow === r ? "is-active" : undefined}>
                  {view.rowHeaders && <th scope="row">{view.rowHeaders[r]}</th>}
                  {row.map((cell, c) => (
                    <td key={c}><Cell cell={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view.kind === "matrix" && (
        <div className="gv-table-wrap">
          <table className="data-table gv-table">
            <thead>
              <tr>
                <th scope="col" />
                {view.columns.map((c) => <th key={c} scope="col">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row">{view.rowHeaders[r]}</th>
                  {row.map((v, c) => {
                    const hot = view.highlight?.some(([hr, hc]) => hr === r && hc === c);
                    return <td key={c} className={hot ? "gv-hot" : undefined}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view.kind === "bits" && (
        <div className="gv-bits">
          {view.groups.map((g, gi) => (
            <div key={gi} className="gv-bit-group">
              <span className="gv-bit-label">{g.label}</span>
              <span className="gv-bit-cells">
                {g.bits.map((b, i) => (
                  <span
                    key={i}
                    className={"gv-bit" + (b ? " is-one" : "") + (g.splitAt === i ? " is-split" : "")}
                  >
                    {b}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {view.kind === "timeline" && (
        <div className="gv-timeline">
          <div className="gv-timeline-bar">
            {view.segments.map((s, i) => {
              const t = tone(s.state);
              const left = (s.start / view.span) * 100;
              const width = Math.max(((s.end - s.start) / view.span) * 100, 0.8);
              return (
                <span
                  key={i}
                  className="gv-seg"
                  style={{ left: left + "%", width: width + "%", background: t.bg, borderColor: t.border, color: t.fg }}
                  title={`${s.start}–${s.end} ${s.label}`}
                >
                  {s.label}
                </span>
              );
            })}
            {view.markers?.map((m, i) => (
              <span key={i} className="gv-marker" style={{ left: (m.at / view.span) * 100 + "%" }}>
                <span>{m.label}</span>
              </span>
            ))}
          </div>
          <div className="gv-timeline-axis">
            <span>0</span><span>{view.span}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function GenericViews({ views }: { views: ViewData[] }) {
  return (
    <div className="gv-stack">
      {views.map((v, i) => <View key={i} view={v} />)}
    </div>
  );
}
