import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { addDays } from '../src/core/date.js';
import { ledgerRows, daysLabel, personDays, totalOwed, restDaysLeft, pickShow, candidates, openEntriesOf } from '../src/core/ledger.js';
import { entryStage, personStage, buildMessage, copyAsk, passPerson, markPaid, partialPaid, undoPaid, hidePerson, unhidePerson, askView } from '../src/core/actions.js';
import { candidatesFor, pickHeadline, tierOf } from '../src/core/headline.js';
import { COPY, UI } from '../src/copy.js';
import { createStore } from '../src/store.js';
import { mkDb, addEntry, people, TODAY, NOW } from './h.js';

const D = (n) => addDays(TODAY, -n);       // n일 전

test('F1 5명 정렬: 결제일 오래된 순, 같으면 남은 금액 큰 순', () => {
  const db = mkDb();
  const [a, b, c, d, e] = people(db, '가', '나', '다', '라', '마');
  addEntry(db, { personId: a, baseDay: D(5), share: 1000 });
  addEntry(db, { personId: b, baseDay: D(30), share: 1000 });
  addEntry(db, { personId: c, baseDay: D(30), share: 5000 });
  addEntry(db, { personId: d, baseDay: D(1), share: 9000 });
  addEntry(db, { personId: e, baseDay: D(30), share: 5000 });
  assert.deepEqual(ledgerRows(db, TODAY).map((r) => r.personId), [c, e, b, a, d]);   // 같은 금액이면 이름 가나다순
});
test('F2 N=0은 오늘, 사람의 N은 가장 오래된 열린 건', () => {
  const db = mkDb();
  const [a] = people(db, '가');
  addEntry(db, { personId: a, baseDay: TODAY });
  assert.equal(daysLabel(personDays(db, a, TODAY)), '오늘');
  addEntry(db, { personId: a, baseDay: D(21) }); addEntry(db, { personId: a, baseDay: D(3) });
  assert.equal(personDays(db, a, TODAY), 21); assert.equal(daysLabel(21), '21일째');
});
test('F3 횟수 0·1·2·3·4·5회 → 단계 1·2·3·4·4·4', () => {
  const out = [0, 1, 2, 3, 4, 5].map((n) => entryStage({ askCount: n, priorAsk: false }));
  assert.deepEqual(out, [1, 2, 3, 4, 4, 4]);
});
test('F4 옮긴 건 첫 복사 = 2단계, 둘째 = 3단계', () => {
  assert.equal(entryStage({ askCount: 0, priorAsk: true }), 2);
  assert.equal(entryStage({ askCount: 1, priorAsk: true }), 3);
  assert.equal(entryStage({ askCount: 3, priorAsk: true }), 4);
});
test('F5 같은 날 두 번 복사 → 횟수 +1 한 번, 마지막 시각만 갱신', () => {
  const db = mkDb(); const [a] = people(db, '철수'); const e = addEntry(db, { personId: a, baseDay: D(5) });
  copyAsk(db, a, TODAY, NOW); copyAsk(db, a, TODAY, NOW + 5000);
  const x = db.entries.find((y) => y.id === e);
  assert.equal(x.askCount, 1); assert.equal(x.firstAskAt, NOW); assert.equal(x.lastAskAt, NOW + 5000); assert.equal(x.lastAskDay, TODAY);
});
test('F6 쉬는 기간 표: 경계 전날 안 뜨고 당일 뜸', () => {
  const rest = [0, 3, 7, 14, 30, 30];
  rest.forEach((r, c) => {
    const db = mkDb(); const [a] = people(db, '철수');
    addEntry(db, { personId: a, baseDay: D(100), askCount: c, lastAskDay: c ? TODAY : null });
    const on = (n) => candidates(db, addDays(TODAY, n)).some((x) => x.personId === a);
    if (c === 0) { assert.ok(on(0)); return; }
    // 복사한 날 당일은 별도 규칙으로 제외, 경계 전날 불가·당일 가능
    assert.ok(!on(r - 1), `회 ${c} 전날`); assert.ok(on(r), `회 ${c} 당일`);
  });
});
test('F7 오늘은 패스: 3일째 안 뜨고 3일 뒤 뜸', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, baseDay: D(10) });
  passPerson(db, a, TODAY);
  const on = (n) => candidates(db, addDays(TODAY, n)).length === 1;
  assert.ok(!on(0) && !on(1) && !on(2)); assert.ok(on(3));
});
test('F8 한 명만 띄움(오래된 순)·외 N명 수', () => {
  const db = mkDb(); const [a, b, c] = people(db, '가', '나', '다');
  addEntry(db, { personId: a, baseDay: D(3) }); addEntry(db, { personId: b, baseDay: D(20) }); addEntry(db, { personId: c, baseDay: D(9) });
  const r = pickShow(db, TODAY, NOW);
  assert.equal(r.personId, b); assert.equal(r.others, 2);
});
test('F9 같은 날 재계산해도 같은 사람; 패스·복사·받았어 뒤에는 다음 사람', () => {
  const mk = () => { const db = mkDb(); const [a, b, c] = people(db, '가', '나', '다');
    addEntry(db, { personId: a, baseDay: D(30) }); addEntry(db, { personId: b, baseDay: D(20) }); addEntry(db, { personId: c, baseDay: D(9) }); return { db, a, b, c }; };
  let { db, a, b, c } = mk();
  assert.equal(pickShow(db, TODAY, NOW).personId, a);
  addEntry(db, { personId: c, baseDay: D(90) });                       // 더 오래된 사람이 생겨도 오늘은 그대로
  assert.equal(pickShow(db, TODAY, NOW).personId, a);
  assert.equal(db.log.shows.filter((s) => s.day === TODAY && s.personId === a).length, 1);
  copyAsk(db, a, TODAY, NOW); assert.equal(pickShow(db, TODAY, NOW).personId, c);
  ({ db, a, b, c } = mk()); pickShow(db, TODAY, NOW); passPerson(db, a, TODAY); assert.equal(pickShow(db, TODAY, NOW).personId, b);
  ({ db, a, b, c } = mk()); pickShow(db, TODAY, NOW); markPaid(db, a, NOW); assert.equal(pickShow(db, TODAY, NOW).personId, b);
});
test('F10 FIRST_SHOW_MIN_DAYS: 오늘 건은 안 뜨고 1일째부터 뜸', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, baseDay: TODAY });
  assert.equal(pickShow(db, TODAY, NOW), null);
  assert.equal(pickShow(db, addDays(TODAY, 1), NOW).personId, a);
  assert.equal(pickShow(db, TODAY, NOW, { ...CONFIG, FIRST_SHOW_MIN_DAYS: 0 }).personId, a);
});
test('F11 오늘을 +60일로 줘도 저장 값이 변하지 않음(만료 없음)', () => {
  const db = mkDb(); const [a] = people(db, '철수');
  addEntry(db, { personId: a, baseDay: D(10), askCount: 2, lastAskDay: D(8), lastAskAt: NOW });
  const snap = JSON.stringify(db); const far = addDays(TODAY, 60);
  ledgerRows(db, far); personStage(db, a); totalOwed(db); restDaysLeft(db, a, far); candidates(db, far); personDays(db, a, far);
  assert.equal(JSON.stringify(db), snap);
  assert.equal(personStage(db, a), 3); assert.equal(personDays(db, a, far), 70);
});
test('F12 복사 시 열린 건 전부 갱신, 받음·숨긴 건은 제외', () => {
  const db = mkDb(); const [a] = people(db, '철수');
  const o1 = addEntry(db, { personId: a }); const o2 = addEntry(db, { personId: a });
  const paid = addEntry(db, { personId: a, paid: 10000, share: 10000 }); const hid = addEntry(db, { personId: a, hidden: true });
  const n = copyAsk(db, a, TODAY, NOW);
  assert.equal(n, 2);
  const ac = (id) => db.entries.find((x) => x.id === id).askCount;
  assert.deepEqual([ac(o1), ac(o2), ac(paid), ac(hid)], [1, 1, 0, 0]);
  assert.equal(db.log.copies.length, 1);
});
test('F13 사람 단계 = 건 단계 최솟값, 쉬는 기간 = 횟수 최댓값·마지막 복사일 최댓값', () => {
  const db = mkDb(); const [a] = people(db, '철수');
  addEntry(db, { personId: a, baseDay: D(60), askCount: 3, lastAskDay: D(20) });
  addEntry(db, { personId: a, baseDay: D(50), askCount: 1, lastAskDay: D(5) });
  assert.equal(personStage(db, a), 2);
  // 횟수 최댓값 3 → 14일, 마지막 복사일 최댓값 D(5) → 9일 남음
  assert.equal(restDaysLeft(db, a, TODAY), 9);
});
test('F14 받았어(전액) 모든 열린 건 완료', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, share: 3000 }); addEntry(db, { personId: a, share: 4000 });
  const r = markPaid(db, a, NOW);
  assert.equal(r.count, 2); assert.equal(totalOwed(db), 0); assert.ok(db.entries.every((e) => e.paid === e.share && e.paidAt === NOW));
});
test('F15 일부만: 47,500 중 20,000 → 오래된 건부터 차감, 남은 합 27,500', () => {
  const db = mkDb(); const [a] = people(db, '철수');
  const B = addEntry(db, { personId: a, share: 17500, baseDay: D(5) }); const A = addEntry(db, { personId: a, share: 30000, baseDay: D(21) });
  const r = partialPaid(db, a, 20000, NOW);
  assert.ok(r.ok);
  assert.equal(db.entries.find((e) => e.id === A).paid, 20000); assert.equal(db.entries.find((e) => e.id === B).paid, 0);
  assert.equal(totalOwed(db), 27500);
});
test('F16 일부만 금액이 남은 합 초과 → 거부, 같으면 전액과 동일', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, share: 30000 });
  const r = partialPaid(db, a, 30001, NOW); assert.equal(r.ok, false); assert.equal(totalOwed(db), 30000);
  assert.equal(partialPaid(db, a, 0, NOW).ok, false);
  assert.ok(partialPaid(db, a, 30000, NOW).ok); assert.equal(totalOwed(db), 0);
});
test('F17 받은 돈 되돌리기 → paid=0', () => {
  const db = mkDb(); const [a] = people(db, '철수'); const e = addEntry(db, { personId: a, share: 3000 });
  markPaid(db, a, NOW); undoPaid(db, e);
  const x = db.entries[0]; assert.equal(x.paid, 0); assert.equal(x.paidAt, null); assert.equal(totalOwed(db), 3000);
});
test('F18 숨기기: 합계·띄움에서 빠지고 기록 유지, 다시 보이기', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, share: 3000, baseDay: D(9) });
  hidePerson(db, a);
  assert.equal(totalOwed(db), 0); assert.equal(pickShow(db, TODAY, NOW), null); assert.equal(db.entries.length, 1);
  assert.equal(openEntriesOf(db, a).length, 0);
  unhidePerson(db, a); assert.equal(totalOwed(db), 3000); assert.equal(pickShow(db, TODAY, NOW).personId, a);
});
test('F19 설정 상수를 바꾸면 규칙이 따라옴', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, baseDay: D(30), askCount: 1, lastAskDay: TODAY });
  const cfg = { ...CONFIG, PASS_DAYS: 5, REST_DAYS: [0, 10, 20, 30, 40] };
  const on = (n, c) => candidates(db, addDays(TODAY, n), c).length === 1;
  assert.ok(on(3, CONFIG)); assert.ok(!on(3, cfg)); assert.ok(on(10, cfg));
  const db2 = mkDb(); const [b] = people(db2, '영희'); addEntry(db2, { personId: b, baseDay: D(30) });
  passPerson(db2, b, TODAY, cfg); assert.equal(db2.people[0].passUntil, addDays(TODAY, 5));
});
test('F20 금액 단계 경계 49,999 / 50,000 / 199,999 / 200,000', () => {
  const c = (S) => candidatesFor({ S, openCount: 5, O: 0, pendingCount: 0, justZero: false });
  assert.deepEqual(c(49999), ['H1', 'H2']); assert.deepEqual(c(50000), ['H4', 'H5', 'H6']);
  assert.deepEqual(c(199999), ['H4', 'H5', 'H6']); assert.deepEqual(c(200000), ['H7', 'H8', 'H9']);
  assert.equal(tierOf(50000), 1);
  assert.deepEqual(candidatesFor({ S: 30000, openCount: 2, O: 0, pendingCount: 0, justZero: false })[0], 'H3');
});
test('F21 H 선택 우선순위 H11 > 단계 > H13·H14 > H12 > H10', () => {
  const c = (o) => candidatesFor({ S: 0, openCount: 0, O: 0, pendingCount: 0, justZero: false, ...o });
  assert.deepEqual(c({ justZero: true, O: 5, pendingCount: 2 }), ['H11']);
  assert.deepEqual(c({ S: 1000, openCount: 4, O: 5, pendingCount: 2 }), ['H1', 'H2']);
  assert.deepEqual(c({ O: 5, pendingCount: 2 }), ['H13', 'H14']);
  assert.deepEqual(c({ pendingCount: 2 }), ['H12']);
  assert.deepEqual(c({}), ['H10']);
});
test('F22 같은 구간 문구가 연속으로 같은 번호가 되지 않음', () => {
  const ctx = { S: 60000, openCount: 5, O: 0, pendingCount: 0, justZero: false };
  for (const last of ['H4', 'H5', 'H6']) for (const r of [0, 0.34, 0.5, 0.99]) assert.notEqual(pickHeadline({ ...ctx, lastH: last }, () => r), last);
});
test('F23 보낼 문구 채우기', () => {
  const db = mkDb(); const [a, b, c] = people(db, '철수', '민준', 'Alex');
  addEntry(db, { personId: a, merchant: '곱창', share: 30000 }); addEntry(db, { personId: a, merchant: '택시', share: 17500 });
  const m = buildMessage(db, a, {});
  assert.equal(m.text, '철수야 지난번 곱창이랑 택시 정리하다 보니 네 몫이 47,500원이더라. 맞는지 한번 봐 줘');
  addEntry(db, { personId: b, merchant: '가나다라마바사아자차카타파하', share: 1000 }); 
  assert.ok(buildMessage(db, b, {}).text.startsWith('민준아 지난번 가나다라마바사아자차카타 정리'));
  for (const mer of ['A', 'B', 'C']) addEntry(db, { personId: c, merchant: mer, share: 1000 });
  assert.equal(buildMessage(db, c, {}).text, 'Alex~ 지난번 A 외 2건 정리하다 보니 네 몫이 3,000원이더라. 맞는지 한번 봐 줘');
  const d = people(db, '영희')[0]; addEntry(db, { personId: d, merchant: '', share: 2000 });
  assert.ok(buildMessage(db, d, {}).text.includes('지난번 이 건 정리'));
  assert.equal(buildMessage(db, a, { variant: 1 }).text.startsWith('철수야 얼마 전'), true);
});
test('F24 더 부드럽게는 한 단계 낮춤(1단계에서는 그대로), 올리는 경로 없음', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, merchant: '곱창', share: 1000, askCount: 2 });
  const base = buildMessage(db, a, {}).text;
  assert.ok(base.includes('시간이 좀 지나서'));
  assert.ok(buildMessage(db, a, { soften: 1 }).text.includes('시간 날 때'));
  assert.equal(buildMessage(db, a, { soften: -3 }).text, base);
  const db2 = mkDb(); const [b] = people(db2, '철수'); addEntry(db2, { personId: b, merchant: '곱창', share: 1000 });
  assert.equal(buildMessage(db2, b, { soften: 2 }).text, buildMessage(db2, b, {}).text);
  assert.equal(buildMessage(db2, b, {}).canSoften, false);
  assert.equal(buildMessage(db, a, {}).canSoften, true);
});
function walk(o, f) { if (typeof o === 'string') f(o); else if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => walk(x, f)); }
test('F25 화면 문구 금지어 검사', () => {
  const bad = ['!', '독촉', '추심', '연체', '먹튀', '빨리', '당장', '아직도', '언제까지', '채무', '변제', '법적', '탕감', '면제', '포기', '벌다', '수익', '이득', '대박', '잭팟', '판돈', '베팅'];
  const found = [];
  walk({ COPY, UI }, (s) => { for (const w of bad) if (s.includes(w)) found.push(`${w}: ${s}`); });
  assert.deepEqual(found, []);
});
test('F26 보낼 문구에 숫자 일수·횟수·모임 이름이 안 들어감', () => {
  const keys = Object.keys(COPY).filter((k) => /^S\d-\d$/.test(k));
  assert.equal(keys.length, 8);
  for (const k of keys) {
    const holes = [...COPY[k].matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    for (const h of holes) assert.ok(['이름', '아/야', '무엇', '금액'].includes(h), `${k} ${h}`);
    assert.ok(!/\d/.test(COPY[k]), k);
  }
});
test('F27 받아내기 화면용 데이터에 단계·횟수 항목이 없음', () => {
  const db = mkDb(); const [a] = people(db, '철수'); addEntry(db, { personId: a, askCount: 2 });
  const v = askView(db, a, TODAY);
  assert.ok(!Object.keys(v).some((k) => /stage|ask|count|단계|횟수|times/i.test(k)), Object.keys(v).join());
  assert.ok(!JSON.stringify(v).includes('"stage"'));
  const m = buildMessage(db, a, {});
  assert.ok(!Object.keys(m).some((k) => /stage|ask|단계|횟수/i.test(k)));
});
test('F28 copy.js 키와 문구 3판 번호 일치(N1~N10·E3 제외)', () => {
  const md = readFileSync(new URL('../../문구/진행문구_v3.md', import.meta.url), 'utf8');
  const body = md.slice(md.indexOf('\n## 2.'), md.indexOf('\n## 8.'));
  const ids = new Set();
  for (const line of body.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, 4);
    for (const c of cells) { const m = /^\s*\**([A-Z]\d{1,2}(?:-\d)?)\b/.exec(c); if (m) { ids.add(m[1]); break; } }
  }
  const EXCLUDED = ['E3'];
  const have = new Set(Object.keys(COPY));
  const miss = [...ids].filter((i) => !have.has(i) && !EXCLUDED.includes(i));
  const extra = [...have].filter((i) => !ids.has(i));
  assert.deepEqual(miss, []); assert.deepEqual(extra, []);
  assert.equal(ids.size, 54);
});
test('F29 복사 되돌리기(저장본 복원)로 횟수·시각·통계 원복', () => {
  const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const store = createStore(storage, { now: () => NOW, today: () => TODAY });
  store.load();
  store.update((db) => { const a = people(db, '철수')[0]; addEntry(db, { personId: a, baseDay: D(10) }); });
  const before = JSON.stringify(store.db);
  const a = store.db.people[0].id;
  store.update((db) => copyAsk(db, a, TODAY, NOW), { undo: true });
  assert.equal(store.db.entries[0].askCount, 1); assert.equal(store.db.log.copies.length, 1);
  assert.ok(store.canUndo()); store.undo();
  assert.equal(JSON.stringify(store.db), before); assert.equal(store.db.entries[0].askCount, 0);
  assert.equal(mem.get('mj.db'), before);
});
