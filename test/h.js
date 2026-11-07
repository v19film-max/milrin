// 시험 도우미(시험 파일이 아님: 이름 규칙 때문에 test 폴더 안 h.js)
import { newDb, addPerson, addGroup } from '../src/core/db.js';
export const TODAY = '2026-11-07';           // 토요일
export const NOW = new Date(2026, 10, 7, 12, 0).getTime();
export function mkDb() { return newDb(NOW, TODAY); }
export function addPay(db, o) {
  const id = db.nextId++;
  db.payments.push(Object.assign({ id, kind: 'card', at: '2026-10-10T22:10', merchant: '', amount: 84000, source: 'manual',
    status: 'pending', laterDay: null, rejectedGroupIds: [], groupId: null, attendeeIds: [], payerId: null, baseDay: null, example: false }, o));
  return id;
}
export function addEntry(db, o) {
  const id = db.nextId++;
  db.entries.push(Object.assign({ id, personId: 0, paymentId: null, groupId: null, merchant: '', round: null, share: 10000, total: null,
    baseDay: '2026-10-17', createdAt: NOW, route: 'manual', priorAsk: false, askCount: 0, firstAskAt: null, lastAskAt: null, lastAskDay: null,
    paid: 0, paidAt: null, hidden: false, example: false }, o));
  return id;
}
export function people(db, ...names) { return names.map((n) => addPerson(db, n)); }
export { addPerson, addGroup };
