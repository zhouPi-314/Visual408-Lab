import { useState } from "react";
import { checkAnswer, questionsOf } from "./knowledge";
import type { StorageApi } from "./storage";

export function PracticePanel({ moduleId, store }: { moduleId: string; store: StorageApi }) {
  const questions = questionsOf(moduleId);
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [graded, setGraded] = useState<{ ok: boolean } | null>(null);

  if (questions.length === 0) return null;
  const question = questions[index]!;

  const submit = async () => {
    if (draft.trim() === "" || graded) return;
    const ok = checkAnswer(question.answer, draft);
    setGraded({ ok });
    await store.recordAttempt({
      id: `${moduleId}:${question.id}:${Date.now()}`,
      moduleId,
      questionId: question.id,
      correct: ok,
      at: new Date().toISOString(),
      answer: draft.trim(),
    });
  };

  const next = () => {
    setIndex((i) => (i + 1) % questions.length);
    setDraft("");
    setGraded(null);
  };

  return (
    <section className="panel practice" aria-label="巩固练习">
      <div className="panel-head">
        <h2>巩固练习</h2>
        <span className="hint">{questions.length} 道题 · 答题记录计入错题本</span>
        <button type="button" className="btn btn-quiet" style={{ marginLeft: "auto" }} onClick={() => setOpen((o) => !o)}>
          {open ? "收起" : "开始练习"}
        </button>
      </div>

      {open && (
        <div className="panel-body" style={{ display: "grid", gap: 10 }}>
          <p className="practice-stem">{question.stem}</p>

          <div className="practice-row">
            <input
              type="text"
              className="practice-input"
              placeholder="写下你的答案（支持数字与文字）"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              aria-label="你的答案"
              disabled={graded !== null}
            />
            {graded === null ? (
              <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={draft.trim() === ""}>
                提交
              </button>
            ) : (
              <button type="button" className="btn" onClick={next}>
                下一题 →
              </button>
            )}
          </div>

          {graded && (
            <div className={`practice-result ${graded.ok ? "is-ok" : "is-bad"}`} role="status">
              <strong>{graded.ok ? "答对了" : "再想想"}</strong>
              <span>参考答案：<code>{question.answer}</code></span>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}