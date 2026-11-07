import { CONFIG } from '../config.js';
import { cleanText, clipText } from './text.js';
import { isValidAt } from './date.js';

// 4주판에는 구현체 없음. 구현체 모양:
// { id, label, accepts(fileMeta)->bool, parse(arrayBuffer)->{ ok, payments:[{at, merchant, amount}], warnings:[] } }
export const importers = [];

// 직접 입력·붙여넣기·가져오기 모두 이 입구 하나. 허용 항목(at·merchant·amount·kind)만 저장한다.
export function addPayments(db, list, source, now, opts = {}, cfg = CONFIG) {
  const added = [], rejected = [];
  list.forEach((it, index) => {
    const kind = it && it.kind === 'gap' ? 'gap' : 'card';
    const amountOk = Number.isInteger(it && it.amount) && it.amount >= 1 && it.amount <= cfg.MAX_AMOUNT;
    if (!it || !isValidAt(it.at)) return rejected.push({ index, code: 'at' });
    if (!amountOk && !(kind === 'gap' && (it.amount == null))) return rejected.push({ index, code: 'amount' });
    if (db.payments.length >= cfg.MAX_PAYMENTS) return rejected.push({ index, code: 'limit' });
    const id = db.nextId++;
    db.payments.push({
      id, kind, at: it.at, merchant: clipText(cleanText(it.merchant || ''), cfg.MAX_MERCHANT).trim(),
      amount: amountOk ? it.amount : null, source: ['manual', 'paste', 'import'].includes(source) ? source : 'manual',
      status: 'pending', laterDay: null, rejectedGroupIds: [], groupId: null, attendeeIds: [], payerId: null, baseDay: null,
      example: !!opts.example,
    });
    added.push(id);
  });
  return { added, rejected };
}

// 못 받은 돈 옮기기: 이름 + 1인 몫(금액)으로 장부 건을 바로 만든다(추측 카드를 거치지 않음)
// items: [{personId?, name, amount, merchant, day, priorAsk}]
export function addMovedEntries(db, items, now, cfg = CONFIG) {
  let entries = 0, newPeople = 0;
  for (const it of items) {
    if (!Number.isInteger(it.amount) || it.amount < 1 || it.amount > cfg.MAX_AMOUNT) continue;
    if (db.entries.length >= cfg.MAX_ENTRIES) break;
    let pid = it.personId;
    if (pid == null) {
      const nm = cleanText(it.name || '');
      if (!nm || db.people.length >= cfg.MAX_PEOPLE) continue;
      pid = db.nextId++;
      db.people.push({ id: pid, name: clipText(nm, cfg.MAX_NAME).trim(), passUntil: null, example: false });
      newPeople++;
    }
    db.entries.push({
      id: db.nextId++, personId: pid, paymentId: null, groupId: null, merchant: clipText(cleanText(it.merchant || ''), cfg.MAX_MERCHANT).trim(),
      round: null, share: it.amount, total: null, baseDay: it.day, createdAt: now, route: 'moved', priorAsk: it.priorAsk !== false,
      askCount: 0, firstAskAt: null, lastAskAt: null, lastAskDay: null, paid: 0, paidAt: null, hidden: false, example: false,
    });
    entries++;
  }
  return { entries, newPeople };
}
