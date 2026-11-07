import { CONFIG } from '../config.js';
import { DB_VERSION } from '../version.js';
import { cleanText, cleanName, clipText } from './text.js';
import { isValidDay } from './date.js';

export const APP_ID = 'mil-jeongsan';

export function newDb(now, today) {
  return {
    app: APP_ID, v: DB_VERSION, nextId: 100, createdAt: now,
    settings: {
      reduceMotion: 'auto', lastExportAt: null, experimentStart: today, testerCode: '', exampleLoaded: false,
      hint: { welcomeDone: false, t4Done: false, r1Seen: false, exampleTip: false },
      showToday: null, lastPick: { H: null, D: null }, nudgeDay: null,
    },
    people: [], groups: [], payments: [], entries: [], owes: [],
    log: { swipes: { yes: 0, no: 0, later: 0, fix: 0 }, copies: [], shows: [], openDays: [], actionDays: [] },
  };
}

export function addPerson(db, name, opts = {}) {
  const id = db.nextId++;
  db.people.push({ id, name: cleanName(name, opts.max || CONFIG.MAX_NAME), passUntil: null, example: !!opts.example });
  return id;
}
export function addGroup(db, name, memberIds = [], opts = {}) {
  const id = db.nextId++;
  db.groups.push({ id, name: cleanName(name, CONFIG.MAX_NAME), memberIds: [...new Set(memberIds)], example: !!opts.example });
  return id;
}

// 이전 판을 한 단계씩 올린다. 지금은 1판뿐이라 구조만 있다.
export function migrate(obj) {
  if (!obj || typeof obj !== 'object' || !Number.isInteger(obj.v) || obj.v < 1) return { ok: false, code: 'format' };
  if (obj.v > DB_VERSION) return { ok: false, code: 'version' };
  let cur = obj;
  // while (cur.v < DB_VERSION) { cur = MIGRATIONS[cur.v](cur); }
  return { ok: true, obj: cur };
}

class Reject extends Error { constructor(code) { super(code); this.code = code; } }
const fail = (c) => { throw new Reject(c); };
const BIG = Number.MAX_SAFE_INTEGER;
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const T = {
  int: (min = 0, max = BIG) => (v) => (Number.isInteger(v) && v >= min && v <= max ? v : fail('range')),
  nint: (min = 0, max = BIG) => (v) => (v == null ? null : Number.isInteger(v) && v >= min && v <= max ? v : fail('range')),
  bool: (v) => (typeof v === 'boolean' ? v : fail('type')),
  day: (v) => (isValidDay(v) ? v : fail('date')),
  nday: (v) => (v == null ? null : isValidDay(v) ? v : fail('date')),
  str: (max) => (v) => { if (typeof v !== 'string') fail('type'); const c = cleanText(v); if (Array.from(c).length > max) fail('length'); return c; },
  oneOf: (list) => (v) => (list.includes(v) ? v : fail('type')),
};

function pick(o, spec, def = {}) {
  if (!isObj(o)) fail('type');
  const out = {};
  for (const k of Object.keys(spec)) {
    const v = o[k] === undefined && k in def ? def[k] : o[k];
    out[k] = spec[k](v);
  }
  return out;
}
function arr(a, max) {
  if (!Array.isArray(a)) fail('type');
  if (a.length > max) fail('limit');
  return a;
}
function ids(list) {
  const s = new Set();
  for (const x of list) { if (s.has(x.id)) fail('dup'); s.add(x.id); }
  return s;
}
const idList = (set) => (a) => { if (!Array.isArray(a)) fail('type'); const u = [...new Set(a)]; for (const x of u) if (!set.has(x)) fail('ref'); return u; };
const nref = (set) => (v) => (v == null ? null : set.has(v) ? v : fail('ref'));
const ref = (set) => (v) => (set.has(v) ? v : fail('ref'));

// 저장본·가져온 파일 공통 검사. 통과하면 "모르는 항목을 버린" 새 객체를 돌려준다.
export function normalizeDb(raw, cfg = CONFIG) {
  try {
    if (!isObj(raw)) fail('format');
    if (raw.app !== APP_ID) fail('format');
    const mg = migrate(raw);
    if (!mg.ok) return { ok: false, code: mg.code };
    const o = mg.obj;
    const db = { app: APP_ID, v: DB_VERSION };
    db.nextId = T.int(1)(o.nextId);
    db.createdAt = T.int(0)(o.createdAt);

    const s = isObj(o.settings) ? o.settings : fail('type');
    const h = isObj(s.hint) ? s.hint : {};
    const st = isObj(s.showToday) ? s.showToday : null;
    const lp = isObj(s.lastPick) ? s.lastPick : {};
    const pickId = (v) => (typeof v === 'string' && /^[HD]\d{1,2}$/.test(v) ? v : null);
    const tc = typeof s.testerCode === 'string' ? cleanText(s.testerCode) : '';
    db.settings = {
      reduceMotion: T.oneOf(['auto', 'on'])(s.reduceMotion === undefined ? 'auto' : s.reduceMotion),
      lastExportAt: T.nint(0)(s.lastExportAt === undefined ? null : s.lastExportAt),
      experimentStart: T.day(s.experimentStart),
      testerCode: /^[A-Za-z0-9]{0,6}$/.test(tc) ? tc : '',
      exampleLoaded: s.exampleLoaded === true,
      hint: { welcomeDone: h.welcomeDone === true, t4Done: h.t4Done === true, r1Seen: h.r1Seen === true, exampleTip: h.exampleTip === true },
      showToday: st && isValidDay(st.day) && Number.isInteger(st.personId) ? { day: st.day, personId: st.personId } : null,
      lastPick: { H: pickId(lp.H), D: pickId(lp.D) },
      nudgeDay: isValidDay(s.nudgeDay) ? s.nudgeDay : null,
    };

    db.people = arr(o.people, cfg.MAX_PEOPLE).map((p) => {
      const r = pick(p, { id: T.int(0), name: T.str(cfg.MAX_NAME), passUntil: T.nday, example: T.bool }, { passUntil: null, example: false });
      if (!r.name) fail('range');
      return r;
    });
    const pset = ids(db.people);
    db.groups = arr(o.groups, cfg.MAX_GROUPS).map((g) => {
      const r = pick(g, { id: T.int(0), name: T.str(cfg.MAX_NAME), memberIds: idList(pset), example: T.bool }, { example: false });
      if (!r.name) fail('range');
      return r;
    });
    const gset = ids(db.groups);
    const money = T.int(1, cfg.MAX_AMOUNT);
    db.payments = arr(o.payments, cfg.MAX_PAYMENTS).map((p) => {
      const r = pick(p, {
        id: T.int(0), kind: T.oneOf(['card', 'gap']),
        at: (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v) && isValidDay(v.slice(0, 10)) && (v.length === 10 || (+v.slice(11, 13) <= 23 && +v.slice(14, 16) <= 59)) ? v : fail('date')),
        merchant: T.str(cfg.MAX_MERCHANT), amount: T.nint(1, cfg.MAX_AMOUNT),
        source: T.oneOf(['manual', 'paste', 'import']), status: T.oneOf(['pending', 'confirmed', 'dismissed']),
        laterDay: T.nday, rejectedGroupIds: idList(gset), groupId: nref(gset), attendeeIds: idList(pset), payerId: nref(pset),
        baseDay: T.nday, example: T.bool,
      }, { merchant: '', laterDay: null, rejectedGroupIds: [], groupId: null, attendeeIds: [], payerId: null, baseDay: null, example: false });
      if (r.kind === 'card' && r.amount == null) fail('range');
      return r;
    });
    const payset = ids(db.payments);
    db.entries = arr(o.entries, cfg.MAX_ENTRIES).map((e) => {
      const r = pick(e, {
        id: T.int(0), personId: ref(pset), paymentId: nref(payset), groupId: nref(gset), merchant: T.str(cfg.MAX_MERCHANT),
        round: T.nint(1, 100), share: money, total: T.nint(1, cfg.MAX_AMOUNT), baseDay: T.day, createdAt: T.int(0),
        route: T.oneOf(['card', 'manual', 'moved']), priorAsk: T.bool, askCount: T.int(0, 100000),
        firstAskAt: T.nint(0), lastAskAt: T.nint(0), lastAskDay: T.nday, paid: T.int(0, cfg.MAX_AMOUNT), paidAt: T.nint(0),
        hidden: T.bool, example: T.bool,
      }, { merchant: '', paymentId: null, groupId: null, round: null, total: null, priorAsk: false, askCount: 0, firstAskAt: null, lastAskAt: null, lastAskDay: null, paid: 0, paidAt: null, hidden: false, example: false });
      if (r.paid > r.share) fail('paid');
      return r;
    });
    ids(db.entries);
    db.owes = arr(o.owes, cfg.MAX_ENTRIES).map((w) => pick(w, {
      id: T.int(0), paymentId: nref(payset), personId: ref(pset), share: money, merchant: T.str(cfg.MAX_MERCHANT), baseDay: T.day,
      groupId: nref(gset), state: T.oneOf(['open', 'done', 'hidden']), example: T.bool,
    }, { merchant: '', paymentId: null, groupId: null, state: 'open', example: false }));
    ids(db.owes);

    const lg = isObj(o.log) ? o.log : {};
    const sw = isObj(lg.swipes) ? lg.swipes : {};
    const keep = cfg.LOG_KEEP_DAYS;
    const days = (a) => (Array.isArray(a) ? a.filter(isValidDay).slice(-keep) : []);
    const cnt = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    db.log = {
      swipes: { yes: cnt(sw.yes), no: cnt(sw.no), later: cnt(sw.later), fix: cnt(sw.fix) },
      copies: (Array.isArray(lg.copies) ? lg.copies : []).filter((c) => isObj(c) && Number.isInteger(c.at) && isValidDay(c.day) && pset.has(c.personId) && Number.isInteger(c.entries))
        .map((c) => ({ at: c.at, day: c.day, personId: c.personId, entries: c.entries })).slice(-cfg.MAX_PERSON_LOG),
      shows: (Array.isArray(lg.shows) ? lg.shows : []).filter((c) => isObj(c) && isValidDay(c.day) && pset.has(c.personId))
        .map((c) => ({ day: c.day, personId: c.personId, copiedAt: Number.isInteger(c.copiedAt) ? c.copiedAt : null })).slice(-cfg.MAX_PERSON_LOG),
      openDays: days(lg.openDays), actionDays: days(lg.actionDays),
    };

    let max = 0;
    for (const list of [db.people, db.groups, db.payments, db.entries, db.owes]) for (const x of list) max = Math.max(max, x.id);
    db.nextId = Math.max(db.nextId, max + 1);
    return { ok: true, db };
  } catch (e) {
    if (e instanceof Reject) return { ok: false, code: e.code };
    throw e;
  }
}

export function countsOf(db) { return { people: db.people.length, entries: db.entries.length, payments: db.payments.length, groups: db.groups.length }; }
export function trimLog(db, cfg = CONFIG) {
  db.log.openDays = db.log.openDays.slice(-cfg.LOG_KEEP_DAYS);
  db.log.actionDays = db.log.actionDays.slice(-cfg.LOG_KEEP_DAYS);
  db.log.copies = db.log.copies.slice(-cfg.MAX_PERSON_LOG);
  db.log.shows = db.log.shows.slice(-cfg.MAX_PERSON_LOG);
}
export { clipText };
