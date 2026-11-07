import { CONFIG } from '../config.js';
import { addPerson, addGroup } from './db.js';
import { addDays, weekday } from './date.js';
import { baseDayOf } from './night.js';

const EX = { example: true };
function pay(db, o) {
  const id = db.nextId++;
  db.payments.push({ id, kind: 'card', at: '', merchant: '', amount: null, source: 'manual', status: 'pending', laterDay: null, rejectedGroupIds: [],
    groupId: null, attendeeIds: [], payerId: null, baseDay: null, example: true, ...o });
  return id;
}
function entry(db, o, now) {
  const id = db.nextId++;
  db.entries.push({ id, personId: 0, paymentId: null, groupId: null, merchant: '', round: null, share: 1, total: null, baseDay: '', createdAt: now, route: 'manual',
    priorAsk: false, askCount: 0, firstAskAt: null, lastAskAt: null, lastAskDay: null, paid: 0, paidAt: null, hidden: false, example: true, ...o });
}
const lastSaturdayOnOrBefore = (d) => { while (weekday(d) !== 6) d = addDays(d, -1); return d; };

// 첫 사용 안내의 "예시로 해보기"에서만 부른다. 전부 가명이고 모든 줄에 example:true
export function loadExample(db, today, now, cfg = CONFIG) {
  const a = addPerson(db, '철수(예시)', EX), b = addPerson(db, '영희(예시)', EX), c = addPerson(db, '민수(예시)', EX);
  const g = addGroup(db, '대학동기 모임(예시)', [a, b, c], EX);
  const old = lastSaturdayOnOrBefore(addDays(today, -21));
  const oldNext = addDays(old, 1);
  const h1 = pay(db, { at: `${old}T22:10`, merchant: '예시 곱창집', amount: 84000, status: 'confirmed', groupId: g, attendeeIds: [a], baseDay: baseDayOf(`${old}T22:10`, cfg) });
  const h2 = pay(db, { at: `${oldNext}T02:05`, merchant: '예시 택시', amount: 18400, status: 'confirmed', groupId: g, attendeeIds: [a], baseDay: baseDayOf(`${oldNext}T02:05`, cfg) });
  entry(db, { personId: a, paymentId: h1, groupId: g, merchant: '예시 곱창집', round: 1, share: 42000, total: 84000, baseDay: old, route: 'card' }, now);
  entry(db, { personId: a, paymentId: h2, groupId: g, merchant: '예시 택시', round: 2, share: 9200, total: 18400, baseDay: old, route: 'card' }, now);
  entry(db, { personId: b, merchant: '예시 호프', share: 15000, paid: 5000, paidAt: now, baseDay: addDays(today, -9), route: 'manual' }, now);
  const sat = lastSaturdayOnOrBefore(addDays(today, -1));
  pay(db, { at: `${sat}T22:30`, merchant: '예시 곱창집', amount: 76000 });
  pay(db, { kind: 'gap', at: `${addDays(sat, 1)}T00:40`, merchant: '', amount: null });
  let d = addDays(today, -2);
  while (weekday(d) === 6) d = addDays(d, -1);
  pay(db, { at: `${d}T13:10`, merchant: '예시 호프', amount: 28000 });
  db.settings.exampleLoaded = true;
  return { people: 3, groups: 1, payments: 5, entries: 3 };
}

export function exampleCounts(db) {
  return {
    people: db.people.filter((x) => x.example).length, groups: db.groups.filter((x) => x.example).length,
    payments: db.payments.filter((x) => x.example).length, entries: db.entries.filter((x) => x.example).length, owes: db.owes.filter((x) => x.example).length,
  };
}
export const hasExample = (db) => Object.values(exampleCounts(db)).some((n) => n > 0);

// 예시 줄만 지운다. 실제 기록이 참조하는 예시 사람·모임은 남기고 표시만 뗀다.
export function clearExample(db) {
  const removed = { entries: 0, payments: 0, owes: 0, people: 0, groups: 0 };
  const realP = new Set(), realG = new Set();
  for (const e of db.entries) if (!e.example) { realP.add(e.personId); if (e.groupId != null) realG.add(e.groupId); }
  for (const p of db.payments) if (!p.example) {
    p.attendeeIds.forEach((x) => realP.add(x)); if (p.payerId != null) realP.add(p.payerId);
    if (p.groupId != null) realG.add(p.groupId); p.rejectedGroupIds.forEach((x) => realG.add(x));
  }
  for (const o of db.owes) if (!o.example) { realP.add(o.personId); if (o.groupId != null) realG.add(o.groupId); }
  const n0 = db.entries.length; db.entries = db.entries.filter((e) => !e.example); removed.entries = n0 - db.entries.length;
  const gonePay = new Set(db.payments.filter((p) => p.example).map((p) => p.id));
  const n1 = db.payments.length; db.payments = db.payments.filter((p) => !p.example); removed.payments = n1 - db.payments.length;
  const n2 = db.owes.length; db.owes = db.owes.filter((o) => !o.example); removed.owes = n2 - db.owes.length;
  for (const e of db.entries) if (e.paymentId != null && gonePay.has(e.paymentId)) e.paymentId = null;
  const gonePeople = new Set();
  db.people = db.people.filter((p) => {
    if (!p.example) return true;
    if (realP.has(p.id)) { p.example = false; return true; }
    gonePeople.add(p.id); removed.people++; return false;
  });
  const goneGroups = new Set();
  db.groups = db.groups.filter((g) => {
    if (!g.example) return true;
    if (realG.has(g.id)) { g.example = false; return true; }
    goneGroups.add(g.id); removed.groups++; return false;
  });
  for (const g of db.groups) g.memberIds = g.memberIds.filter((m) => !gonePeople.has(m));
  for (const p of db.payments) { p.attendeeIds = p.attendeeIds.filter((m) => !gonePeople.has(m)); p.rejectedGroupIds = p.rejectedGroupIds.filter((x) => !goneGroups.has(x)); if (p.payerId != null && gonePeople.has(p.payerId)) p.payerId = null; }
  db.log.copies = db.log.copies.filter((c) => !gonePeople.has(c.personId));
  db.log.shows = db.log.shows.filter((c) => !gonePeople.has(c.personId));
  if (db.settings.showToday && gonePeople.has(db.settings.showToday.personId)) db.settings.showToday = null;
  return removed;
}
