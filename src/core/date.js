// 날짜 문자열("YYYY-MM-DD") 달력 계산. 시간대에 영향받지 않게 Date.UTC만 쓴다.
export const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AT_RE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/;

export function isValidDay(s) {
  const m = typeof s === 'string' && DAY_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}
export function isValidAt(s) {
  const m = typeof s === 'string' && AT_RE.exec(s);
  if (!m || !isValidDay(m[1])) return false;
  return m[2] == null || (+m[2] <= 23 && +m[3] <= 59);
}
export function dayNum(s) {
  const m = DAY_RE.exec(s);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
}
export function fromDayNum(n) {
  const t = new Date(n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
export const diffDays = (a, b) => Math.round(dayNum(a) - dayNum(b));
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
export const weekday = (s) => new Date(dayNum(s) * 86400000).getUTCDay();
export const weekdayName = (s) => WEEKDAYS[weekday(s)];
export function splitAt(at) {
  const m = AT_RE.exec(at);
  return { day: m[1], time: m[2] == null ? null : `${m[2]}:${m[3]}`, h: m[2] == null ? null : +m[2], mi: m[2] == null ? null : +m[3] };
}
// 폰 현지 시각 기준 오늘 문자열과 밀리초→날짜
export function dayOfMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayStr = (date = new Date()) => dayOfMs(date.getTime());
export function monthOf(day) { return day.slice(0, 7); }
export function prevMonth(day) {
  const y = +day.slice(0, 4), m = +day.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
export function mdLabel(day) { return `${+day.slice(5, 7)}/${+day.slice(8, 10)}`; }
