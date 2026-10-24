import { useMemo, useState } from "react";
import { modulesOf } from "./knowledge";
import { SUBJECTS, experimentsOf } from "./catalog";

const SUBJECT_LABEL: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.key, s.label]),
);

export function QuestionsView({ onOpenModule }: { onOpenModule: (id: string) => void }) {
  const [subject, setSubject] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const all = useMemo(
    () =>
      modulesOf().flatMap((m) =>
        m.questions.map((q) => ({
          key: `${m.id}:${q.id}`,
          moduleId: m.id,
          moduleTitle: m.title,
          subject: m.subject,
          question: q,
        })),
      ),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((item) => {
      if (subject !== "all" && item.subject !== subject) return false;
      if (!q) return true;
      const hay = `${item.question.stem} ${item.question.explanation} ${item.moduleTitle}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, subject, query]);

  const ready = (key: string) => experimentsOf(key as never).filter((e) => e.status === "ready").length;

  return (
    <section>
      <div className="catalog-head">
        <h2>题库与解析</h2>
        <p>
          共 {all.length} 道原创题，覆盖 {modulesOf().length} 个实验。每题都有可展开的解析；
          答题记录在「错题本」里。
        </p>
      </div>

      <div className="input-bar" style={{ marginBottom: 14 }}>
        <label className="field">
          <span>学科</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">全部（{all.length}）</option>
            {SUBJECTS.filter((s) => ready(s.key) > 0).map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="field field-grow">
          <span>搜索题干或解析</span>
          <input type="text" value={query} placeholder="例如：缺页 / Belady / 时间片"
            onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="field-note">共 {filtered.length} 条结果</span>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">没有匹配的题目</p>
      ) : (
        <ul className="bank-list">
          {filtered.map((item) => {
            const open = openId === item.key;
            return (
              <li key={item.key} className="bank-item">
                <button type="button" className="bank-head" aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.key)}>
                  <span className={`badge`}>{SUBJECT_LABEL[item.subject] ?? item.subject}</span>
                  <span className="bank-stem">{item.question.stem}</span>
                  <span className="bank-toggle">{open ? "收起" : "解析"}</span>
                </button>
                {open && (
                  <div className="bank-body">
                    <p><strong>答案：</strong><code>{item.question.answer}</code></p>
                    <p><strong>解析：</strong>{item.question.explanation}</p>
                    <button type="button" className="btn btn-quiet" onClick={() => onOpenModule(item.moduleId)}>
                      打开实验：{item.moduleTitle} →
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="field-note" style={{ marginTop: 18 }}>
        题目均为原创；如需引用真题，只登记「年份 + 考点映射」，不复制题面与解析。
      </p>
    </section>
  );
}
