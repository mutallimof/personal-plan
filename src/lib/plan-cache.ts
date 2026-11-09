/**
 * Keeps the last loaded plan in localStorage so the plan page still shows when the phone is offline.
 * Stored per user: another account never sees it, and it is removed on sign-out.
 */
const KEY = "lifeplan:plan-cache";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Stored = { uid: string; savedAt: number; data: unknown };

export function readPlanCache(storage: StorageLike, uid: string): unknown {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    return v && v.uid === uid && Array.isArray(v.data) ? v.data : null;
  } catch {
    return null;
  }
}

export function writePlanCache(storage: StorageLike, uid: string, data: unknown, now = Date.now()) {
  try {
    storage.setItem(KEY, JSON.stringify({ uid, savedAt: now, data } satisfies Stored));
  } catch {
    /* storage full or blocked: offline copy is a bonus, never an error */
  }
}

export function clearPlanCache(storage: StorageLike) {
  try {
    storage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
