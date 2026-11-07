import { CONFIG } from '../config.js';
import { DB_VERSION } from '../version.js';
import { normalizeDb, countsOf } from './db.js';

export const BACKUP_FORMAT = 'miljeongsan-backup';

export function exportBackup(db, now, appBuild) {
  return { format: BACKUP_FORMAT, v: DB_VERSION, appBuild, exportedAt: now, data: JSON.parse(JSON.stringify(db)) };
}
export const exportText = (db, now, appBuild) => JSON.stringify(exportBackup(db, now, appBuild));
export const exportFileName = (day) => `miljeongsan-backup-${day.replace(/-/g, '')}.json`;

// 불러오기 검사. 하나라도 실패하면 {ok:false, code}만 돌려주고 아무것도 바꾸지 않는다.
export function importBackup(text, cfg = CONFIG) {
  if (typeof text !== 'string') return { ok: false, code: 'format' };
  if (new TextEncoder().encode(text).length > cfg.MAX_IMPORT_BYTES) return { ok: false, code: 'size' };
  let o;
  try { o = JSON.parse(text); } catch { return { ok: false, code: 'json' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.format !== BACKUP_FORMAT) return { ok: false, code: 'format' };
  if (Number.isInteger(o.v) && o.v > DB_VERSION) return { ok: false, code: 'version' };
  const r = normalizeDb(o.data, cfg);
  if (!r.ok) return r;
  return { ok: true, db: r.db, counts: countsOf(r.db) };
}

// 백업 권유: 장부(건)가 있고, 마지막 내보내기가 없거나 7일 지났고, 오늘 아직 안 보여 줬으면 true
export function shouldNudge(db, now, today, cfg = CONFIG) {
  if (!db.entries.length) return false;
  if (db.settings.nudgeDay === today) return false;
  const last = db.settings.lastExportAt;
  return last == null || now - last >= cfg.BACKUP_NUDGE_DAYS * 86400000;
}
