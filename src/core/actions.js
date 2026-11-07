import { CONFIG } from '../config.js';
import { COPY, fillS, whatText } from '../copy.js';
import { fmtWon } from './split.js';
import { dayOfMs, diffDays, addDays } from './date.js';
import { openEntriesOf, sumRemaining, personDays, daysLabel, remainingOf } from './ledger.js';

export function logOpen(db, day, cfg = CONFIG) {
  if (!db.log.openDays.includes(day)) db.log.openDays.push(day);
  db.log.openDays = db.log.openDays.slice(-cfg.LOG_KEEP_DAYS);
}
export function logAction(db, day, cfg = CONFIG) {
  if (!db.log.actionDays.includes(day)) db.log.actionDays.push(day);
  db.log.actionDays = db.log.actionDays.slice(-cfg.LOG_KEEP_DAYS);
}
const personOf = (db, id) => db.people.find((p) => p.id === id);

// 건 단계 = min(4, 1 + 복사 횟수 + (옮긴 건이면 1)). 화면에는 어디에도 나오지 않는다.
export const entryStage = (e, cfg = CONFIG) => Math.min(cfg.STAGE_MAX, 1 + e.askCount + (e.priorAsk ? 1 : 0));
// 사람 단계는 열린 건 단계의 최솟값(말투는 가장 부드러운 쪽)
export function personStage(db, pid, cfg = CONFIG) {
  const list = openEntriesOf(db, pid);
  return list.length ? Math.min(...list.map((e) => entryStage(e, cfg))) : 1;
}

const ORDER = [['S1-2', 'S1-1'], ['S2-1', 'S2-2'], ['S3-1', 'S3-2'], ['S4-2', 'S4-1']];
// 보낼 문구. soften = 몇 단계 낮출지(0 이상만 인정), variant = 같은 단계의 다른 문구 순서
export function buildMessage(db, pid, opts = {}, cfg = CONFIG) {
  const list = openEntriesOf(db, pid);
  const soften = Math.max(0, opts.soften | 0);
  const stage = Math.max(1, personStage(db, pid, cfg) - soften);
  const keys = ORDER[Math.min(stage, ORDER.length) - 1];
  const key = keys[Math.abs(opts.variant | 0) % keys.length];
  const person = personOf(db, pid);
  const text = fillS(COPY[key], { 이름: person ? person.name : '', 무엇: whatText(list.map((e) => e.merchant), 12), 금액: fmtWon(sumRemaining(list)) });
  return { text, canSoften: stage > 1, variants: keys.length };
}

export function askView(db, pid, today) {
  const list = openEntriesOf(db, pid);
  const p = personOf(db, pid);
  const last = list.map((e) => e.lastAskDay).filter(Boolean).sort().pop() || null;
  return {
    personId: pid, name: p ? p.name : '', remaining: sumRemaining(list), items: list.length,
    days: personDays(db, pid, today), daysLabel: daysLabel(personDays(db, pid, today)),
    copiedAgo: last ? diffDays(today, last) : null,
  };
}

// 문구 복사(성공했을 때만 부른다). 열린 건 전부 갱신. 바뀐 건 수를 돌려준다.
export function copyAsk(db, pid, today, now, cfg = CONFIG) {
  const list = openEntriesOf(db, pid);
  for (const e of list) {
    if (e.lastAskDay !== today) e.askCount += 1;
    if (!e.firstAskAt) e.firstAskAt = now;
    e.lastAskAt = now; e.lastAskDay = today;
  }
  const p = personOf(db, pid);
  if (p && !p.example) {
    db.log.copies.push({ at: now, day: today, personId: pid, entries: list.length });
    for (const s of db.log.shows) if (s.personId === pid && s.copiedAt == null && diffDays(today, s.day) <= cfg.SHOW_REACT_DAYS - 1) s.copiedAt = now;
    logAction(db, today, cfg);
  }
  return list.length;
}

export function passPerson(db, pid, today, cfg = CONFIG) {
  const p = personOf(db, pid);
  if (p) p.passUntil = addDays(today, cfg.PASS_DAYS);
}

export function markPaid(db, pid, now, cfg = CONFIG) {
  const list = openEntriesOf(db, pid);
  let amount = 0;
  for (const e of list) { amount += remainingOf(e); e.paid = e.share; e.paidAt = now; }
  const p = personOf(db, pid);
  if (p && !p.example) logAction(db, dayOfMs(now), cfg);
  return { count: list.length, amount };
}

// 오래된 건부터 채운다(기준일, 만든 시각, 번호 순)
export function partialPaid(db, pid, amount, now, cfg = CONFIG) {
  if (!cfg.PARTIAL_PAYMENT) return { ok: false, code: 'off' };
  const list = openEntriesOf(db, pid).sort((a, b) => (a.baseDay < b.baseDay ? -1 : a.baseDay > b.baseDay ? 1 : a.createdAt - b.createdAt || a.id - b.id));
  const total = sumRemaining(list);
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, code: 'range' };
  if (amount > total) return { ok: false, code: 'over', max: total };
  if (amount === total) return { ok: true, ...markPaid(db, pid, now, cfg) };
  let left = amount;
  for (const e of list) {
    if (left <= 0) break;
    const put = Math.min(left, remainingOf(e));
    e.paid += put; e.paidAt = now; left -= put;
  }
  const p = personOf(db, pid);
  if (p && !p.example) logAction(db, dayOfMs(now), cfg);
  return { ok: true, count: list.length, amount };
}

export function undoPaid(db, entryId) {
  const e = db.entries.find((x) => x.id === entryId);
  if (e) { e.paid = 0; e.paidAt = null; }
}
export function hidePerson(db, pid) {
  const list = openEntriesOf(db, pid);
  for (const e of list) e.hidden = true;
  return list.length;
}
export function unhidePerson(db, pid) {
  let n = 0;
  for (const e of db.entries) if (e.personId === pid && e.hidden) { e.hidden = false; n++; }
  return n;
}
export function deleteEntry(db, id) {
  db.entries = db.entries.filter((e) => e.id !== id);
}
