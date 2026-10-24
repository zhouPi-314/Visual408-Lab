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

/** 存档隔离：主键用 "存档名::模块id" 组合，同一浏览器可放多份互不干扰的学习记录 */
const PROFILE_KEY = "v408-profile";
const PROFILES_KEY = "v408-profiles";
export const DEFAULT_PROFILE = "默认";
const SEP = "::";

export function listProfiles(): string[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return list.length > 0 ? list : [DEFAULT_PROFILE];
  } catch {
    return [DEFAULT_PROFILE];
  }
}

function rememberProfile(name: string) {
  const list = listProfiles();
  if (!list.includes(name)) localStorage.setItem(PROFILES_KEY, JSON.stringify([...list, name]));
}

/**
 * 存储装配点：浏览器用 IndexedDB，环境不支持时降级到内存（不丢功能，只丢持久化）。
 * UI 只依赖 StoragePort，换云端时只改这里。
 */
export function useStorage() {
  const storeRef = useRef<StoragePort | null>(null);
  const [profile, setProfileState] = useState<string>(() => localStorage.getItem(PROFILE_KEY) ?? DEFAULT_PROFILE);
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

  const keyOf = useCallback((moduleId: string) => `${profile}${SEP}${moduleId}`, [profile]);

  const setProfile = useCallback((name: string) => {
    const clean = name.trim().replace(/::/g, "");
    if (!clean) return;
    localStorage.setItem(PROFILE_KEY, clean);
    rememberProfile(clean);
    setProfileState(clean);
  }, []);

  const load = useCallback(async (moduleId: string): Promise<ProgressRecord | null> => {
    const store = storeRef.current;
    if (!store) return null;
    return store.getProgress(`${profile}${SEP}${moduleId}`);
  }, [profile]);

  const save = useCallback(async (moduleIdRaw: string, frame: number) => {
    const moduleId = `${profile}${SEP}${moduleIdRaw}`;
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
    await store.addAttempt({ ...attempt, moduleId: `${profile}${SEP}${attempt.moduleId}` });
  }, [profile]);

  /** 只返回当前存档的记录，并把组合主键还原成模块 id */
  const listAttempts = useCallback(async (): Promise<AttemptRecord[]> => {
    const store = storeRef.current;
    if (!store) return [];
    const all = await store.listAttempts();
    const prefix = `${profile}${SEP}`;
    return all
      .filter((a) => a.moduleId.startsWith(prefix))
      .map((a) => ({ ...a, moduleId: a.moduleId.slice(prefix.length) }));
  }, [profile]);

  const importBackup = useCallback(async (backup: Backup) => {
    if (!storeRef.current) return;
    await storeRef.current.importAll(backup, "merge");
    setStatus("saved");
  }, []);

  return {
    ready,
    status,
    profile,
    setProfile,
    keyOf,
    load,
    save,
    scheduleSave,
    exportBackup,
    importBackup,
    recordAttempt,
    listAttempts,
  };
}
export type StorageApi = ReturnType<typeof useStorage>;