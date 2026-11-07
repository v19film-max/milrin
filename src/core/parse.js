import '../../lib/tool-calc.js';
import { CONFIG } from '../config.js';
import { cleanText, nfc, clipText, merchantKey } from './text.js';
import { isValidDay, addDays, diffDays } from './date.js';
const { normAmt } = globalThis.SPLIT;

const ZERO_WIDTH = /[​-‍⁠﻿]/g;
const p2 = (n) => String(n).padStart(2, '0');

// 금액 한 토큰 읽기: 정수 | NaN(소수점·마이너스·범위 밖: 조용히 다른 값으로 읽지 않음) | null(금액이 아님)
export function parseMoney(raw, cfg = CONFIG) {
  const t = normAmt(String(raw)).replace(/\s/g, '');
  if (!t) return null;
  const ok = (v) => (Number.isFinite(v) && Number.isInteger(v) && v >= 1 && v <= cfg.MAX_AMOUNT ? v : NaN);
  if (/^-\d/.test(t)) return NaN;
  if (/^\d{1,3}(,\d{3})+원?$/.test(t)) return ok(Number(t.replace(/[,원]/g, '')));
  const m = /^(?:(\d+(?:\.\d{1,4})?)만)?(?:(\d+)천)?(?:(\d+)백)?원?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) {
    return ok(Math.round(Number(m[1] || 0) * 10000 + Number(m[2] || 0) * 1000 + Number(m[3] || 0) * 100));
  }
  if (/^\d+원$/.test(t)) return ok(Number(t.slice(0, -1)));
  if (/^\d{3,}$/.test(t)) return ok(t.length < 16 ? Number(t) : NaN);
  if (/^\d+\.\d+원?$/.test(t)) return NaN;
  return null;
}

function mkTime(ap, h, mi) {
  if (mi > 59) return null;
  if (ap === '오전') { if (h < 1 || h > 12) return null; h = h === 12 ? 0 : h; }
  else if (ap === '오후') { if (h < 1 || h > 12) return null; h = h === 12 ? 12 : h + 12; }
  else if (h > 23) return null;
  return `${p2(h)}:${p2(mi)}`;
}

function resolveDay(mo, d, today) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;   // 날짜가 아니라 다른 글자
  let y = +today.slice(0, 4);
  for (let k = 0; k < 8; k++, y--) {
    const c = `${y}-${p2(mo)}-${p2(d)}`;
    if (isValidDay(c) && diffDays(c, today) <= 0) return c;
    if (k === 0 && !isValidDay(c) && mo === 2 && d === 30) return null;
  }
  return null;                                                  // 2/30 같은 달력에 없는 날
}

function scan(raw, today, cfg) {
  let s = nfc(normAmt(raw)).replace(ZERO_WIDTH, '');
  const bad = [], warnings = [];
  let time = null, day = null, timeSeen = false, daySeen = false;

  s = s.replace(/(?<![\d])(오전|오후)?\s*(\d{1,2})\s*:\s*(\d{2})(?!\d)/, (m, ap, h, mi) => {
    timeSeen = true; time = mkTime(ap, +h, +mi); return ' ';
  });
  if (!timeSeen) {
    s = s.replace(/(?<![\d])(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/, (m, ap, h, mi) => {
      timeSeen = true; time = mkTime(ap, +h, mi == null ? 0 : +mi); return ' ';
    });
  }
  if (timeSeen && time == null) bad.push('time');

  const setYmd = (y, mo, d) => {
    daySeen = true;
    const c = `${y}-${p2(mo)}-${p2(d)}`;
    if (isValidDay(c)) day = c; else bad.push('date');
    return ' ';
  };
  const setMd = (mo, d, m) => {
    const r = resolveDay(mo, d, today);
    if (r === undefined) return m;
    daySeen = true;
    if (r === null) bad.push('date'); else day = r;
    return ' ';
  };
  s = s.replace(/(?<![\d.\-/])(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/, (m, y, mo, d) => setYmd(y, +mo, +d));
  if (!daySeen) s = s.replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/, (m, mo, d) => setMd(+mo, +d, m));
  if (!daySeen) {
    s = s.replace(/(오늘|어제|그저께|그제)/, (m, w) => {
      daySeen = true; day = addDays(today, w === '오늘' ? 0 : w === '어제' ? -1 : -2); return ' ';
    });
  }
  if (!daySeen) {
    s = s.replace(/(?<![\d.,:/\-])(\d{1,2})[/.\-](\d{1,2})(?![\d.,:/\-]|\s*[만천백원])/, (m, mo, d) => setMd(+mo, +d, m));
  }
  if (!daySeen) day = today;

  const tokens = s.replace(/(?<!\d),|,(?!\d)/g, ' ').split(/\s+/).filter(Boolean);
  const amounts = [], rest = [];
  let badAmt = false;
  for (const t of tokens) {
    const v = parseMoney(t, cfg);
    if (v === null) rest.push(t);
    else if (Number.isNaN(v)) badAmt = true;
    else amounts.push(v);
  }
  if (amounts.length > 1) warnings.push('multiAmount');
  if (badAmt || !amounts.length) bad.push('amount');
  return { day: bad.includes('date') ? null : day, time: bad.includes('time') ? null : time, amount: amounts.length ? amounts[amounts.length - 1] : null, rest, bad, warnings };
}

function prepLine(raw, cfg) {
  const t = clipText(String(raw), cfg.MAX_LINE);
  return t;
}

export function parsePayLine(raw, today, cfg = CONFIG, lineNo = 1) {
  const line = prepLine(raw, cfg);
  const r = scan(line, today, cfg);
  const merchant = clipText(cleanText(r.rest.join(' ')), cfg.MAX_MERCHANT).trim();
  const at = r.day ? (r.time ? `${r.day}T${r.time}` : r.day) : null;
  return { ok: r.bad.length === 0, line: lineNo, raw: String(raw), values: { at, merchant, amount: r.amount }, warnings: r.warnings, bad: r.bad, dup: false };
}

export function parseMoveLine(raw, today, cfg = CONFIG, lineNo = 1) {
  const line = prepLine(raw, cfg);
  const r = scan(line, today, cfg);
  const bad = r.bad.filter((b) => b !== 'time');
  const k = r.rest.findIndex((t) => !/^\d+$/.test(t));
  let name = '', merchant = '';
  if (k < 0) bad.push('name');
  else {
    name = clipText(cleanText(r.rest[k]), cfg.MAX_NAME).trim();
    merchant = clipText(cleanText(r.rest.filter((_, i) => i !== k).join(' ')), cfg.MAX_MERCHANT).trim();
  }
  return { ok: bad.length === 0, line: lineNo, raw: String(raw), values: { name, amount: r.amount, merchant, day: r.day }, warnings: r.warnings, bad, existing: null };
}

function parseMany(text, fn, today, cfg) {
  const src = String(text).split(/\r?\n/);
  const lines = [], warnings = [];
  for (let i = 0; i < src.length; i++) {
    if (!src[i].trim()) continue;
    if (lines.length >= cfg.MAX_PASTE_LINES) { warnings.push('limit'); break; }
    if (Array.from(src[i]).length > cfg.MAX_LINE && !warnings.includes('longLine')) warnings.push('longLine');
    lines.push(fn(src[i], today, cfg, i + 1));
  }
  return { lines, warnings };
}
export const parsePayLines = (text, today, cfg = CONFIG) => parseMany(text, parsePayLine, today, cfg);
export const parseMoveLines = (text, today, cfg = CONFIG) => parseMany(text, parseMoveLine, today, cfg);

export function markDuplicates(lines, payments) {
  for (const l of lines) {
    const v = l.values;
    l.dup = !!(l.ok && payments.some((p) => p.status !== 'dismissed' && p.at === v.at && p.amount === v.amount && merchantKey(p.merchant) === merchantKey(v.merchant)));
  }
  return lines;
}
