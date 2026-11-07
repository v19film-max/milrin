import { CONFIG } from '../config.js';
import { splitMine, splitOther } from './split.js';
import { baseDayOf, nightOf, sortKeyOf } from './night.js';
import { frameOf } from './guess.js';
import { logAction } from './actions.js';
import { cleanText, clipText } from './text.js';

const find = (db, id) => db.payments.find((p) => p.id === id);
const bump = (db, p, k) => { if (!p.example) db.log.swipes[k] += 1; };

// 오늘 큐: pending 중 laterDay가 오늘이 아닌 것. 최근 밤 먼저, 같은 밤은 시각순
export function todayQueue(db, today) {
  return db.payments.filter((p) => p.status === 'pending' && p.laterDay !== today)
    .map((p) => ({ p, b: baseDayOf(p.at), k: sortKeyOf(p.at) }))
    .sort((x, y) => (x.b < y.b ? 1 : x.b > y.b ? -1 : x.k - y.k || x.p.id - y.p.id)).map((x) => x.p);
}
export const laterCards = (db, today) => db.payments.filter((p) => p.status === 'pending' && p.laterDay === today);

export function swipeLater(db, id, today) {
  const p = find(db, id); if (!p) return;
  p.laterDay = today; bump(db, p, 'later');
  if (!p.example) logAction(db, today);
}
// 아니야: 센 다음 카드는 뒤집혀 고치기 화면이 열린다. 추측했던 모임은 다음 추측에서 뺀다
export function rejectCard(db, id, guessedGroupId, today) {
  const p = find(db, id); if (!p) return;
  bump(db, p, 'no');
  if (guessedGroupId != null && !p.rejectedGroupIds.includes(guessedGroupId)) p.rejectedGroupIds.push(guessedGroupId);
  if (!p.example && today) logAction(db, today);
}
export function dismissCard(db, id, today) {
  const p = find(db, id); if (!p) return;
  p.status = 'dismissed';
  if (!p.example && today) logAction(db, today);
}
export function gapToCard(db, id, amount, cfg = CONFIG) {
  const p = find(db, id);
  if (!p || !Number.isInteger(amount) || amount < 1 || amount > cfg.MAX_AMOUNT) return { ok: false, code: 'amount' };
  p.kind = 'card'; p.amount = amount; p.payerId = null;
  return { ok: true };
}

// 고치기 화면에서 저장하거나 맞아로 넘길 때 확정한다
export function confirmCard(db, id, opts, today, now, cfg = CONFIG) {
  const p = find(db, id);
  if (!p || p.status !== 'pending') return { ok: false, code: 'state' };
  const amount = opts.amount !== undefined ? opts.amount : p.amount;
  const merchant = opts.merchant !== undefined ? clipText(cleanText(opts.merchant), cfg.MAX_MERCHANT).trim() : p.merchant;
  const att = [...new Set(opts.attendeeIds || [])];
  const baseDay = baseDayOf(p.at, cfg);
  let toast;
  if (p.kind === 'card') {
    if (!Number.isInteger(amount) || amount < 1 || amount > cfg.MAX_AMOUNT) return { ok: false, code: 'amount' };
    if (!att.length) return { ok: false, code: 'attendees' };
    const s = splitMine(amount, att, cfg);
    if (!s.ok) return { ok: false, code: 'share' };
    const night = nightOf(db.payments, p.id, cfg);
    const round = night ? night.items.find((i) => i.payment.id === p.id).round : null;
    for (const pid of att) {
      if (db.entries.length >= cfg.MAX_ENTRIES) return { ok: false, code: 'limit' };
      db.entries.push({
        id: db.nextId++, personId: pid, paymentId: p.id, groupId: opts.groupId ?? null, merchant, round, share: s.shares[pid], total: amount,
        baseDay, createdAt: now, route: 'card', priorAsk: false, askCount: 0, firstAskAt: null, lastAskAt: null, lastAskDay: null,
        paid: 0, paidAt: null, hidden: false, example: p.example,
      });
    }
  } else {
    if (opts.payerId == null) return { ok: false, code: 'payer' };
    if (amount != null && (!Number.isInteger(amount) || amount < 1 || amount > cfg.MAX_AMOUNT)) return { ok: false, code: 'amount' };
    if (amount != null && att.length) {
      const s = splitOther(amount, opts.payerId, att, cfg);
      if (!s.ok) return { ok: false, code: 'share' };
      db.owes.push({ id: db.nextId++, paymentId: p.id, personId: opts.payerId, share: s.myShare, merchant, baseDay, groupId: opts.groupId ?? null, state: 'open', example: p.example });
      toast = 'Z1';
    }
    p.payerId = opts.payerId;
  }
  p.status = 'confirmed'; p.amount = amount ?? null; p.merchant = merchant;
  p.groupId = opts.groupId ?? null; p.attendeeIds = att; p.baseDay = baseDay;
  bump(db, p, 'yes'); if (opts.fixed) bump(db, p, 'fix');
  if (!p.example) logAction(db, today);
  return toast ? { ok: true, toast } : { ok: true };
}

// 오른쪽으로 넘김: 추측 모임과 참석자가 있는 내 결제만 바로 확정한다. 아니면 뒷면을 연다
export function rightSwipe(db, id, today, now, cfg = CONFIG) {
  const p = find(db, id);
  if (!p) return { ok: false, flip: false };
  if (p.kind === 'gap') return { ok: false, flip: true };
  const f = frameOf(db, p, cfg);
  if (f.groupId == null || !f.attendeeIds.length) return { ok: false, flip: true };
  const r = confirmCard(db, id, { groupId: f.groupId, attendeeIds: f.attendeeIds }, today, now, cfg);
  return r.ok ? { ...r, frame: f.frame } : { ...r, flip: true };
}
