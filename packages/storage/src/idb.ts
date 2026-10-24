import type { AttemptRecord, Backup, ProgressRecord, StoragePort } from "./port";
import { emptyBackup, mergeProgress } from "./port";

const DB_NAME = "visual408";
/** 每次改 schema 必须 +1 并在 upgrade() 里写迁移分支 */
const DB_VERSION = 1;

const STORE_PROGRESS = "progress";
const STORE_ATTEMPTS = "attempts";

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("事务被中止"));
    tx.onerror = () => reject(tx.error ?? new Error("事务失败"));
  });
}

export function upgrade(db: IDBDatabase, oldVersion: number): void {
  // v1：初始 schema。未来加字段时在这里按 oldVersion 逐级迁移，禁止删除后重建。
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
      db.createObjectStore(STORE_PROGRESS, { keyPath: "moduleId" });
    }
    if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
      const store = db.createObjectStore(STORE_ATTEMPTS, { keyPath: "id" });
      store.createIndex("byModule", "moduleId");
    }
  }
}

export class IndexedDbStorage implements StoragePort {
  readonly kind = "indexeddb" as const;
  private constructor(private readonly db: IDBDatabase) {}

  static async open(factory: IDBFactory = globalThis.indexedDB): Promise<IndexedDbStorage> {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      upgrade(request.result, (event as IDBVersionChangeEvent).oldVersion);
    };
    const db = await promisify(request);
    return new IndexedDbStorage(db);
  }

  async getProgress(moduleId: string) {
    const tx = this.db.transaction(STORE_PROGRESS, "readonly");
    const value = await promisify(tx.objectStore(STORE_PROGRESS).get(moduleId));
    return (value as ProgressRecord | undefined) ?? null;
  }

  async putProgress(record: ProgressRecord) {
    const tx = this.db.transaction(STORE_PROGRESS, "readwrite");
    tx.objectStore(STORE_PROGRESS).put(record);
    await txDone(tx);
  }

  async listProgress() {
    const tx = this.db.transaction(STORE_PROGRESS, "readonly");
    const rows = await promisify(tx.objectStore(STORE_PROGRESS).getAll());
    return (rows as ProgressRecord[]).sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }

  async addAttempt(record: AttemptRecord) {
    const tx = this.db.transaction(STORE_ATTEMPTS, "readwrite");
    tx.objectStore(STORE_ATTEMPTS).put(record);
    await txDone(tx);
  }

  async listAttempts(moduleId?: string) {
    const tx = this.db.transaction(STORE_ATTEMPTS, "readonly");
    const store = tx.objectStore(STORE_ATTEMPTS);
    const rows = await promisify(
      moduleId ? store.index("byModule").getAll(moduleId) : store.getAll(),
    );
    return (rows as AttemptRecord[]).sort((a, b) => a.at.localeCompare(b.at));
  }

  async exportAll(): Promise<Backup> {
    return {
      ...emptyBackup(),
      progress: await this.listProgress(),
      attempts: await this.listAttempts(),
    };
  }

  async importAll(backup: Backup, mode: "merge" | "replace") {
    if (mode === "replace") await this.clear();
    // 关键：所有读操作必须在开启写事务之前完成。
    // IndexedDB 事务在 await 到别的事务后会自动失活（本次实现踩过这个坑）。
    const existingProgress = mode === "merge" ? await this.listProgress() : [];
    const known = new Set((await this.listAttempts()).map((a) => a.id));
    const merged = mode === "merge" ? mergeProgress(existingProgress, backup.progress) : backup.progress;

    const tx = this.db.transaction([STORE_PROGRESS, STORE_ATTEMPTS], "readwrite");
    const progressStore = tx.objectStore(STORE_PROGRESS);
    for (const p of merged) progressStore.put(p);
    const attemptStore = tx.objectStore(STORE_ATTEMPTS);
    for (const a of backup.attempts) if (!known.has(a.id)) attemptStore.put(a);
    await txDone(tx);
  }

  async clear() {
    const tx = this.db.transaction([STORE_PROGRESS, STORE_ATTEMPTS], "readwrite");
    tx.objectStore(STORE_PROGRESS).clear();
    tx.objectStore(STORE_ATTEMPTS).clear();
    await txDone(tx);
  }

  close() {
    this.db.close();
  }
}
