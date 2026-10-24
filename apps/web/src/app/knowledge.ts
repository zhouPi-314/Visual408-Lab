import raw from "../generated/content-index.json";
import { EXPERIMENTS } from "./catalog";
import { searchIn, type Hit, type KModule, type KQuestion } from "./knowledge-core";

export { checkAnswer } from "./knowledge-core";
export type { Hit, KModule, KQuestion } from "./knowledge-core";

const MODULES = (raw as { modules: KModule[] }).modules;

/** 目录里的展示文案也参与搜索（内容层不重复存一份） */
const CATALOG_TEXT = new Map(EXPERIMENTS.map((e) => [e.id, `${e.summary} ${e.takeaway}`]));

export function modulesOf(): KModule[] {
  return MODULES;
}

export function knowledgeOf(moduleId: string): KModule | undefined {
  return MODULES.find((m) => m.id === moduleId);
}

export function questionsOf(moduleId: string): KQuestion[] {
  return knowledgeOf(moduleId)?.questions ?? [];
}

export function searchKnowledge(query: string, limit = 14): Hit[] {
  return searchIn(MODULES, CATALOG_TEXT, query, limit);
}
