import { useEffect, useMemo, useRef, useState } from "react";
import { searchKnowledge, type Hit } from "./knowledge";
import { useFocusTrap } from "./useFocusTrap";

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onOpenModule: (moduleId: string) => void;
  initialQuery?: string;
}

const SUBJECT_LABEL: Record<string, string> = {
  ds: "数据结构",
  co: "计算机组成原理",
  os: "操作系统",
  net: "计算机网络",
  cross: "综合",
};

export function SearchOverlay({ open, onClose, onOpenModule, initialQuery = "" }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap(open, onClose);
  const hits: Hit[] = useMemo(() => searchKnowledge(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, initialQuery]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const choose = (hit: Hit | undefined) => {
    if (!hit) return;
    onOpenModule(hit.moduleId);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(hits[active]); }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="知识搜索" onMouseDown={onClose}>
      <div className="overlay-panel search-panel" ref={trapRef} tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-head">
          <input
            ref={inputRef}
            className="search-input"
            placeholder="搜索知识点、题目或实验名…（Esc 关闭）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="搜索"
          />
          <span className="kbd-hint"><kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 打开</span>
        </div>

        {query.trim() === "" ? (
          <p className="empty">试着搜索「缺页」「Cache 缺失」「三次握手」「D B E」</p>
        ) : hits.length === 0 ? (
          <p className="empty">没有匹配结果</p>
        ) : (
          <ul className="result-list" role="listbox" aria-label="搜索结果">
            {hits.map((hit, i) => (
              <li key={hit.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`result${i === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(hit)}
                >
                  <span className={`result-kind ${hit.kind}`}>{hit.kind === "module" ? "实验" : "题目"}</span>
                  <span className="result-body">
                    <strong>{hit.title}</strong>
                    <span>{hit.snippet}</span>
                  </span>
                  <span className="badge">{SUBJECT_LABEL[hit.subject] ?? hit.subject}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}