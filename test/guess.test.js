import test from 'node:test';
import assert from 'node:assert/strict';
import { guessGroup, guessAttendees, frameOf, reasonLine } from '../src/core/guess.js';
import { todayQueue, swipeLater, rightSwipe, confirmCard } from '../src/core/cards.js';
import { addPayments } from '../src/core/importer.js';
import { totalOwed } from '../src/core/ledger.js';
import { COPY } from '../src/copy.js';
import { mkDb, addPay, addPerson, addGroup, TODAY, NOW } from './h.js';

const pay = (d, o) => { const id = addPay(d, o); return d.payments.find((x) => x.id === id); };
// 공통 장면: 사람 셋(철수·영희·민수) + 모임 하나
function scene() {
  const db = mkDb();
  const a = addPerson(db, '철수'), b = addPerson(db, '영희'), c = addPerson(db, '민수');
  const g = addGroup(db, '대학동기 모임', [a, b, c]);
  return { db, a, b, c, g };
}
function past(db, g, o) {
  return addPay(db, Object.assign({ status: 'confirmed', groupId: g, attendeeIds: [], baseDay: null }, o));
}

test('E1 이력 없음 → 모임 추측 없음', () => {
  const { db } = scene();
  const p = addPay(db, { at: '2026-10-10T22:10', merchant: '곱창' });
  assert.equal(guessGroup(db, db.payments.find((x) => x.id === p)), null);
});
test('E2 같은 가맹점 이력 → 그 모임 추측(점수 3 이상)', () => {
  const { db, g } = scene();
  past(db, g, { at: '2026-10-03T22:10', merchant: '을지로 곱창', amount: 80000 });
  const p = addPay(db, { at: '2026-10-10T20:00', merchant: '을지로곱창집', amount: 5000 });
  const r = guessGroup(db, db.payments.find((x) => x.id === p));
  assert.equal(r.groupId, g); assert.ok(r.score >= 3);
});
test('E3 같은 밤 앞 결제가 모임 g로 확정 → g 추측(차수 연결)', () => {
  const { db, g } = scene();
  past(db, g, { at: '2026-10-10T22:10', merchant: '곱창' });
  const p = addPay(db, { at: '2026-10-11T00:30', merchant: '완전다른집', amount: 123 });
  const r = guessGroup(db, db.payments.find((x) => x.id === p));
  assert.equal(r.groupId, g); assert.ok(r.score >= 4);
});
test('E4 요일만 같음(2점) → 추측 없음; 요일 + 시간대 모두 → 추측', () => {
  const { db, g } = scene();
  past(db, g, { at: '2026-07-04T10:00', merchant: '다른집', amount: 1000 });
  const p = addPay(db, { at: '2026-10-10T22:10', merchant: '', amount: 84000 });
  assert.equal(guessGroup(db, db.payments.find((x) => x.id === p)), null);
  const db2 = scene(); past(db2.db, db2.g, { at: '2026-07-04T22:00', merchant: '다른집', amount: 1000 });
  const p2 = addPay(db2.db, { at: '2026-10-10T22:10', merchant: '', amount: 84000 });
  const r = guessGroup(db2.db, db2.db.payments.find((x) => x.id === p2));
  assert.equal(r.groupId, db2.g); assert.equal(r.score, 4);
});
test('E5 두 모임 동점 → 없음; 점수 차 1 이상 → 1위', () => {
  const { db, g, a } = scene();
  const g2 = addGroup(db, '회사 모임', [a]);
  past(db, g, { at: '2026-07-04T22:00', merchant: '곱창집', amount: 1000 });
  past(db, g2, { at: '2026-07-04T22:00', merchant: '곱창집', amount: 1000 });
  const p = addPay(db, { at: '2026-10-10T22:10', merchant: '곱창집', amount: 84000 });
  const pay = db.payments.find((x) => x.id === p);
  assert.equal(guessGroup(db, pay), null);
  db.payments.find((x) => x.groupId === g2).merchant = '냉면';
  const r = guessGroup(db, pay);
  assert.equal(r.groupId, g);
});
test('E6 아니야로 제외한 모임은 다시 후보에서 빠짐', () => {
  const { db, g } = scene();
  past(db, g, { at: '2026-10-03T22:10', merchant: '을지로 곱창', amount: 80000 });
  const p = addPay(db, { at: '2026-10-10T20:00', merchant: '을지로곱창집', amount: 5000 });
  const pay = db.payments.find((x) => x.id === p);
  assert.ok(guessGroup(db, pay));
  pay.rejectedGroupIds.push(g);
  assert.equal(guessGroup(db, pay), null);
});
test('E7 참석자 추측 = 지난 밤 참석자 ∩ 현재 멤버, 이력 없으면 전원', () => {
  const { db, g, a, b, c } = scene();
  assert.deepEqual(guessAttendees(db, g), [a, b, c]);
  const gone = addPerson(db, '탈퇴');
  past(db, g, { at: '2026-10-03T22:10', attendeeIds: [b, a, gone] });
  past(db, g, { at: '2026-09-03T22:10', attendeeIds: [c] });
  assert.deepEqual(guessAttendees(db, g), [a, b]);
});
test('E8 문구 틀 선택 C1·C2·C3·C4', () => {
  const { db, g, a, b } = scene();
  const mk = (o) => pay(db, o);
  const c4 = mk({ at: '2026-09-05T13:00', merchant: '곱창', amount: 5000 });
  assert.equal(frameOf(db, c4).frame, 'C4');
  assert.equal(frameOf(db, c4).text, '곱창, 네가 계산했었지?');
  const c4b = mk({ at: '2026-09-05T13:00', merchant: '', amount: 5000 });
  assert.equal(frameOf(db, c4b).text, '이 결제, 네가 계산했었지?');
  const c2 = mk({ at: '2026-09-05T22:10', merchant: '곱창', amount: 5000 });
  assert.equal(frameOf(db, c2).frame, 'C2'); assert.equal(frameOf(db, c2).text, '토요일 밤 곱창, 네가 냈지?');
  past(db, g, { at: '2026-10-03T22:10', merchant: '을지로 곱창', amount: 80000, attendeeIds: [b, a] });
  const c1 = mk({ at: '2026-10-10T20:00', merchant: '을지로곱창집', amount: 5000 });
  assert.equal(frameOf(db, c1).frame, 'C1'); assert.equal(frameOf(db, c1).text, '대학동기 모임이었지? 네가 냈지?');
  const c3 = mk({ at: '2026-10-03T23:50', merchant: '다른집', amount: 5000 });
  const f3 = frameOf(db, c3);
  assert.equal(f3.frame, 'C3'); assert.equal(f3.text, '그날 철수도 같이 있었지?');
});
test('E9 근거 줄: 짧은 형 결합, 22자 초과 시 하나만, 정보 없으면 없음, E3은 안 나옴', () => {
  const { db, g } = scene();
  past(db, g, { at: '2026-09-12T22:00', merchant: '곱창', amount: 1 });
  const mk = (o) => pay(db, o);
  const p = mk({ at: '2026-10-10T22:00', merchant: '곱창', amount: 80000 });
  assert.equal(reasonLine(db, p, g), '토요일 밤 10시 · 지난달에도 이 멤버');
  const q = mk({ at: '2026-10-10T22:10', merchant: '곱창', amount: 80000 });
  assert.equal(reasonLine(db, q, g), '토요일 밤 10시 10분에 낸 결제야');
  const r = mk({ at: '2026-10-10', merchant: '곱창', amount: 80000 });
  assert.equal(reasonLine(db, r, g), '지난달에도 이 멤버였어');
  const s = mk({ at: '2026-10-10', merchant: '', amount: 80000 });
  assert.equal(reasonLine(db, s, null), null);
  assert.ok(!('E3' in COPY));
});
test('E10 빈칸은 다른 사람 입력과 수동 추가에서만 생김(자동 생성 없음)', () => {
  const db = mkDb();
  addPayments(db, [{ at: '2026-10-10T22:10', amount: 1000 }, { at: '2026-10-11T03:10', amount: 1000 }], 'paste', 1);
  assert.equal(db.payments.filter((p) => p.kind === 'gap').length, 0);
  addPayments(db, [{ at: '2026-10-11T00:30', kind: 'gap', amount: null }], 'manual', 1);
  assert.equal(db.payments.filter((p) => p.kind === 'gap').length, 1);
});
test('E11 빈칸 문구 B1·B2·B3·B4 선택', () => {
  const db = mkDb();
  const mk = (o) => pay(db, Object.assign({ kind: 'gap', amount: null }, o));
  addPay(db, { at: '2026-10-10T22:10' });
  const b1 = mk({ at: '2026-10-11T00:30' });
  assert.deepEqual(frameOf(db, b1).lines, ['새벽 12시 반 2차, 네 카드엔 없어', '누가 냈어?']);
  assert.equal(frameOf(db, b1).frame, 'B1');
  const b3 = mk({ at: '2026-10-11T01:10', merchant: '카카오T 택시' });
  assert.equal(frameOf(db, b3).frame, 'B3'); assert.deepEqual(frameOf(db, b3).lines, ['택시 결제는 누구 카드야?']);
  const db2 = mkDb(); addPay(db2, { at: '2026-10-10T22:10' });
  const only = pay(db2, { kind: 'gap', at: '2026-10-10', amount: null });
  assert.equal(frameOf(db2, only).frame, 'B4'); assert.deepEqual(frameOf(db2, only).lines, ['이 차수만 비어 있어. 누가 냈어?']);
  const two = pay(db2, { kind: 'gap', at: '2026-10-10', amount: null });
  assert.equal(frameOf(db2, two).frame, 'B2');
  assert.match(frameOf(db2, two).lines[0], /^\d차는 누가 냈더라\?$/);
});
test('E12 빈칸 차수·시각 문구: 새벽 12시 반 2차', () => {
  const db = mkDb();
  addPay(db, { at: '2026-10-10T22:10' });
  const g = pay(db, { kind: 'gap', at: '2026-10-11T00:30', amount: null });
  assert.ok(frameOf(db, g).lines[0].startsWith('새벽 12시 반 2차'));
});
test('E13 대기 카드(pending)는 합계·건수·통계에 들어가지 않음', () => {
  const { db } = scene();
  addPay(db, { amount: 84000 }); addPay(db, { kind: 'gap', amount: 50000, at: '2026-10-11T00:30' });
  assert.equal(totalOwed(db), 0);
  assert.equal(db.entries.length, 0);
});
test('E14 카드 큐 순서(최근 밤 먼저), 위로 넘긴 카드는 오늘 안 나오고 다음 날 나옴', () => {
  const db = mkDb();
  const old = addPay(db, { at: '2026-10-01T22:00' });
  const n1 = addPay(db, { at: '2026-11-05T22:00' }); const n2 = addPay(db, { at: '2026-11-05T23:30' });
  assert.deepEqual(todayQueue(db, TODAY).map((p) => p.id), [n1, n2, old]);
  swipeLater(db, n1, TODAY);
  assert.deepEqual(todayQueue(db, TODAY).map((p) => p.id), [n2, old]);
  assert.deepEqual(todayQueue(db, '2026-11-08').map((p) => p.id), [n1, n2, old]);
  assert.equal(db.log.swipes.later, 1);
});
test('E15 맞아 확정 → 참석자 수만큼 건 생성, 몫과 기준일 정확', () => {
  const { db, g, a, b, c } = scene();
  const id = addPay(db, { at: '2026-10-11T00:30', merchant: '곱창', amount: 84000 });
  const r = confirmCard(db, id, { groupId: g, attendeeIds: [a, b, c] }, TODAY, NOW);
  assert.ok(r.ok);
  assert.equal(db.entries.length, 3);
  for (const e of db.entries) { assert.equal(e.share, 21000); assert.equal(e.baseDay, '2026-10-10'); assert.equal(e.route, 'card'); assert.equal(e.round, 1); assert.equal(e.paymentId, id); }
  const p = db.payments.find((x) => x.id === id);
  assert.equal(p.status, 'confirmed'); assert.equal(p.baseDay, '2026-10-10'); assert.equal(db.log.swipes.yes, 1);
});
test('E16 추측 모임이 없는 카드를 오른쪽으로 넘기면 확정되지 않고 뒷면 열림', () => {
  const { db } = scene();
  const id = addPay(db, { at: '2026-10-11T00:30', merchant: '곱창' });
  const r = rightSwipe(db, id, TODAY, NOW);
  assert.equal(r.flip, true); assert.equal(db.entries.length, 0);
  assert.equal(db.payments.find((x) => x.id === id).status, 'pending');
});
test('E17 빈칸 + 결제자 + 금액 → owes 생성(몫 정확) + Z1; 금액 없으면 owes 없음', () => {
  const { db, a, b } = scene();
  const id = addPay(db, { kind: 'gap', at: '2026-10-11T00:30', amount: null });
  const r = confirmCard(db, id, { payerId: a, amount: 90000, attendeeIds: [a, b] }, TODAY, NOW);
  assert.ok(r.ok); assert.equal(r.toast, 'Z1');
  assert.equal(db.owes.length, 1); assert.equal(db.owes[0].share, 30000); assert.equal(db.owes[0].personId, a); assert.equal(db.owes[0].state, 'open');
  assert.equal(db.entries.length, 0);
  const id2 = addPay(db, { kind: 'gap', at: '2026-10-11T01:30', amount: null });
  const r2 = confirmCard(db, id2, { payerId: b, attendeeIds: [a, b] }, TODAY, NOW);
  assert.ok(r2.ok); assert.equal(db.owes.length, 1); assert.equal(r2.toast, undefined);
});
test('E18 고쳐서 저장하면 입력한 모임·참석자로 확정, fix를 센다', () => {
  const { db, g, a, b } = scene();
  const id = addPay(db, { at: '2026-10-11T00:30', merchant: '곱창', amount: 60000 });
  const r = confirmCard(db, id, { groupId: g, attendeeIds: [b], fixed: true }, TODAY, NOW);
  assert.ok(r.ok); assert.equal(db.entries.length, 1); assert.equal(db.entries[0].personId, b); assert.equal(db.entries[0].share, 30000);
  assert.equal(db.log.swipes.fix, 1); assert.equal(db.log.swipes.yes, 1);
  assert.equal(db.payments.find((x) => x.id === id).groupId, g);
});
