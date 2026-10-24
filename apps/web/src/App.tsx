import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Backup } from "@visual408/storage";
import { useStorage } from "./app/storage";
import { ExperimentView } from "./app/ExperimentView";
import { SearchOverlay } from "./app/SearchOverlay";
import { AttemptsOverlay } from "./app/AttemptsOverlay";
import { QuestionsView } from "./app/QuestionsView";
import { ThemeToggle } from "./app/ThemeToggle";
import {
  EXPERIMENTS,
  SUBJECTS,
  experimentsOf,
  findExperiment,
  subjectOf,
  type SubjectKey,
} from "./app/catalog";

type Route = { subject: SubjectKey; moduleId?: string; bank?: boolean };

const isSubject = (v: string): v is SubjectKey => SUBJECTS.some((s) => s.key === v);

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "");
  if (raw === "bank") return { subject: "ds", bank: true };
  const [head, ...rest] = raw.split("/");
  const subject = head && isSubject(head) ? head : "ds";
  const moduleId = rest.join("/");
  return moduleId ? { subject, moduleId } : { subject };
}

const toHash = (r: Route) =>
  r.bank ? "#bank" : r.moduleId ? `#${r.subject}/${r.moduleId}` : `#${r.subject}`;

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());
  const store = useStorage();
  const [toast, setToast] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.subject, route.moduleId]);

  // ?q=关键词 直接打开搜索（可分享的搜索结果链接）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setInitialQuery(q);
      setSearchOpen(true);
    }
  }, []);

  // `/` 打开搜索（不在输入框里时）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !typing && !searchOpen && !attemptsOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setAttemptsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, attemptsOpen]);

  const navigate = useCallback((next: Route) => {
    const target = toHash(next);
    if (window.location.hash === target) setRoute(next);
    else window.location.hash = target;
  }, []);

  const openModule = useCallback(
    (moduleId: string) => {
      const exp = findExperiment(moduleId);
      navigate({ subject: exp?.subject ?? "ds", moduleId });
    },
    [navigate],
  );

  const onExport = useCallback(async () => {
    const backup: Backup | null = await store.exportBackup();
    if (!backup) return;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visual408-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("已导出学习记录");
  }, [store, notify]);

  const onImport = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()) as Backup;
        if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.progress)) throw new Error("bad backup");
        await store.importBackup(parsed);
        notify("已合并导入");
      } catch {
        notify("导入失败：不是有效的 Visual408 备份");
      }
    },
    [store, notify],
  );

  const saveLabel =
    store.status === "saving" ? "保存中…"
    : store.status === "saved" ? "已保存"
    : store.status === "unavailable" ? "未持久化"
    : store.status === "error" ? "保存失败"
    : "就绪";

  const subject = subjectOf(route.subject);
  const experiment = route.moduleId ? findExperiment(route.moduleId) : undefined;
  const ready = experiment?.status === "ready" ? experiment : undefined;

  return (
    <div className="app">
      <a className="skip-link" href="#main">跳到主内容</a>

      <header className="topbar">
        <div className="brand">
          <button
            type="button"
            className="brand-home"
            onClick={() => navigate({ subject: route.subject })}
            aria-label="回到当前学科目录"
          >
            <span className="logo" aria-hidden="true">V408</span>
          </button>
          <div>
            <h1>Visual408 Lab</h1>
            <p>计算机 408 可视化交互学习实验室 · 每一步都由你亲手推进</p>
          </div>
        </div>

        <div className="top-actions">
          <a
            className="btn star-btn"
            href="https://github.com/zhouPi-314/Visual408-Lab"
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 上给 Visual408 Lab 点 Star"
            title="在 GitHub 上点 Star"
          >
            <span aria-hidden="true">★</span>
            <span className="star-label">Star</span>
          </a>
          <ThemeToggle />
          <span className="save-state" aria-live="polite">{saveLabel}</span>
          <button type="button" className="btn search-trigger" onClick={() => setSearchOpen(true)}>
            <span aria-hidden="true">⌕</span> 搜索 <kbd>/</kbd>
          </button>
          <button type="button" className="btn" onClick={() => navigate({ subject: route.subject, bank: true })}>题库</button>
          <button type="button" className="btn" onClick={() => setAttemptsOpen(true)}>错题本</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>导入</button>
          <button type="button" className="btn" onClick={() => void onExport()}>导出备份</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e)} />
      </header>

      <nav className="subject-nav" aria-label="学科">
        {SUBJECTS.map((s) => {
          const list = experimentsOf(s.key);
          const done = list.filter((e) => e.status === "ready").length;
          const active = route.subject === s.key;
          return (
            <button
              key={s.key}
              type="button"
              className="subject-tab"
              aria-current={active ? "page" : undefined}
              onClick={() => navigate({ subject: s.key })}
            >
              <strong>{s.label}</strong>
              <small>{s.hint}</small>
              <span className="subject-count">{done}/{list.length}</span>
            </button>
          );
        })}
      </nav>

      <main id="main">
        {route.bank ? (
          <QuestionsView onOpenModule={(id) => openModule(id)} />
        ) : ready?.renderer ? (
          <ExperimentView
            key={ready.id}
            moduleId={ready.id}
            renderer={ready.renderer}
            subject={route.subject}
            subjectLabel={subject.label}
            store={store}
            onBack={() => navigate({ subject: route.subject })}
          />
        ) : (
          <CatalogPage subjectKey={route.subject} onOpen={(id) => navigate({ subject: route.subject, moduleId: id })} />
        )}
      </main>

      <SearchOverlay
        open={searchOpen}
        initialQuery={initialQuery}
        onClose={() => setSearchOpen(false)}
        onOpenModule={openModule}
      />
      <AttemptsOverlay open={attemptsOpen} onClose={() => setAttemptsOpen(false)} store={store} onOpenModule={openModule} />

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function CatalogPage({ subjectKey, onOpen }: { subjectKey: SubjectKey; onOpen: (id: string) => void }) {
  const subject = subjectOf(subjectKey);
  const list = experimentsOf(subjectKey);
  const done = list.filter((e) => e.status === "ready").length;

  return (
    <section>
      <div className="catalog-head">
        <h2>{subject.label}</h2>
        <p>
          {subject.hint} · 共 {list.length} 个实验（{done} 个可操作
          {list.length > done ? `，${list.length - done} 个规划中` : ""}）
        </p>
      </div>

      {list.length === 0 ? (
        <p className="empty">这个学科还没有实验，欢迎从其他学科开始。</p>
      ) : (
        <div className="catalog">
          {list.map((e) => {
            const planned = e.status === "planned";
            return (
              <button
                key={e.id}
                type="button"
                className={`card${planned ? " is-planned" : ""}`}
                disabled={planned}
                onClick={() => onOpen(e.id)}
                aria-label={planned ? `${e.title}（规划中）` : `打开实验：${e.title}`}
              >
                <span className="card-top">
                  <span className="badge">{planned ? "规划中" : "可操作"}</span>
                  <span className="badge mono">{e.id}</span>
                </span>
                <h3>{e.title}</h3>
                <p>{e.summary}</p>
                <span className="takeaway">{e.takeaway}</span>
                {!planned && <span className="card-cta">进入实验 →</span>}
              </button>
            );
          })}
        </div>
      )}

      {subjectKey === "cross" && (
        <p className="field-note" style={{ marginTop: 18 }}>
          综合实验室的每个实验都会复用单科模块的内核（例如访问链路直接调用 Cache 判定），
          而不是重写一遍——这样才能保证「同一个知识点只有一份语义」。
        </p>
      )}

      {subjectKey !== "cross" && EXPERIMENTS.length > 0 && (
        <p className="field-note" style={{ marginTop: 18 }}>
          每个实验都是「参数可调 + 单步推演 + 代码联动」；进度会自动保存在本机，可随时导出备份。
        </p>
      )}
    </section>
  );
}