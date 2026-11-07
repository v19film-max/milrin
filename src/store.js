import { newDb, normalizeDb } from './core/db.js';
import { importBackup } from './core/backup.js';
import { todayStr } from './core/date.js';

export const KEY = 'mj.db', PREV = 'mj.db.prev', BROKEN = 'mj.db.broken';

// 저장소 어댑터. storage는 localStorage 모양(getItem/setItem/removeItem)이라 시험에서는 가짜를 넣는다.
export function createStore(storage, { now = () => Date.now(), today = () => todayStr(), onError = () => {} } = {}) {
  let db = null, undoSnap = null, last;
  const safeGet = (k) => { try { return storage.getItem(k); } catch { return null; } };
  const safeSet = (k, v) => { try { storage.setItem(k, v); return true; } catch { return false; } };
  const parse = (raw) => { try { return normalizeDb(JSON.parse(raw)); } catch { return { ok: false, code: 'json' }; } };
  function save() {
    try { storage.setItem(KEY, JSON.stringify(db)); return true; } catch { onError('save'); return false; }
  }
  const store = {
    get db() { return db; },
    get last() { return last; },
    load() {
      const raw = safeGet(KEY);
      if (raw == null) { db = newDb(now(), today()); save(); return { notice: null }; }
      const r = parse(raw);
      if (r.ok) { db = r.db; safeSet(PREV, raw); return { notice: null }; }
      safeSet(BROKEN, raw);
      const prev = safeGet(PREV);
      const p = prev == null ? { ok: false } : parse(prev);
      if (p.ok) { db = p.db; save(); return { notice: 'recovered' }; }
      db = newDb(now(), today()); save();
      return { notice: 'fresh-broken' };
    },
    update(fn, { undo = false } = {}) {
      const before = undo ? JSON.stringify(db) : null;
      last = fn(db);
      if (undo) undoSnap = before;
      return save();
    },
    canUndo() { return undoSnap != null; },
    undo() {
      if (undoSnap == null) return false;
      db = JSON.parse(undoSnap); undoSnap = null; save();
      return true;
    },
    clearUndo() { undoSnap = null; },
    importReplace(text) {
      const r = importBackup(text);
      if (!r.ok) return r;
      const before = JSON.stringify(db);
      safeSet(PREV, safeGet(KEY) ?? before);
      db = r.db; undoSnap = before; save();
      return { ok: true, counts: r.counts };
    },
    // 모두 지우기: 장부·이름·기록·보관본 전부
    clearAll() {
      for (const k of [KEY, PREV, BROKEN]) { try { storage.removeItem(k); } catch { /* 무시 */ } }
      db = newDb(now(), today()); undoSnap = null; save();
    },
  };
  return store;
}
