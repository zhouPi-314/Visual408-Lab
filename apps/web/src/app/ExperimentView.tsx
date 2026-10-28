import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PracticePanel } from "./PracticePanel";
import { InlineSearch, RelatedExperiments } from "./ExperimentTools";
import type { SubjectKey } from "./catalog";
import type { StorageApi } from "./storage";
import type { AnyRenderer } from "./types";

/** 讲解文本里的 **强调** 渲染成 <strong>，否则界面上会出现字面星号 */
function Narration({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export interface ExperimentViewProps {
  moduleId: string;
  renderer: AnyRenderer;
  subject: SubjectKey;
  subjectLabel: string;
  onBack: () => void;
  onOpenModule: (id: string) => void;
  store: StorageApi;
}

export function ExperimentView({ moduleId, renderer: R, subject, subjectLabel, onBack, onOpenModule, store }: ExperimentViewProps) {
  const [input, setInput] = useState<unknown>(R.defaultInput);
  const sim = useMemo(() => R.simulate(input), [R, input]);
  const issues = useMemo(() => [...sim.validate()], [sim]);
  const hasError = issues.some((i) => i.severity === "error");
  const frames = sim.frames;

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const restoredFor = useRef<string | null>(null);
  const initialStep = useRef(Number(new URLSearchParams(window.location.search).get("step") ?? "0"));

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(frames.length - 1, 0)));
  }, [frames]);

  useEffect(() => {
    if (initialStep.current <= 0) return;
    setIndex(Math.min(Math.max(initialStep.current - 1, 0), Math.max(frames.length - 1, 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!store.ready || restoredFor.current === moduleId || initialStep.current > 0) return;
    restoredFor.current = moduleId;
    void store.load(moduleId).then((rec) => {
      if (rec) {
        setIndex(Math.min(rec.frame, Math.max(frames.length - 1, 0)));
        notify("已恢复上次进度");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, moduleId]);

  useEffect(() => {
    if (!store.ready || hasError) return;
    store.scheduleSave(moduleId, index);
  }, [store, moduleId, index, hasError]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setIndex((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 700 / speed);
    return () => window.clearInterval(timer);
  }, [playing, frames.length, speed]);

  const go = useCallback(
    (next: number) => {
      setPlaying(false);
      setIndex((_) => Math.min(Math.max(next, 0), Math.max(frames.length - 1, 0)));
    },
    [frames.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key.toLowerCase() === "r") { e.preventDefault(); go(0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const frame = frames[index];
  const Inputs = R.Inputs;
  const Stage = R.Stage;
  const Side = R.Side;

  return (
    <div>
      <nav className="crumb" aria-label="面包屑">
        <button type="button" className="btn btn-quiet" onClick={onBack}>← 返回目录</button>
        <span aria-hidden="true">/</span>
        <span>{subjectLabel}</span>
        <span aria-hidden="true">/</span>
        <span style={{ color: "var(--ink)" }}>{R.meta.title}</span>
      </nav>

      <InlineSearch moduleId={moduleId} />

      <Inputs input={input} onChange={setInput} issues={issues} />

      {hasError && (
        <ul className="issues" role="alert">
          {issues.filter((i) => i.severity === "error").map((i, k) => (
            <li key={k}>{i.path ? `${i.path}：` : ""}{i.message}</li>
          ))}
        </ul>
      )}

      <main id="stage" className="layout">
        <Stage frame={hasError ? undefined : frame} />
        <Side frame={hasError ? undefined : frame} />
      </main>

      <div className="callout" style={{ marginTop: 16 }} aria-live="polite">
        <span className="step">{frames.length ? `${index + 1}/${frames.length}` : "—"}</span>
        <p style={{ margin: 0 }}>
          {hasError ? (
            "先修正上面的输入问题，再开始推演。"
          ) : frame ? (
            <Narration text={frame.narration} />
          ) : (
            "正在准备…"
          )}
        </p>
      </div>

      <p className="kbd-hint">
        <kbd>←</kbd> <kbd>→</kbd> 翻步 · <kbd>空格</kbd> 播放/暂停 · <kbd>R</kbd> 回到第一步
      </p>

      <PracticePanel moduleId={moduleId} store={store} />

      <RelatedExperiments moduleId={moduleId} subject={subject} onOpen={onOpenModule} />

      <footer className="transport">
        <button type="button" className="btn btn-icon" onClick={() => go(0)} aria-label="回到第一步" disabled={frames.length === 0}>⏮</button>
        <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>◀ 上一步</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setPlaying((p) => !p)}
          disabled={frames.length === 0}
        >
          {playing ? "⏸ 暂停" : "▶ 播放"}
        </button>
        <button type="button" className="btn" onClick={() => go(index + 1)} disabled={index >= frames.length - 1}>下一步 ▶</button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          aria-pressed={speed === 2}
          title="播放速度"
        >
          {speed === 1 ? "1×" : "2×"}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            const url = new URL(window.location.href);
            url.hash = `#${subject}/${moduleId}`;
            url.searchParams.set("step", String(index + 1));
            void navigator.clipboard?.writeText(url.toString());
            notify("已复制本步链接");
          }}
          title="复制当前这一步的链接"
        >
          复制本步链接
        </button>

        <div className="timeline">
          <input
            type="range"
            min={0}
            max={Math.max(frames.length - 1, 0)}
            value={index}
            onChange={(e) => go(Number(e.target.value))}
            aria-label="时间轴"
          />
          <span className="counter">{frames.length ? `${index + 1} / ${frames.length}` : "0 / 0"}</span>
        </div>

        <span className="kbd-hint"><kbd>←</kbd><kbd>→</kbd> 单步 · <kbd>空格</kbd> 播放 · <kbd>R</kbd> 重置</span>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}