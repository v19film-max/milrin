import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { exportBackup, exportText, importBackup, shouldNudge, exportFileName } from '../src/core/backup.js';
import { migrate, normalizeDb } from '../src/core/db.js';
import { loadExample, clearExample } from '../src/core/example.js';
import { createStore } from '../src/store.js';
import { nameKey } from '../src/core/text.js';
import { addDays } from '../src/core/date.js';
import { mkDb, addPay, addEntry, people, addGroup, TODAY, NOW } from './h.js';

function fakeStorage(opts = {}) {
  const mem = new Map();
  return { mem, getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem(k, v) { if (opts.full) throw new Error('QuotaExceededError'); mem.set(k, String(v)); }, removeItem: (k) => mem.delete(k) };
}
function richDb() {
  const db = mkDb();
  const [a, b] = people(db, '철수', '영희'); const g = addGroup(db, '대학동기 모임', [a, b]);
  const p = addPay(db, { at: '2026-10-10T22:10', merchant: '을지로 곱창', amount: 84000, status: 'confirmed', groupId: g, attendeeIds: [a, b], baseDay: '2026-10-10' });
  addEntry(db, { personId: a, paymentId: p, groupId: g, merchant: '을지로 곱창', share: 28000, total: 84000, route: 'card', round: 1 });
  addEntry(db, { personId: b, share: 5000, route: 'moved', priorAsk: true, paid: 2000, paidAt: NOW });
  db.log.swipes.yes = 3; db.log.openDays = [TODAY]; db.log.copies.push({ at: NOW, day: TODAY, personId: a, entries: 1 });
  db.owes.push({ id: db.nextId++, paymentId: p, personId: b, share: 1000, merchant: '택시', baseDay: '2026-10-10', groupId: g, state: 'open', example: false });
  return db;
}

test('G1 내보내기 → 불러오기 왕복 결과가 원본과 완전히 같음(한글 이름 포함)', () => {
  const db = richDb();
  const text = exportText(db, NOW, '4w-001');
  const r = importBackup(text);
  assert.ok(r.ok, r.code); assert.deepEqual(r.db, db);
  assert.equal(exportFileName('2026-11-07'), 'miljeongsan-backup-20261107.json');
  assert.equal(JSON.parse(text).format, 'miljeongsan-backup');
});
test('G2 분해형 이름이 든 파일을 불러오면 조합형으로 정규화', () => {
  const db = richDb();
  const o = exportBackup(db, NOW, '4w-001');
  o.data.people[0].name = '철수'.normalize('NFD'); o.data.payments[0].merchant = '을지로 곱창'.normalize('NFD');
  const r = importBackup(JSON.stringify(o));
  assert.ok(r.ok); assert.equal(r.db.people[0].name, '철수'); assert.equal(r.db.payments[0].merchant, '을지로 곱창');
  assert.equal(nameKey(r.db.people[0].name), nameKey('철수'.normalize('NFD')));
});
test('G3 거절: 깨진 글자, 다른 형식, 새 판 번호, 참조 깨짐, 번호 중복, 금액 범위 밖, 용량 초과, 배열 한도 초과', () => {
  const mk = (f) => { const o = exportBackup(richDb(), NOW, '4w-001'); f(o); return JSON.stringify(o); };
  const code = (t, cfg) => { const r = importBackup(t, cfg); assert.equal(r.ok, false); return r.code; };
  assert.equal(code('{깨진'), 'json');
  assert.equal(code(mk((o) => { o.format = 'other'; })), 'format');
  assert.equal(code(mk((o) => { o.data.app = 'x'; })), 'format');
  assert.equal(code(mk((o) => { o.data.v = 2; })), 'version');
  assert.equal(code(mk((o) => { o.data.entries[0].personId = 99999; })), 'ref');
  assert.equal(code(mk((o) => { o.data.people.push({ ...o.data.people[0] }); })), 'dup');
  assert.equal(code(mk((o) => { o.data.entries[0].share = 2e9; })), 'range');
  assert.equal(code(mk((o) => { o.data.entries[0].paid = o.data.entries[0].share + 1; })), 'paid');
  assert.equal(code(mk(() => {}), { ...CONFIG, MAX_IMPORT_BYTES: 100 }), 'size');
  assert.equal(code(mk(() => {}), { ...CONFIG, MAX_PEOPLE: 1 }), 'limit');
  assert.equal(code(mk((o) => { o.data.payments[0].at = '2026-02-30'; })), 'date');
});
test('G4 불러오기 실패 시 기존 데이터 한 글자도 안 바뀜', () => {
  const st = fakeStorage(); const store = createStore(st, { now: () => NOW, today: () => TODAY }); store.load();
  store.update((db) => { people(db, '철수'); });
  const mem = st.mem.get('mj.db'); const mine = JSON.stringify(store.db);
  const bad = JSON.stringify({ ...exportBackup(richDb(), NOW, 'x'), format: 'bad' });
  assert.equal(store.importReplace(bad).ok, false);
  assert.equal(st.mem.get('mj.db'), mem); assert.equal(JSON.stringify(store.db), mine);
  const good = exportText(richDb(), NOW, 'x');
  assert.ok(store.importReplace(good).ok);
  assert.equal(store.db.people.length, 2); assert.equal(st.mem.get('mj.db.prev'), mem);
  assert.ok(store.canUndo()); store.undo(); assert.equal(JSON.stringify(store.db), mine);
});
test('G5 모르는 항목은 버려짐; 이름에 <script>가 있어도 문자열로만 저장', () => {
  const o = exportBackup(richDb(), NOW, 'x');
  o.data.people[0].name = '<script>x</script>'; o.data.people[0].evil = 'zzz'; o.data.extra = { a: 1 }; o.data.entries[0].cardNo = '1234';
  const r = importBackup(JSON.stringify(o));
  assert.ok(r.ok); assert.equal(r.db.people[0].name, '<script>x</script>');
  assert.ok(!('evil' in r.db.people[0]) && !('extra' in r.db) && !('cardNo' in r.db.entries[0]));
  assert.ok(!JSON.stringify(r.db).includes('1234'));
});
test('G6 저장소 쓰기 실패 → 메모리 유지, 오류 알림, 예외 안 남', () => {
  const st = fakeStorage(); const errs = [];
  const store = createStore(st, { now: () => NOW, today: () => TODAY, onError: (c) => errs.push(c) }); store.load();
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  let ok;
  assert.doesNotThrow(() => { ok = store.update((db) => { people(db, '철수'); }); });
  assert.equal(ok, false); assert.equal(store.db.people.length, 1); assert.deepEqual(errs, ['save']);
});
test('G7 본 저장본이 깨지면 prev로 복구, 둘 다 깨지면 빈 데이터 + broken 보관', () => {
  const st = fakeStorage(); const good = JSON.stringify(richDb());
  st.mem.set('mj.db', '{깨짐'); st.mem.set('mj.db.prev', good);
  const s1 = createStore(st, { now: () => NOW, today: () => TODAY }); const r1 = s1.load();
  assert.equal(r1.notice, 'recovered'); assert.equal(s1.db.people.length, 2); assert.equal(st.mem.get('mj.db.broken'), '{깨짐');
  const st2 = fakeStorage(); st2.mem.set('mj.db', '또 깨짐'); st2.mem.set('mj.db.prev', '이것도');
  const s2 = createStore(st2, { now: () => NOW, today: () => TODAY }); const r2 = s2.load();
  assert.equal(r2.notice, 'fresh-broken'); assert.equal(s2.db.people.length, 0); assert.equal(st2.mem.get('mj.db.broken'), '또 깨짐');
  const st3 = fakeStorage(); st3.mem.set('mj.db', good);
  const s3 = createStore(st3, { now: () => NOW, today: () => TODAY }); s3.load();
  assert.equal(st3.mem.get('mj.db.prev'), good);
});
test('G8 migrate: v1 그대로 통과, 앱보다 높은 판은 거절', () => {
  const db = richDb();
  assert.equal(migrate(db).ok, true); assert.equal(migrate({ ...db, v: 2 }).ok, false); assert.equal(migrate({ ...db, v: 2 }).code, 'version');
  assert.equal(normalizeDb({ ...db, v: 9 }).code, 'version');
});
test('G9 백업 권유: 장부 있음 + 마지막 내보내기 7일 초과/없음 → 권유, 아니면 없음', () => {
  const db = mkDb(); const [a] = people(db, '철수');
  assert.equal(shouldNudge(db, NOW, TODAY), false);
  addEntry(db, { personId: a });
  assert.equal(shouldNudge(db, NOW, TODAY), true);
  db.settings.lastExportAt = NOW - 3 * 86400000; assert.equal(shouldNudge(db, NOW, TODAY), false);
  db.settings.lastExportAt = NOW - 8 * 86400000; assert.equal(shouldNudge(db, NOW, TODAY), true);
  db.settings.nudgeDay = TODAY; assert.equal(shouldNudge(db, NOW, TODAY), false);
  assert.equal(shouldNudge(db, NOW, addDays(TODAY, 1)), true);
});
test('G10 예시 지우기: 예시 표시만 삭제, 실제 기록이 참조하는 예시 사람·모임은 남기고 표시만 뗌', () => {
  const db = mkDb();
  const r0 = loadExample(db, TODAY, NOW);
  assert.ok(r0.people === 3 && db.groups.length === 1 && db.settings.exampleLoaded);
  assert.ok(db.payments.filter((p) => p.status === 'pending').length === 3);
  const real = people(db, '진짜친구')[0];
  const ex = db.people.find((p) => p.example);
  addEntry(db, { personId: ex.id, share: 7000, example: false, groupId: db.groups[0].id });
  addEntry(db, { personId: real, share: 1000 });
  const removed = clearExample(db);
  assert.ok(removed.entries >= 1);
  assert.ok(db.people.some((p) => p.id === ex.id && p.example === false));
  assert.equal(db.groups.length, 1); assert.equal(db.groups[0].example, false);
  assert.ok(db.people.some((p) => p.id === real));
  assert.ok(db.entries.every((e) => !e.example) && db.payments.every((p) => !p.example) && db.owes.every((o) => !o.example));
  assert.equal(db.people.filter((p) => p.example).length, 0);
  assert.equal(db.people.length, 2);
  assert.ok(normalizeDb(JSON.parse(JSON.stringify(db))).ok);
});
test('G11 서비스 워커 ASSETS가 실제 앱 파일을 모두 포함', () => {
  const root = new URL('../', import.meta.url);
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  const block = /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1];
  const listed = new Set([...block.matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/^\.\//, '')));
  const walk = (dir, out = []) => { for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) { const p = dir + e.name; if (e.isDirectory()) walk(p + '/', out); else if (!e.name.startsWith('.')) out.push(p); } return out; };
  const files = [...walk('css/'), ...walk('src/'), ...walk('lib/'), ...walk('icons/'), 'index.html', 'manifest.webmanifest'];
  const missing = files.filter((f) => !listed.has(f));
  assert.deepEqual(missing, []);
  assert.ok(/VERSION/.test(sw) && !/skipWaiting/.test(sw.replace(/\/\/.*$/gm, '')));
});
