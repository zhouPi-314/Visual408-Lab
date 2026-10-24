/**
 * 存储端口（Port）—— 应用只依赖这个接口，不依赖 IndexedDB。
 *
 * 为什么现在就要这层：无后端阶段用 IndexedDB，未来接云端只换一个适配器，
 * 前端与模拟核心零改动（见 docs/architecture-assessment.md §5）。
 */

export interface ProgressRecord {
  moduleId: string;
  /** 停留帧索引 */
  frame: number;
  completed: boolean;
  /** ISO 时间戳 */
  updatedAt: string;
  /** 单调递增版本号：未来多端同步按 LWW 合并，避免整表覆盖 */
  revision: number;
}

export interface AttemptRecord {
  id: string;
  moduleId: string;
  questionId: string;
  correct: boolean;
  at: string;
  /** 学习者填写的原始答案（可选，用于错因回看） */
  answer?: string;
}

export interface Backup {
  schemaVersion: 1;
  exportedAt: string;
  progress: ProgressRecord[];
  attempts: AttemptRecord[];
}

export type StorageKind = "memory" | "indexeddb" | "http";

export interface StoragePort {
  readonly kind: StorageKind;

  getProgress(moduleId: string): Promise<ProgressRecord | null>;
  putProgress(record: ProgressRecord): Promise<void>;
  listProgress(): Promise<ProgressRecord[]>;

  addAttempt(record: AttemptRecord): Promise<void>;
  listAttempts(moduleId?: string): Promise<AttemptRecord[]>;

  exportAll(): Promise<Backup>;
  importAll(backup: Backup, mode: "merge" | "replace"): Promise<void>;
  clear(): Promise<void>;
}

/** 合并策略：按 moduleId 取 revision 较大者；相同则取 updatedAt 较新者 */
export function mergeProgress(local: ProgressRecord[], incoming: ProgressRecord[]): ProgressRecord[] {
  const byId = new Map<string, ProgressRecord>();
  for (const r of local) byId.set(r.moduleId, r);
  for (const r of incoming) {
    const current = byId.get(r.moduleId);
    if (!current) {
      byId.set(r.moduleId, r);
      continue;
    }
    const newer =
      r.revision > current.revision ||
      (r.revision === current.revision && Date.parse(r.updatedAt) > Date.parse(current.updatedAt));
    if (newer) byId.set(r.moduleId, r);
  }
  return [...byId.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
}

export function emptyBackup(now = new Date()): Backup {
  return { schemaVersion: 1, exportedAt: now.toISOString(), progress: [], attempts: [] };
}
