/**
 * 纯函数搜索内核：不依赖 React 与目录层，方便单元测试。
 * 目录层（knowledge.ts）负责把内容索引与展示文案合并后传进来。
 */

export interface KQuestion {
  id: string;
  kind: string;
  stem: string;
  answer: string;
  explanation: string;
  source: string;
}

export interface KModule {
  id: string;
  subject: string;
  title: string;
  objectives: string[];
  labTasks: string[];
  questions: KQuestion[];
  theoryExcerpt: string;
}

export type Hit =
  | { kind: "module"; key: string; moduleId: string; title: string; snippet: string; subject: string }
  | { kind: "question"; key: string; moduleId: string; title: string; snippet: string; subject: string };

const norm = (s: string) => s.toLowerCase();

function snippet(text: string, term: string, width = 44): string {
  const idx = norm(text).indexOf(norm(term));
  if (idx < 0) return text.slice(0, width * 2);
  const start = Math.max(0, idx - width);
  return (start > 0 ? "…" : "") + text.slice(start, idx + term.length + width) + "…";
}

export function searchIn(
  modules: KModule[],
  catalogText: Map<string, string>,
  query: string,
  limit = 14,
): Hit[] {
  const q = query.trim();
  if (q.length === 0) return [];
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const hits: (Hit & { score: number })[] = [];

  for (const m of modules) {
    const fields = [
      { text: m.title, weight: 6 },
      { text: catalogText.get(m.id) ?? "", weight: 3 },
      { text: m.objectives.join(" "), weight: 3 },
      { text: m.labTasks.join(" "), weight: 1 },
      { text: m.theoryExcerpt, weight: 1 },
    ];

    let score = 0;
    let snippetText = m.objectives[0] ?? m.theoryExcerpt.slice(0, 60);
    for (const term of terms) {
      let inModule = false;
      for (const f of fields) {
        if (norm(f.text).includes(term)) {
          score += f.weight;
          inModule = true;
          if (f.weight >= 3) snippetText = f.text;
        }
      }
      if (!inModule && m.questions.some((qn) => norm(qn.stem).includes(term))) score += 0.5;
    }

    if (score > 0) {
      hits.push({
        kind: "module",
        key: `m:${m.id}`,
        moduleId: m.id,
        title: m.title,
        snippet: snippetText.slice(0, 120),
        subject: m.subject,
        score,
      });
    }

    for (const qn of m.questions) {
      const qScore = terms.reduce(
        (acc, t) => acc + (norm(qn.stem).includes(t) ? 4 : 0) + (norm(qn.explanation).includes(t) ? 1 : 0),
        0,
      );
      if (qScore > 0) {
        hits.push({
          kind: "question",
          key: `q:${m.id}:${qn.id}`,
          moduleId: m.id,
          title: m.title,
          snippet: snippet(qn.stem, q) || qn.stem.slice(0, 100),
          subject: m.subject,
          score: qScore,
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...hit }) => hit as Hit);
}

/**
 * 判题：先按数字集合比对（容忍 "seq=5000, ack=1001" 与 "5000,1001" 这类写法差异），
 * 再退回字符串比较（去掉空白与标点，忽略大小写）。
 */
export function checkAnswer(expected: string, actual: string): boolean {
  const nums = (s: string) => (s.match(/\d+/g) ?? []).map((n) => Number(n));
  const clean = (s: string) => s.toLowerCase().replace(/[\s,，。;；:：]/g, "");

  const exp = nums(expected);
  const act = nums(actual);
  if (exp.length > 0 && act.length > 0) {
    const a = [...exp].sort((x, y) => x - y).join(",");
    const b = [...act].sort((x, y) => x - y).join(",");
    if (a === b) return true;
  }
  return clean(expected) === clean(actual);
}
