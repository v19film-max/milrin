import { CONFIG } from '../config.js';
import { COPY, SHORT, UI, fill } from '../copy.js';
import { merchantMatch } from './text.js';
import { splitAt, weekday, weekdayName, diffDays, monthOf, prevMonth } from './date.js';
import { baseDayOf, nightOf, clockText, timeOfDay, isNightHour } from './night.js';

const baseOf = (p) => p.baseDay || baseDayOf(p.at);
const confirmedIn = (db, gid, excludeId) => db.payments.filter((q) => q.status === 'confirmed' && q.groupId === gid && q.id !== excludeId);
const todOf = (p) => { const s = splitAt(p.at); return s.h == null ? null : timeOfDay(s.h); };

export function scoreGroups(db, p, cfg = CONFIG) {
  const W = cfg.GUESS_W;
  const pBase = baseOf(p);
  const night = nightOf(db.payments, p.id, cfg);
  const out = [];
  for (const g of db.groups) {
    if (p.rejectedGroupIds.includes(g.id)) continue;
    const H = confirmedIn(db, g.id, p.id);
    if (!H.length) continue;
    let score = 0;
    if (night && night.items.some((i) => i.payment.id !== p.id && i.payment.status === 'confirmed' && i.payment.groupId === g.id)) score += W.chain;
    if (p.merchant && H.some((q) => q.merchant && merchantMatch(q.merchant, p.merchant))) score += W.merchant;
    const nights = [...new Set(H.map(baseOf))];
    score += W.weekday * (nights.filter((d) => weekday(d) === weekday(pBase)).length / nights.length);
    const tod = todOf(p);
    if (tod) score += W.tod * (H.filter((q) => todOf(q) === tod).length / H.length);
    const amts = H.map((q) => q.amount).filter((a) => a != null).sort((a, b) => a - b);
    if (p.amount != null && amts.length) {
      const mid = amts.length % 2 ? amts[(amts.length - 1) / 2] : (amts[amts.length / 2 - 1] + amts[amts.length / 2]) / 2;
      if (Math.abs(p.amount - mid) <= mid * 0.3) score += W.amount;
    }
    const prior = nights.filter((d) => diffDays(pBase, d) >= 0).sort();
    if (prior.length && diffDays(pBase, prior[prior.length - 1]) <= cfg.GUESS_RECENT_DAYS) score += W.recent;
    out.push({ groupId: g.id, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function guessGroup(db, p, cfg = CONFIG) {
  const s = scoreGroups(db, p, cfg);
  if (!s.length) return null;
  if (s[0].score < cfg.GUESS_MIN - 1e-9) return null;
  if (s.length > 1 && s[0].score - s[1].score < cfg.GUESS_GAP - 1e-9) return null;
  return s[0];
}

const peopleOrder = (db, ids) => db.people.filter((x) => ids.includes(x.id)).map((x) => x.id);
const present = (p) => [...p.attendeeIds, ...(p.payerId != null ? [p.payerId] : [])];

// 지난 확정 밤의 참석자 중 지금 멤버. 없으면 모임 멤버 전원
export function guessAttendees(db, gid) {
  const g = db.groups.find((x) => x.id === gid);
  if (!g) return [];
  const H = confirmedIn(db, gid);
  if (H.length) {
    const last = H.map(baseOf).sort().pop();
    const ids = new Set(H.filter((q) => baseOf(q) === last).flatMap(present));
    const r = g.memberIds.filter((m) => ids.has(m));
    if (r.length) return r;
  }
  return g.memberIds.slice();
}

export function frameOf(db, p, cfg = CONFIG) {
  return p.kind === 'gap' ? gapFrame(db, p, cfg) : cardFrame(db, p, cfg);
}

function cardFrame(db, p, cfg) {
  const gs = guessGroup(db, p, cfg);
  const gid = gs ? gs.groupId : null;
  const g = gid != null ? db.groups.find((x) => x.id === gid) : null;
  const s = splitAt(p.at);
  const w = weekdayName(baseOf(p));
  const what = p.merchant || UI.thisPay;
  let frame, vars, attendeeIds = gid != null ? guessAttendees(db, gid) : [];
  if (g) {
    const night = nightOf(db.payments, p.id, cfg);
    const mates = night ? night.items.map((i) => i.payment).filter((q) => q.id !== p.id && q.status === 'confirmed' && q.groupId === gid) : [];
    const ids = peopleOrder(db, [...new Set(mates.flatMap(present))]);
    if (mates.length && ids.length) {
      frame = 'C3'; vars = { 이름: db.people.find((x) => x.id === ids[0]).name };
      const att = g.memberIds.filter((m) => ids.includes(m));
      if (att.length) attendeeIds = att;
    } else { frame = 'C1'; vars = { 모임: g.name }; }
  } else if (p.merchant && s.h != null && isNightHour(s.h)) { frame = 'C2'; vars = { 요일: w, 무엇: what }; }
  else { frame = 'C4'; vars = { 무엇: what }; }
  return { frame, groupId: gid, attendeeIds, vars, text: fill(COPY[frame], vars) };
}

function gapFrame(db, p, cfg) {
  const night = nightOf(db.payments, p.id, cfg);
  const round = night ? night.items.find((i) => i.payment.id === p.id).round : 1;
  const clock = clockText(p.at);
  const m = (p.merchant || '').toLowerCase();
  const taxi = cfg.TAXI_WORDS.some((x) => m.includes(x));
  let frame, lines;
  if (clock && taxi) { frame = 'B3'; lines = [COPY.B3]; }
  else if (clock) { frame = 'B1'; lines = COPY.B1.map((t) => fill(t, { 시각: clock, 차수: round })); }
  else {
    const gaps = night ? night.items.filter((i) => i.payment.kind === 'gap').length : 1;
    if (gaps <= 1) { frame = 'B4'; lines = [COPY.B4]; } else { frame = 'B2'; lines = [fill(COPY.B2, { 차수: round })]; }
  }
  // 같은 밤의 다른 결제(확정 우선)의 모임
  let gid = null;
  if (night) {
    const others = night.items.map((i) => i.payment).filter((q) => q.id !== p.id && q.groupId != null);
    const pick = others.find((q) => q.status === 'confirmed') || others[0];
    if (pick) gid = pick.groupId;
  }
  return { frame, groupId: gid, attendeeIds: gid != null ? guessAttendees(db, gid) : [], lines, text: lines.join(' '), vars: { 차수: round } };
}

// 근거 한 줄. 앱이 실제로 아는 정보일 때만. 없으면 null
export function reasonLine(db, p, gid, cfg = CONFIG) {
  const s = splitAt(p.at);
  const w = weekdayName(baseOf(p));
  const clock = clockText(p.at);
  let t = null;
  if (s.h != null) {
    t = p.source === 'import' ? { full: fill(COPY.E4, { 시각: clock }), short: null }
      : { full: fill(COPY.E1, { 요일: w, 시각: clock }), short: fill(SHORT.E1, { 요일: w, 시각: clock }) };
  }
  let m = null;
  if (gid != null) {
    const H = confirmedIn(db, gid, p.id);
    const pb = baseOf(p);
    if (H.some((q) => monthOf(baseOf(q)) === prevMonth(pb))) m = { full: COPY.E2, short: SHORT.E2 };
    else {
      const past = H.filter((q) => diffDays(pb, baseOf(q)) > 0);
      if (past.length) {
        const tally = new Map();
        for (const q of past) for (const id of q.attendeeIds) tally.set(id, (tally.get(id) || 0) + 1);
        let best = null;
        for (const x of db.people) if (tally.has(x.id) && (!best || tally.get(x.id) > tally.get(best.id))) best = x;
        if (best) m = { full: fill(COPY.E5, { 이름: best.name }), short: fill(SHORT.E5, { 이름: best.name }) };
      }
    }
  }
  if (t && m && t.short) {
    const j = `${t.short} · ${m.short}`;
    return Array.from(j).length <= cfg.REASON_MAX_CHARS ? j : t.full;
  }
  if (t) return t.full;
  if (m) return m.full;
  return null;
}
