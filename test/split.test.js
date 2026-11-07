import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitMine, splitOther } from '../src/core/split.js';
import { CONFIG } from '../src/config.js';

const ids = (n) => Array.from({ length: n }, (_, i) => 10 + i);
test('C1 84,000원 4명이면 친구 몫은 각 21,000', () => {
  const r = splitMine(84000, ids(3));
  assert.ok(r.ok); assert.deepEqual(Object.values(r.shares), [21000, 21000, 21000]);
});
test('C2 100,000원 3명: 33,333씩, 나머지 1원은 결제자(나)가 흡수, 합 보존', () => {
  const r = splitMine(100000, ids(2));
  assert.deepEqual(Object.values(r.shares), [33333, 33333]);
  assert.equal(r.mine, 33334); assert.equal(r.mine + 33333 * 2, 100000);
});
test('C3 SETTLE_UNIT=100이면 친구 몫이 100의 배수, 합 보존', () => {
  const r = splitMine(100000, ids(2), { ...CONFIG, SETTLE_UNIT: 100 });
  for (const v of Object.values(r.shares)) assert.equal(v % 100, 0);
  assert.equal(Object.values(r.shares).reduce((a, b) => a + b, 0) + r.mine, 100000);
});
test('C4 남이 낸 결제는 결제자를 0번에 두고 내 몫 계산', () => {
  const r = splitOther(90000, 10, [11, 12]);   // 결제자 10, 참석 11·12, 나 포함 4명
  assert.ok(r.ok); assert.equal(r.myShare, 22500);
  const r2 = splitOther(90000, 10, []);        // 결제자와 나 둘
  assert.equal(r2.myShare, 45000);
});
test('C5 몫이 1원 미만이면 거절', () => {
  assert.equal(splitMine(2, ids(5)).ok, false);
  assert.equal(splitOther(1, 10, ids(4)).ok, false);
  assert.equal(splitMine(84000, []).ok, false);
});
test('C6 calc 회귀: 원본 사본 3인·2항목 예 3개, parseAmount는 쓰지 않음', async () => {
  await import('../lib/tool-calc.js');
  const S = globalThis.SPLIT;
  const P = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const r1 = S.calc({ people: P, items: [{ amount: 30000, payer: 'a', parts: ['a', 'b', 'c'] }, { amount: 9000, payer: 'b', parts: ['a', 'b', 'c'] }], unit: 1 });
  assert.deepEqual(r1.rows.map((r) => r.final), [30000 - 13000, 9000 - 13000, -13000]);
  const r2 = S.calc({ people: P, items: [{ amount: 10000, payer: 'a', parts: ['a', 'b', 'c'] }, { amount: 5000, payer: 'a', parts: ['b', 'c'] }], unit: 1 });
  assert.deepEqual(r2.rows.map((r) => r.final), [15000 - 3334, -3333 - 2500, -3333 - 2500]);
  const r3 = S.calc({ people: P, items: [{ amount: 20000, payer: 'c', parts: ['a', 'b', 'c'] }, { amount: 100, payer: 'b', parts: ['a', 'c'] }], unit: 1 });
  assert.equal(r3.rows.reduce((s, r) => s + r.final, 0), 0);
  assert.equal(r3.rows[2].final, r3.rows[2].paid - r3.rows[2].burden);
  const src = readFileSync(new URL('../src/core/split.js', import.meta.url), 'utf8');
  assert.ok(!/parseAmount\s*\(/.test(src.replace(/\/\/.*$/gm, '')));
});
test('C7 lib/tool-calc.js에 document 참조가 없음', () => {
  const src = readFileSync(new URL('../lib/tool-calc.js', import.meta.url), 'utf8');
  assert.ok(!/\bdocument\b/.test(src));
});
