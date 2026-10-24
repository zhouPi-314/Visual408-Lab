import type { AttemptRecord, Backup, ProgressRecord, StoragePort } from "./port";
import { emptyBackup, mergeProgress } from "./port";

/** 内存适配器：单元测试与 SSR 兜底，不持久化 */
export class MemoryStorage implements StoragePort {
  readonly kind = "memory" as const;
  private progress = new Map<string, ProgressRecord>();
  private attempts: AttemptRecord[] = [];

  async getProgress(moduleId: string) {
    return this.progress.get(moduleId) ?? null;
  }
  async putProgress(record: ProgressRecord) {
    this.progress.set(record.moduleId, { ...record });
  }
  async listProgress() {
    return [...this.progress.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
  async addAttempt(record: AttemptRecord) {
    this.attempts.push({ ...record });
  }
  async listAttempts(moduleId?: string) {
    return this.attempts
      .filter((a) => (moduleId ? a.moduleId === moduleId : true))
      .sort((a, b) => a.at.localeCompare(b.at));
  }
  async exportAll(): Promise<Backup> {
    return { ...emptyBackup(), progress: await this.listProgress(), attempts: [...this.attempts] };
  }
  async importAll(backup: Backup, mode: "merge" | "replace") {
    if (mode === "replace") {
      this.progress.clear();
      this.attempts = [];
    }
    const next =
      mode === "merge" ? mergeProgress(await this.listProgress(), backup.progress) : backup.progress;
    for (const p of next) this.progress.set(p.moduleId, { ...p });
    const known = new Set(this.attempts.map((a) => a.id));
    for (const a of backup.attempts) if (!known.has(a.id)) this.attempts.push({ ...a });
  }
  async clear() {
    this.progress.clear();
    this.attempts = [];
  }
}
