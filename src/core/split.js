import '../../lib/tool-calc.js';
import { CONFIG } from '../config.js';
const { calc, fmt, normAmt, clip } = globalThis.SPLIT;
export { fmt as fmtWon, normAmt as normAmount, clip as clipChars };

// 내가 낸 결제: 참석자(나 제외) 각자의 몫. 나머지 원은 0번(결제자=나)이 흡수한다.
export function splitMine(amount, attendeeIds, cfg = CONFIG) {
  const ids = [...new Set(attendeeIds)];
  if (!ids.length || ids.length + 1 > 30) return { ok: false, code: 'people' };
  const ME = 'me';
  const people = [{ id: ME, name: 'me' }, ...ids.map((id) => ({ id: 'p' + id, name: 'p' + id }))];
  const r = calc({ people, items: [{ amount, payer: ME, parts: people.map((p) => p.id) }], unit: cfg.SETTLE_UNIT });
  if (!r.ok) return { ok: false, code: r.code };
  const shares = {};
  ids.forEach((id, k) => { shares[id] = -r.rows[k + 1].final; });
  if (Object.values(shares).some((v) => !(v >= 1))) return { ok: false, code: 'small' };
  return { ok: true, shares, mine: amount - Object.values(shares).reduce((a, b) => a + b, 0) };
}

// 남이 낸 결제: 결제자를 0번에 두고 내 몫(줄 돈일 수도)을 계산한다.
export function splitOther(amount, payerId, attendeeIds, cfg = CONFIG) {
  const ids = [...new Set(attendeeIds.filter((id) => id !== payerId))];
  if (ids.length + 2 > 30) return { ok: false, code: 'people' };
  const people = [{ id: 'payer', name: 'payer' }, { id: 'me', name: 'me' }, ...ids.map((id) => ({ id: 'p' + id, name: 'p' + id }))];
  const r = calc({ people, items: [{ amount, payer: 'payer', parts: people.map((p) => p.id) }], unit: cfg.SETTLE_UNIT });
  if (!r.ok) return { ok: false, code: r.code };
  const myShare = -r.rows[1].final;
  if (!(myShare >= 1)) return { ok: false, code: 'small' };
  return { ok: true, myShare };
}
