import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parsePayLine, parsePayLines, parseMoveLine, markDuplicates } from '../src/core/parse.js';
import { addPayments } from '../src/core/importer.js';
import { mkDb, addPay, TODAY } from './h.js';

const P = (s) => parsePayLine(s, TODAY);
test('D1 `10/12 22:10 을지로 곱창 84,000` 전 칸 해석', () => {
  const r = P('10/12 22:10 을지로 곱창 84,000');
  assert.ok(r.ok);
  assert.deepEqual(r.values, { at: '2026-10-12T22:10', merchant: '을지로 곱창', amount: 84000 });
});
test('D2 `84000 곱창`: 날짜는 오늘, 시각 없음', () => {
  const r = P('84000 곱창');
  assert.deepEqual(r.values, { at: TODAY, merchant: '곱창', amount: 84000 });
});
test('D3 금액 표기', () => {
  assert.equal(parseMoney('21,000원'), 21000); assert.equal(parseMoney('2만'), 20000); assert.equal(parseMoney('2.1만'), 21000);
  assert.equal(parseMoney('2만5천'), 25000); assert.equal(parseMoney('5천'), 5000); assert.equal(parseMoney('２１，０００'), 21000);
  assert.equal(parseMoney('21000'), 21000); assert.equal(parseMoney('12'), null); assert.equal(parseMoney('곱창'), null);
});
test('D4 날짜 표기', () => {
  for (const [s, d] of [['10/12', '2026-10-12'], ['10.12', '2026-10-12'], ['2026-10-12', '2026-10-12'], ['10월 12일', '2026-10-12'], ['어제', '2026-11-06'], ['그제', '2026-11-05'], ['오늘', '2026-11-07']]) {
    const r = P(`${s} 곱창 5000`);
    assert.equal(r.values.at, d, s);
  }
});
test('D5 연도 추정: 오늘보다 미래인 월/일은 작년', () => {
  assert.equal(P('12/25 곱창 5000').values.at, '2025-12-25');
  assert.equal(P('11/07 곱창 5000').values.at, '2026-11-07');
  assert.equal(P('11/08 곱창 5000').values.at, '2025-11-08');
});
test('D6 시각 표기', () => {
  assert.equal(P('10/12 22:10 곱창 5000').values.at, '2026-10-12T22:10');
  assert.equal(P('10/12 22시 10분 곱창 5000').values.at, '2026-10-12T22:10');
  assert.equal(P('10/12 오후 10시 곱창 5000').values.at, '2026-10-12T22:00');
  assert.equal(P('10/12 오전 12시 곱창 5000').values.at, '2026-10-12T00:00');
  assert.equal(P('10/12 오후 10:10 곱창 5000').values.at, '2026-10-12T22:10');
  assert.equal(P('10/12 오후 12시 곱창 5000').values.at, '2026-10-12T12:00');
});
test('D7 금액 없는 줄은 못 읽음, 나머지 줄은 정상', () => {
  const r = parsePayLines('곱창\n84000 호프\n', TODAY);
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].ok, false); assert.deepEqual(r.lines[0].bad, ['amount']);
  assert.equal(r.lines[1].ok, true);
});
test('D8 빈 줄·공백 줄 무시, 101번째 줄부터 버리고 경고', () => {
  const t = ['', '   ', '5000 가', ''].join('\n');
  assert.equal(parsePayLines(t, TODAY).lines.length, 1);
  const many = Array.from({ length: 105 }, (_, i) => `${10000 + i} 가`).join('\n');
  const r = parsePayLines(many, TODAY);
  assert.equal(r.lines.length, 100); assert.ok(r.warnings.includes('limit'));
});
test('D9 소수점·마이너스는 못 읽음(다른 값으로 읽지 않음)', () => {
  for (const s of ['곱창 15000.5', '곱창 -5000', '곱창 -5000원']) {
    const r = P(s); assert.equal(r.ok, false, s); assert.ok(r.bad.includes('amount'), s);
  }
  assert.equal(P('곱창 1.5').ok, false);
  assert.ok(Number.isNaN(parseMoney('15000.5')) && Number.isNaN(parseMoney('-5000')));
});
test('D10 옮기기 줄', () => {
  const a = parseMoveLine('철수 21000 곱창 10/12', TODAY);
  assert.deepEqual(a.values, { name: '철수', amount: 21000, merchant: '곱창', day: '2026-10-12' });
  const b = parseMoveLine('영희 2.1만 택시', TODAY);
  assert.deepEqual(b.values, { name: '영희', amount: 21000, merchant: '택시', day: TODAY });
  const c = parseMoveLine('철수', TODAY); assert.equal(c.ok, false); assert.ok(c.bad.includes('amount'));
  const d = parseMoveLine('21000 10/12', TODAY); assert.ok(!d.ok && d.bad.includes('name'));
});
test('D11 분해형으로 붙여넣은 가맹점·이름이 조합형으로 저장', () => {
  const r = P('을지로곱창 84000'.normalize('NFD'));
  assert.equal(r.values.merchant, '을지로곱창');
  const m = parseMoveLine('철수 5000 곱창'.normalize('NFD'), TODAY);
  assert.equal(m.values.name, '철수'); assert.equal(m.values.merchant, '곱창');
});
test('D12 같은 일시·금액·가맹점은 이미 있어로 표시', () => {
  const db = mkDb();
  addPay(db, { at: '2026-10-12T22:10', merchant: '을지로 곱창', amount: 84000 });
  const lines = parsePayLines('10/12 22:10 을지로곱창 84000\n10/12 22:10 을지로곱창 85000', TODAY).lines;
  markDuplicates(lines, db.payments);
  assert.equal(lines[0].dup, true); assert.equal(lines[1].dup, false);
});
test('D13 존재하지 않는 날짜(2/30) 못 읽음', () => {
  const r = P('2/30 곱창 5000'); assert.equal(r.ok, false); assert.ok(r.bad.includes('date'));
});
test('D14 한 줄 안에 금액이 둘이면 경고', () => {
  const r = P('곱창 21000 84000');
  assert.equal(r.values.amount, 84000); assert.ok(r.warnings.includes('multiAmount'));
});
test('D15 addPayments는 허용 외 항목을 저장하지 않고 세 경로가 같은 검증', () => {
  for (const src of ['manual', 'paste', 'import']) {
    const db = mkDb();
    const r = addPayments(db, [
      { at: '2026-10-12T22:10', merchant: '곱창', amount: 84000, cardNumber: '1234-5678', approvalNo: '99' },
      { at: '2026-10-12T22:10', merchant: '곱창', amount: -5 },
      { at: '2026-13-40', merchant: '곱창', amount: 5000 },
    ], src, 1);
    assert.equal(r.added.length, 1); assert.equal(r.rejected.length, 2);
    const p = db.payments[0];
    assert.equal(p.source, src);
    assert.ok(!('cardNumber' in p) && !('approvalNo' in p));
    assert.ok(!JSON.stringify(db).includes('1234-5678'));
    assert.deepEqual(Object.keys(p).sort(), ['amount', 'at', 'attendeeIds', 'baseDay', 'example', 'groupId', 'id', 'kind', 'laterDay', 'merchant', 'payerId', 'rejectedGroupIds', 'source', 'status']);
  }
});
