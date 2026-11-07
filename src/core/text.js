import '../../lib/tool-calc.js';
const { clip } = globalThis.SPLIT;

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

export function nfc(s) { return String(s == null ? '' : s).normalize('NFC'); }

// 조합형으로 맞추고, 제로폭 글자를 지우고, 공백을 하나로 줄이고, 앞뒤를 다듬는다.
export function cleanText(s) {
  return nfc(s).replace(ZERO_WIDTH, '').replace(/[\s ]+/g, ' ').trim();
}

export function nameKey(s) { return cleanText(s).toLowerCase(); }

// 사용자가 보는 글자 기준으로 n자까지(잘린 게 없으면 그대로)
export function clipText(s, n) {
  const c = clip(String(s), n);
  return c == null ? String(s) : c;
}

export function merchantKey(s) {
  return cleanText(s).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function merchantMatch(a, b) {
  const x = merchantKey(a), y = merchantKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return Array.from(short).length >= 3 && long.includes(short);
}

// 이름 끝 글자 받침 판정: 받침 있음 → '아', 없음 → '야', 한글이 아니면 '~'
export function ahYa(name) {
  const t = cleanText(name);
  const ch = Array.from(t).pop();
  if (!ch) return '~';
  const c = ch.charCodeAt(0);
  if (c < 0xAC00 || c > 0xD7A3) return '~';
  return (c - 0xAC00) % 28 === 0 ? '야' : '아';
}

export function findByName(people, name) {
  const k = nameKey(name);
  return people.filter((p) => nameKey(p.name) === k);
}

export function cleanName(s, max = 20) { return clipText(cleanText(s), max).trim(); }
