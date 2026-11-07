import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { computeStats, statsLines, ratioText } from '../src/core/stats.js';
import { addDays } from '../src/core/date.js';
import { mkDb, addEntry, people, addGroup, addPay, TODAY, NOW } from './h.js';

const D = (n) => addDays(TODAY, -n);
const base = () => { const db = mkDb(); db.settings.experimentStart = D(13); return db; };

test('H1 지표 1: 7일 안 복사 분자, 7일 지난 미반응은 분모에 포함, 지나지 않은 건 판정 대기', () => {
  const db = base(); const [a] = people(db, '철수');
  db.log.shows.push({ day: D(10), personId: a, copiedAt: NOW - 8 * 86400000 }, { day: D(8), personId: a, copiedAt: null }, { day: D(3), personId: a, copiedAt: null });
  const s = computeStats(db, TODAY, NOW);
  assert.deepEqual(s.period.show, { num: 1, den: 2, wait: 1 });
});
test('H2 지표 2 회수율과 경로별 합', () => {
  const db = base(); const [a, b] = people(db, '철수', '영희');
  addEntry(db, { personId: a, share: 10000, paid: 4000, route: 'card' }); addEntry(db, { personId: b, share: 20000, paid: 20000, route: 'moved' });
  const s = computeStats(db, TODAY, NOW);
  assert.equal(s.period.recovery.raised, 30000); assert.equal(s.period.recovery.paid, 24000);
  assert.equal(s.period.recovery.ratio, 0.8);
  assert.deepEqual(s.period.recovery.byRoute, { card: 10000, manual: 0, moved: 20000 });
});
test('H3 지표 3 재요청 효과(받음 건 중 askCount ≥ 2)', () => {
  const db = base(); const [a] = people(db, '철수');
  addEntry(db, { personId: a, share: 100, paid: 100, askCount: 2 }); addEntry(db, { personId: a, share: 100, paid: 100, askCount: 0 }); addEntry(db, { personId: a, share: 100, paid: 0, askCount: 5 });
  assert.deepEqual(computeStats(db, TODAY, NOW).period.rerequest, { num: 1, den: 2 });
});
test('H4 주차별 열기·행동 날 수, 주 1회 판정', () => {
  const db = base(); const s0 = db.settings.experimentStart;
  db.log.openDays = [s0, addDays(s0, 1), addDays(s0, 8)]; db.log.actionDays = [addDays(s0, 1)];
  const s = computeStats(db, TODAY, NOW);
  assert.deepEqual(s.weeks.map((w) => [w.opened, w.acted]), [[2, 1], [1, 0], [0, 0], [0, 0]]);
  assert.deepEqual(s.weeks.map((w) => w.used), [true, false, false, false]);
});
test('H5 예시 데이터 제외', () => {
  const db = base(); const [a] = people(db, '철수'); const ex = db.people.push({ id: 5000, name: '예시', passUntil: null, example: true });
  addEntry(db, { personId: a, share: 1000, paid: 1000 }); addEntry(db, { personId: 5000, share: 99999, paid: 99999, example: true });
  db.log.shows.push({ day: D(10), personId: 5000, copiedAt: NOW });
  db.log.copies.push({ at: NOW, day: TODAY, personId: 5000, entries: 1 });
  const s = computeStats(db, TODAY, NOW);
  assert.equal(s.period.recovery.raised, 1000); assert.equal(s.period.show.den, 0); assert.equal(s.all.ledger.copies, 0);
  assert.equal(s.current.openCount, 0);
});
test('H6 분모 0이면 -', () => {
  const s = computeStats(base(), TODAY, NOW);
  assert.equal(s.period.recovery.ratio, null); assert.equal(ratioText(0, 0), '-'); assert.equal(ratioText(1, 3), '1/3 (33%)');
  assert.ok(statsLines(s, { appBuild: 'x', code: 'A1', today: TODAY }).some((l) => l.includes('-')));
});
test('H7 통계 화면 데이터에 이름·모임·가맹점 문자열이 하나도 없음', () => {
  const db = base(); const [a] = people(db, '비밀이름철수'); const g = addGroup(db, '비밀모임명', [a]);
  const p = addPay(db, { merchant: '비밀가게', status: 'confirmed', groupId: g });
  addEntry(db, { personId: a, merchant: '비밀가게', paymentId: p, groupId: g });
  const s = computeStats(db, TODAY, NOW);
  const all = JSON.stringify(s) + statsLines(s, { appBuild: 'x', code: 'A1', today: TODAY }).join('\n');
  for (const w of ['비밀이름철수', '비밀모임명', '비밀가게']) assert.ok(!all.includes(w), w);
});
