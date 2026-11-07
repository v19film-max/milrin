import test from 'node:test';
import assert from 'node:assert/strict';
import { diffDays, addDays, weekdayName, isValidDay } from '../src/core/date.js';
import { baseDayOf, groupNights, clockText, nightTitle, nightKeyOf } from '../src/core/night.js';
import { mkDb, addPay } from './h.js';

test('B1 일수 차: 월·연 경계, 윤년', () => {
  assert.equal(diffDays('2026-03-01', '2026-02-28'), 1);
  assert.equal(diffDays('2024-03-01', '2024-02-28'), 2);
  assert.equal(diffDays('2027-01-01', '2026-12-31'), 1);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.ok(isValidDay('2024-02-29')); assert.ok(!isValidDay('2026-02-29')); assert.ok(!isValidDay('2026-02-30'));
});
test('B2 시간대와 상관없이 같은 결과(여름시간 경계 포함)', () => {
  let d = '2026-01-01';
  for (let i = 0; i < 366; i++) {
    const n = addDays(d, 1);
    assert.equal(diffDays(n, d), 1);
    d = n;
  }
  assert.equal(diffDays('2026-03-09', '2026-03-08'), 1);
  assert.equal(diffDays('2026-11-02', '2026-11-01'), 1);
  assert.equal(weekdayName('2026-11-07'), '토요일');
});
test('B3 22:10·00:30·02:05는 같은 밤, 밤 날짜는 토요일', () => {
  assert.equal(baseDayOf('2026-11-07T22:10'), '2026-11-07');
  assert.equal(baseDayOf('2026-11-08T00:30'), '2026-11-07');
  assert.equal(baseDayOf('2026-11-08T02:05'), '2026-11-07');
  const db = mkDb();
  addPay(db, { at: '2026-11-07T22:10' }); addPay(db, { at: '2026-11-08T00:30' }); addPay(db, { at: '2026-11-08T02:05' });
  const g = groupNights(db.payments);
  assert.equal(g.length, 1); assert.equal(g[0].baseDay, '2026-11-07'); assert.equal(g[0].key, '2026-11-07#1');
});
test('B4 13:00과 20:00은 별개 묶음, 같은 날짜', () => {
  const db = mkDb();
  addPay(db, { at: '2026-11-07T13:00' }); addPay(db, { at: '2026-11-07T20:00' });
  const g = groupNights(db.payments);
  assert.equal(g.length, 2); assert.equal(g[0].baseDay, g[1].baseDay);
  assert.deepEqual(g.map((x) => x.key), ['2026-11-07#1', '2026-11-07#2']);
});
test('B5 05:59 단독 결제는 전날, 06:00은 당일', () => {
  assert.equal(baseDayOf('2026-11-08T05:59'), '2026-11-07');
  assert.equal(baseDayOf('2026-11-08T06:00'), '2026-11-08');
});
test('B6 차수 번호가 빈칸 포함 시각순으로 매겨짐', () => {
  const db = mkDb();
  const c = addPay(db, { at: '2026-11-08T02:05' });
  const a = addPay(db, { at: '2026-11-07T22:10' });
  const b = addPay(db, { kind: 'gap', at: '2026-11-08T00:30', amount: null });
  const g = groupNights(db.payments)[0];
  assert.deepEqual(g.items.map((i) => [i.payment.id, i.round]), [[a, 1], [b, 2], [c, 3]]);
  assert.equal(nightKeyOf(db.payments, b), '2026-11-07#1');
});
test('B7 날짜만 있는 결제는 20:00 가정으로 묶이고 시각 표기는 없음', () => {
  const db = mkDb();
  addPay(db, { at: '2026-11-07' }); addPay(db, { at: '2026-11-07T22:30' });
  const g = groupNights(db.payments);
  assert.equal(g.length, 1);
  assert.equal(clockText('2026-11-07'), '');
});
test('B8 시각 표기', () => {
  assert.equal(clockText('2026-11-08T00:30'), '새벽 12시 반');
  assert.equal(clockText('2026-11-07T22:00'), '밤 10시');
  assert.equal(clockText('2026-11-07T22:10'), '밤 10시 10분');
  assert.equal(clockText('2026-11-07T09:00'), '오전 9시');
  assert.equal(clockText('2026-11-07T12:00'), '오후 12시');
  assert.equal(clockText('2026-11-07T19:05'), '저녁 7시 5분');
});
test('B9 묶음 제목: 요일 밤 / 요일 낮 / 요일만', () => {
  const db = mkDb();
  addPay(db, { at: '2026-11-07T22:10' }); addPay(db, { at: '2026-11-09T13:00' }); addPay(db, { at: '2026-11-10' });
  const t = groupNights(db.payments).map(nightTitle);
  assert.deepEqual(t, ['토요일 밤', '월요일 낮', '화요일']);
});
