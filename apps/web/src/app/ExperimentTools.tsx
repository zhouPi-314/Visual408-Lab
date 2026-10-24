import { useMemo, useState } from "react";
import { experimentsOf, type SubjectKey } from "./catalog";
import { knowledgeOf } from "./knowledge";

/** 实验内搜索：只查当前实验的目标、理论摘要、题目与解析 */
export function InlineSearch({ moduleId }: { moduleId: string }) {
  const [q, setQ] = useState("");
  const knowledge = knowledgeOf(moduleId);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!knowledge || query.length === 0) return [];
    const out: { source: string; text: string }[] = [];
    knowledge.objectives.forEach((o) => {
      if (o.toLowerCase().includes(query)) out.push({ source: "学习目标", text: o });
    });
    knowledge.questions.forEach((qn) => {
      if (qn.stem.toLowerCase().includes(query)) out.push({ source: "题目 " + qn.id, text: qn.stem });
      if (qn.explanation.toLowerCase().includes(query)) out.push({ source: "解析 " + qn.id, text: qn.explanation });
    });
    if (knowledge.theoryExcerpt.toLowerCase().includes(query)) out.push({ source: "理论", text: knowledge.theoryExcerpt });
    return out.slice(0, 6);
  }, [knowledge, q]);

  if (!knowledge) return null;

  return (
    <div className="inline-search">
      <label className="field">
        <span>在本实验内搜索（目标 / 题目 / 解析 / 理论）</span>
        <input type="search" value={q} placeholder="例如：缺页、TLB、稳定性"
          onChange={(e) => setQ(e.target.value)} aria-label="实验内搜索" />
      </label>
      {q.trim() !== "" && (
        results.length === 0 ? (
          <p className="field-note" style={{ margin: "6px 0 0" }}>本实验内没有匹配；试试顶部「搜索」做全站检索。</p>
        ) : (
          <ul className="inline-results">
            {results.map((r, i) => (
              <li key={i}><span className="badge">{r.source}</span><span>{r.text}</span></li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** 交叉引用：同科其它实验 + 综合实验室 */
export function RelatedExperiments({ moduleId, subject, onOpen }: {
  moduleId: string;
  subject: SubjectKey;
  onOpen: (id: string) => void;
}) {
  const sameSubject = experimentsOf(subject).filter((e) => e.id !== moduleId && e.status === "ready");
  const cross = experimentsOf("cross").filter((e) => e.status === "ready" && e.id !== moduleId);
  const list = [...sameSubject, ...cross].slice(0, 5);
  if (list.length === 0) return null;

  return (
    <div className="related">
      <strong>相关实验</strong>
      <div className="stack-row">
        {list.map((e) => (
          <button key={e.id} type="button" className="btn btn-quiet related-chip" onClick={() => onOpen(e.id)}>
            {e.title}
          </button>
        ))}
      </div>
    </div>
  );
}
