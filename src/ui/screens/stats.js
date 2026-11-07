import { h, nav, copyText } from '../dom.js';
import { UI } from '../../copy.js';
import { computeStats, statsLines, ratioText } from '../../core/stats.js';
import { fmtWon } from '../../core/split.js';

// 이름·모임·가맹점은 어디에도 없다. 캡처하기 쉽게 한 화면에 세로로 모은다.
export function render(app) {
  const store = app.store;
  let scope = 'period';
  const box = h('div', { class: 'st-body' });
  const meta = () => ({ appBuild: app.build, code: store.db.settings.testerCode, today: app.today() });
  const s0 = () => computeStats(store.db, app.today(), app.now());
  const pct = (r) => (r == null ? '-' : `${Math.round(r * 100)}%`);
  const row = (label, value) => h('div', { class: 'st-row' }, h('span', { class: 'sl', text: label }), h('span', { class: 'sv2 num', text: value }));
  const big = (label, value) => h('div', { class: 'st-big' }, h('span', { class: 'sl', text: label }), h('b', { class: 'num', text: value }));
  function paint() {
    const s = s0(), m = s[scope];
    box.replaceChildren(
      h('p', { class: 'st-top num', text: `${app.build} · ${store.db.settings.testerCode || '-'} · ${app.today()}` }),
      big('띄움 반응률', ratioText(m.show.num, m.show.den)),
      big('회수율', pct(m.recovery.ratio)),
      big('재요청 효과', ratioText(m.rerequest.num, m.rerequest.den)),
      row('판정 대기', String(m.show.wait)),
      row('올린 금액 추측 카드', `${fmtWon(m.recovery.byRoute.card)}원`),
      row('올린 금액 직접 입력', `${fmtWon(m.recovery.byRoute.manual)}원`),
      row('올린 금액 옮김', `${fmtWon(m.recovery.byRoute.moved)}원`),
      row('주차별 연 날/행동한 날', s.weeks.map((w) => `${w.opened}/${w.acted}`).join(' · ')),
      row('주 1회 이상 사용', `${s.weeks.filter((w) => w.used).length}/4주`),
      row('카드 맞아·아니야·나중에·고침', `${s.cards.yes}·${s.cards.no}·${s.cards.later}·${s.cards.fix}`),
      row('카드 적중률', ratioText(s.cards.hit.num, s.cards.hit.den)),
      row('올린 건', `${m.ledger.raisedCount}건 ${fmtWon(m.ledger.raisedAmount)}원`),
      row('문구 복사', `${m.ledger.copies}회`),
      row('받음 처리', `${m.ledger.paidCount}건 ${fmtWon(m.ledger.paidAmount)}원`),
      row('일부 받음·숨긴 건', `${m.ledger.partialCount}·${m.ledger.hiddenCount}`),
      row('열린 건·사람', `${s.current.openCount}건·${s.current.people}명`),
      row('받아낼 돈', `${fmtWon(s.current.total)}원`),
      row('줄 돈 후보', `${s.current.owes}건`));
  }
  const seg = (id, label) => { const b = h('button', { class: `tbtn ${scope === id ? 'on' : ''}`, type: 'button', 'aria-pressed': String(scope === id), text: label, onclick: () => { scope = id; for (const x of nav_r.children) { const on = x.dataset.id === scope; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); } paint(); } }); b.dataset.id = id; return b; };
  const nav_r = [seg('period', '28일'), seg('all', '전체')];
  const copyBtn = h('button', { class: 'tbtn', type: 'button', text: '숫자 복사', onclick: () => {
    const lines = statsLines(s0(), meta());
    copyText(lines.join('\n')).then((ok) => app.toast.show(ok ? UI.copied : UI.copyFail, { ms: 2500 }));
  } });
  const page = h('div', { class: 'page stats' }, nav(app, nav_r), box, h('div', { class: 'st-foot' }, copyBtn, h('p', { class: 'note', text: UI.statsNote })));
  // 위 nav의 오른쪽 묶음을 가리키는 참조
  Object.defineProperty(nav_r, 'children', { get: () => page.querySelector('.nav-r').children });
  paint();
  return page;
}
