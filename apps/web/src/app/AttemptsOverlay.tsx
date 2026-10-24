import { useEffect, useState } from "react";
import type { AttemptRecord } from "@visual408/storage";
import { questionsOf } from "./knowledge";
import { useFocusTrap } from "./useFocusTrap";
import type { StorageApi } from "./storage";

export interface AttemptsOverlayProps {
  open: boolean;
  onClose: () => void;
  store: StorageApi;
  onOpenModule: (moduleId: string) => void;
}

export function AttemptsOverlay({ open, onClose, store, onOpenModule }: AttemptsOverlayProps) {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const trapRef = useFocusTrap(open, onClose);

  useEffect(() => {
    if (!open) return;
    void store.listAttempts().then(setAttempts);
  }, [open, store]);

  if (!open) return null;

  const total = attempts.length;
  const wrong = attempts.filter((a) => !a.correct);
  const rate = total === 0 ? 0 : Math.round(((total - wrong.length) / total) * 100);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="错题本" onMouseDown={onClose}>
      <div className="overlay-panel" ref={trapRef} tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <h2>错题本</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        <dl className="metrics" style={{ marginBottom: 14 }}>
          <div className="metric"><dt>已答</dt><dd>{total}</dd></div>
          <div className="metric is-bad"><dt>答错</dt><dd>{wrong.length}</dd></div>
          <div className="metric is-good"><dt>正确率</dt><dd>{total === 0 ? "—" : `${rate}%`}</dd></div>
        </dl>

        {total === 0 ? (
          <p className="empty">还没有答题记录。进入任一实验，在「巩固练习」里做一道题。</p>
        ) : wrong.length === 0 ? (
          <p className="empty">全部答对，暂时没有错题。</p>
        ) : (
          <ul className="attempt-list">
            {wrong.map((a) => {
              const q = questionsOf(a.moduleId).find((x) => x.id === a.questionId);
              return (
                <li key={a.id}>
                  <div className="attempt-stem">{q?.stem ?? a.questionId}</div>
                  <div className="attempt-meta">
                    <span>你的答案：<code>{a.answer ?? "—"}</code></span>
                    {q && <span>参考：<code>{q.answer}</code></span>}
                    <span className="muted">{new Date(a.at).toLocaleString("zh-CN")}</span>
                    <button type="button" className="btn btn-quiet" onClick={() => { onOpenModule(a.moduleId); onClose(); }}>
                      回到实验 →
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}