import { CONFIG } from '../config.js';
import { diffDays, addDays } from './date.js';
import { nameKey } from './text.js';

export const remainingOf = (e) => e.share - e.paid;
export const isOpen = (e) => !e.hidden && e.paid < e.share;
export const entryState = (e) => (e.hidden ? 'hidden' : e.paid >= e.share ? 'paid' : e.paid > 0 ? 'partial' : 'unpaid');
export const openEntriesOf = (db, pid) => db.entries.filter((e) => e.personId === pid && isOpen(e));
export const sumRemaining = (list) => list.reduce((s, e) => s + remainingOf(e), 0);
// 확정된 장부 건만 센다. 대기 카드(pending 결제)는 건이 아니라서 여기에 들어오지 않는다.
export const totalOwed = (db) => sumRemaining(db.entries.filter(isOpen));
export const openCount = (db) => db.entries.filter(isOpen).length;
export const owesOpen = (db) => db.owes.filter((o) => o.state === 'open');
export const owesTotal = (db) => owesOpen(db).reduce((s, o) => s + o.share, 0);

export function personDays(db, pid, today) {
  const list = openEntriesOf(db, pid);
  if (!list.length) return 0;
  return Math.max(...list.map((e) => diffDays(today, e.baseDay)));
}
export const daysLabel = (n) => (n <= 0 ? '오늘' : `${n}일째`);

function restPeriod(c, cfg) { return cfg.REST_DAYS[Math.min(c, cfg.REST_DAYS.length - 1)]; }

// 쉬는 기간·패스 때문에 앞으로 며칠 더 기다려야 하는지(0이면 대상). 읽기 전용 계산이다.
export function restDaysLeft(db, pid, today, cfg = CONFIG) {
  const list = openEntriesOf(db, pid);
  let left = 0;
  const asked = list.filter((e) => e.lastAskDay);
  if (asked.length) {
    const c = Math.max(...list.map((e) => e.askCount));
    const last = asked.map((e) => e.lastAskDay).sort().pop();
    left = Math.max(left, diffDays(addDays(last, restPeriod(c, cfg)), today));
  }
  const p = db.people.find((x) => x.id === pid);
  if (p && p.passUntil) left = Math.max(left, diffDays(p.passUntil, today));
  return Math.max(0, left);
}

export function ledgerRows(db, today, cfg = CONFIG) {
  const rows = [];
  for (const p of db.people) {
    const list = openEntriesOf(db, p.id);
    if (!list.length) continue;
    rows.push({ personId: p.id, name: p.name, days: personDays(db, p.id, today), remaining: sumRemaining(list), count: list.length, restDays: restDaysLeft(db, p.id, today, cfg) });
  }
  rows.sort((a, b) => b.days - a.days || b.remaining - a.remaining || (nameKey(a.name) < nameKey(b.name) ? -1 : nameKey(a.name) > nameKey(b.name) ? 1 : 0) || a.personId - b.personId);
  return rows;
}

// 앱 열 때 띄울 수 있는 사람들(순서대로). 오늘 이미 문구를 복사한 사람은 오늘 더 안 띄운다.
export function candidates(db, today, cfg = CONFIG) {
  return ledgerRows(db, today, cfg).filter((r) => r.days >= cfg.FIRST_SHOW_MIN_DAYS && r.restDays === 0
    && !openEntriesOf(db, r.personId).some((e) => e.lastAskDay === today));
}

// 하루 한 번 계산해 settings.showToday에 고정한다. 바뀌는 곳은 showToday와 log.shows뿐이다.
export function pickShow(db, today, now, cfg = CONFIG) {
  const list = candidates(db, today, cfg);
  const st = db.settings.showToday;
  let chosen = null;
  if (st && st.day === today) chosen = list.find((r) => r.personId === st.personId) || null;
  if (!chosen) chosen = list[0] || null;
  db.settings.showToday = chosen ? { day: today, personId: chosen.personId } : null;
  if (!chosen) return null;
  if (!db.log.shows.some((s) => s.day === today && s.personId === chosen.personId)) db.log.shows.push({ day: today, personId: chosen.personId, copiedAt: null });
  return { personId: chosen.personId, others: list.length - 1, days: chosen.days };
}
export const peekShow = (db, today, cfg = CONFIG) => {
  const list = candidates(db, today, cfg);
  const st = db.settings.showToday;
  const chosen = (st && st.day === today && list.find((r) => r.personId === st.personId)) || list[0] || null;
  return chosen ? { personId: chosen.personId, others: list.length - 1, days: chosen.days } : null;
};
export const personName = (db, id) => { const p = db.people.find((x) => x.id === id); return p ? p.name : ''; };
