import { CONFIG } from '../config.js';
import { splitAt, dayNum, fromDayNum, weekdayName } from './date.js';

const DATE_ONLY_MIN = 20 * 60;          // 날짜만 있는 결제는 정렬·묶음에서만 20:00으로 본다
function minutesOf(at) {
  const s = splitAt(at);
  return dayNum(s.day) * 1440 + (s.h == null ? DATE_ONLY_MIN : s.h * 60 + s.mi);
}
export const sortKeyOf = minutesOf;

export function baseDayOf(at, cfg = CONFIG) {
  return fromDayNum(Math.floor((minutesOf(at) - cfg.DAWN_CUT_HOUR * 60) / 1440));
}

// 밤 묶음: [{key, baseDay, items:[{payment, round}]}] (시각순, 묶음도 시각순)
export function groupNights(payments, cfg = CONFIG) {
  const list = payments.filter((p) => p.status !== 'dismissed')
    .map((p) => ({ p, m: minutesOf(p.at) }))
    .sort((a, b) => a.m - b.m || a.p.id - b.p.id);
  const groups = [];
  const seq = Object.create(null);
  let last = null, cur = null;
  for (const { p, m } of list) {
    const bd = baseDayOf(p.at, cfg);
    if (!cur || cur.baseDay !== bd || m - last > cfg.NIGHT_GAP_HOURS * 60) {
      seq[bd] = (seq[bd] || 0) + 1;
      cur = { key: `${bd}#${seq[bd]}`, baseDay: bd, items: [] };
      groups.push(cur);
    }
    cur.items.push({ payment: p, round: cur.items.length + 1 });
    last = m;
  }
  return groups;
}
export function nightOf(payments, id, cfg = CONFIG) {
  return groupNights(payments, cfg).find((g) => g.items.some((i) => i.payment.id === id)) || null;
}
export const nightKeyOf = (payments, id, cfg) => { const g = nightOf(payments, id, cfg); return g ? g.key : null; };
export const roundOf = (payments, id, cfg) => { const g = nightOf(payments, id, cfg); return g ? g.items.find((i) => i.payment.id === id).round : null; };

export function timeOfDay(h) {
  if (h < 6) return '새벽';
  if (h < 12) return '오전';
  if (h < 18) return '오후';
  if (h < 21) return '저녁';
  return '밤';
}
// "새벽 12시 반", "밤 10시", "밤 10시 10분". 시각이 없으면 빈 글자
export function clockText(at) {
  const s = splitAt(at);
  if (s.h == null) return '';
  const h12 = s.h % 12 === 0 ? 12 : s.h % 12;
  const tail = s.mi === 0 ? '' : s.mi === 30 ? ' 반' : ` ${s.mi}분`;
  return `${timeOfDay(s.h)} ${h12}시${tail}`;
}
export function isNightHour(h) { return h >= 18 || h < 6; }
export function nightTitle(g) {
  const first = g.items[0].payment.at;
  const s = splitAt(first);
  const w = weekdayName(g.baseDay);
  if (s.h == null) return w;
  return isNightHour(s.h) ? `${w} 밤` : `${w} 낮`;
}
