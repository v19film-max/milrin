import { CONFIG } from '../config.js';
import { addDays, diffDays, dayOfMs } from './date.js';
import { fmtWon } from './split.js';
import { isOpen, sumRemaining, owesOpen } from './ledger.js';

export function ratioText(num, den) { return den ? `${num}/${den} (${Math.round((num / den) * 100)}%)` : '-'; }

// 이름·모임·가맹점은 어디에도 넣지 않는다(숫자와 날짜만). 예시 데이터는 모두 제외.
export function computeStats(db, today, now, cfg = CONFIG) {
  const start = db.settings.experimentStart;
  const end = addDays(start, cfg.EXPERIMENT_DAYS - 1);
  const exP = new Set(db.people.filter((p) => p.example).map((p) => p.id));
  const inPeriod = (d) => diffDays(d, start) >= 0 && diffDays(d, end) <= 0;
  const any = () => true;
  const entries = db.entries.filter((e) => !e.example && !exP.has(e.personId));

  const metrics = (f) => {
    let num = 0, den = 0, wait = 0;
    for (const s of db.log.shows) {
      if (exP.has(s.personId) || !f(s.day)) continue;
      const elapsed = diffDays(today, s.day) >= cfg.SHOW_REACT_DAYS;
      if (s.copiedAt != null) { num++; den++; } else if (elapsed) den++; else wait++;
    }
    const es = entries.filter((e) => f(dayOfMs(e.createdAt)));
    const raised = es.reduce((s, e) => s + e.share, 0), paid = es.reduce((s, e) => s + e.paid, 0);
    const byRoute = { card: 0, manual: 0, moved: 0 };
    for (const e of es) byRoute[e.route] += e.share;
    const full = es.filter((e) => e.paid >= e.share);
    return {
      show: { num, den, wait },
      recovery: { raised, paid, ratio: raised ? paid / raised : null, byRoute },
      rerequest: { num: full.filter((e) => e.askCount >= 2).length, den: full.length },
      ledger: {
        raisedCount: es.length, raisedAmount: raised,
        copies: db.log.copies.filter((c) => !exP.has(c.personId) && f(c.day)).length,
        paidCount: full.length, paidAmount: full.reduce((s, e) => s + e.share, 0),
        partialCount: es.filter((e) => e.paid > 0 && e.paid < e.share).length,
        hiddenCount: es.filter((e) => e.hidden).length,
      },
    };
  };
  const weeks = [0, 1, 2, 3].map((w) => {
    const from = addDays(start, 7 * w), to = addDays(from, 6);
    const inW = (d) => diffDays(d, from) >= 0 && diffDays(d, to) <= 0;
    const acted = db.log.actionDays.filter(inW).length;
    return { week: w + 1, opened: db.log.openDays.filter(inW).length, acted, used: acted >= 1 };
  });
  const sw = db.log.swipes;
  const open = entries.filter(isOpen);
  return {
    range: { start, end },
    period: metrics(inPeriod), all: metrics(any), weeks,
    cards: { yes: sw.yes, no: sw.no, later: sw.later, fix: sw.fix, hit: { num: sw.yes, den: sw.yes + sw.no } },
    current: { openCount: open.length, people: new Set(open.map((e) => e.personId)).size, total: sumRemaining(open), owes: owesOpen(db).filter((o) => !o.example && !exP.has(o.personId)).length },
  };
}

// 화면과 "숫자 복사"가 같이 쓰는 줄 목록. 이름 없음.
export function statsLines(s, meta) {
  const p = s.period, pct = (r) => (r == null ? '-' : `${Math.round(r * 100)}%`);
  return [
    `${meta.appBuild} · ${meta.code || '-'} · ${meta.today}`,
    `띄움 반응률: ${ratioText(p.show.num, p.show.den)}`,
    `판정 대기: ${p.show.wait}`,
    `회수율: ${p.recovery.ratio == null ? '-' : `${fmtWon(p.recovery.paid)}/${fmtWon(p.recovery.raised)}원 (${pct(p.recovery.ratio)})`}`,
    `경로별 올린 금액 추측 카드: ${fmtWon(p.recovery.byRoute.card)}원`,
    `경로별 올린 금액 직접 입력: ${fmtWon(p.recovery.byRoute.manual)}원`,
    `경로별 올린 금액 옮김: ${fmtWon(p.recovery.byRoute.moved)}원`,
    `재요청 효과: ${ratioText(p.rerequest.num, p.rerequest.den)}`,
    ...s.weeks.map((w) => `${w.week}주차: 연 날 ${w.opened} · 행동한 날 ${w.acted}${w.used ? ' · 사용' : ''}`),
    `카드 맞아 ${s.cards.yes} · 아니야 ${s.cards.no} · 나중에 ${s.cards.later} · 고쳐서 저장 ${s.cards.fix}`,
    `카드 적중률: ${ratioText(s.cards.hit.num, s.cards.hit.den)}`,
    `올린 건: ${p.ledger.raisedCount}건 ${fmtWon(p.ledger.raisedAmount)}원`,
    `문구 복사: ${p.ledger.copies}회`,
    `받음 처리: ${p.ledger.paidCount}건 ${fmtWon(p.ledger.paidAmount)}원`,
    `일부 받음: ${p.ledger.partialCount}건 · 숨긴 건: ${p.ledger.hiddenCount}건`,
    `지금 열린 건 ${s.current.openCount}건 · 사람 ${s.current.people}명 · 받아낼 돈 ${fmtWon(s.current.total)}원 · 줄 돈 후보 ${s.current.owes}건`,
  ];
}
