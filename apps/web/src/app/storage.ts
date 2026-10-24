import { useCallback, useEffect, useRef, useState } from "react";
import {
  IndexedDbStorage,
  MemoryStorage,
  type Backup,
  type AttemptRecord,
  type ProgressRecord,
  type StoragePort,
} from "@visual408/storage";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "unavailable";

/**
 * 存储装配点：浏览器用 IndexedDB，环境不支持时降级到内存（不丢功能，只丢持久化）。
 * UI 只依赖 StoragePort，换云端时只改这里。
 */
export function useStorage() {
  const storeRef = useRef<StoragePort | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    // 某些环境（无痕/无存储权限）IndexedDB 会一直挂住，超时后降级到内存
    const timeout = window.setTimeout(() => {
      if (alive && !storeRef.current) {
        storeRef.current = new MemoryStorage();
        setReady(true);
        setStatus("unavailable");
      }
    }, 1500);
    const open = async () => {
      try {
        if (typeof indexedDB === "undefined") throw new Error("no indexedDB");
        const s = await IndexedDbStorage.open();
        window.clearTimeout(timeout);
        if (alive) {
          storeRef.current = s;
          setReady(true);
        }
      } catch {
        window.clearTimeout(timeout);
        if (alive) {
          storeRef.current = new MemoryStorage();
          setReady(true);
          setStatus("unavailable");
        }
      }
    };
    void open();
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, []);

  const load = useCallback(async (moduleId: string): Promise<ProgressRecord | null> => {
    const store = storeRef.current;
    if (!store) return null;
    return store.getProgress(moduleId);
  }, []);

  const save = useCallback(async (moduleId: string, frame: number) => {
    const store = storeRef.current;
    if (!store) return;
    setStatus("saving");
    try {
      const existing = await store.getProgress(moduleId);
      await store.putProgress({
        moduleId,
        frame,
        completed: false,
        updatedAt: new Date().toISOString(),
        revision: (existing?.revision ?? 0) + 1,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  /** 帧变化后延迟写入，避免拖动时间轴时每帧都落库 */
  const scheduleSave = useCallback(
    (moduleId: string, frame: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(moduleId, frame), 700);
    },
    [save],
  );

  const exportBackup = useCallback(async (): Promise<Backup | null> => {
    return storeRef.current ? storeRef.current.exportAll() : null;
  }, []);

  const recordAttempt = useCallback(async (attempt: AttemptRecord) => {
    const store = storeRef.current;
    if (!store) return;
    await store.addAttempt(attempt);
  }, []);

  const listAttempts = useCallback(async (moduleId?: string): Promise<AttemptRecord[]> => {
    const store = storeRef.current;
    return store ? store.listAttempts(moduleId) : [];
  }, []);

  const importBackup = useCallback(async (backup: Backup) => {
    if (!storeRef.current) return;
    await storeRef.current.importAll(backup, "merge");
    setStatus("saved");
  }, []);

  return { ready, status, load, save, scheduleSave, exportBackup, importBackup, recordAttempt, listAttempts };
}
export type StorageApi = ReturnType<typeof useStorage>;