import { h, nav, won, copyText } from '../dom.js';
import { COPY, UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { countTo } from '../widgets/count.js';
import { attachHold, holdLabel } from '../widgets/hold.js';
import { openSheet } from '../toast.js';
import { confirmSheet, doPaid } from '../flows.js';
import { askView, buildMessage, copyAsk, passPerson } from '../../core/actions.js';
import { icon } from '../dom.js';

export function render(app, idStr) {
  const store = app.store, pid = Number(idStr), cfg = CONFIG;
  const today = app.today();
  const person = store.db.people.find((x) => x.id === pid);
  const v = person ? askView(store.db, pid, today) : null;
  if (!person || !v.items) return h('div', { class: 'page' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '받아내기' }), h('p', { text: UI.nothingToAsk })));
  const S = app.session;
  const st = { soften: 0, variant: 0 };
  const num = h('span', { class: 'num' });
  const ta = h('textarea', { class: 'msg-input', rows: '4', 'aria-label': '보낼 문구. 눌러서 고칠 수 있어', spellcheck: 'false' });
  const msgBox = h('section', { class: 'msg glass', 'aria-label': '보낼 문구' }, ta);
  const softer = h('button', { class: 'tbtn', type: 'button', text: '더 부드럽게' });
  const other = h('button', { class: 'tbtn', type: 'button', text: '다른 문구' });
  const fit = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };
  function paintMsg(animate) {
    const m = buildMessage(store.db, pid, st, cfg);
    ta.value = m.text;
    softer.disabled = !m.canSoften;
    if (animate && !app.reduce()) { msgBox.classList.remove('swap'); void msgBox.offsetWidth; msgBox.classList.add('swap'); }
    else if (animate) { msgBox.classList.remove('swap'); void msgBox.offsetWidth; msgBox.classList.add('swap'); }
    fit();
  }
  other.onclick = () => { st.variant += 1; paintMsg(true); };
  softer.onclick = () => { st.soften += 1; st.variant = 0; paintMsg(true); };

  const holdBtn = h('button', { class: 'done hold', type: 'button', 'aria-label': '받았어. 길게 눌러서 처리' }, holdLabel('받았어'));
  const after = () => {
    const chk = h('span', { class: 'check-pop', 'aria-hidden': 'true' }, icon('check'));
    page.querySelector('.owe').append(chk);
    countTo(app, num, v.remaining, 0);
    setTimeout(() => app.back(), app.reduce() ? 400 : 1000);
  };
  attachHold(app, holdBtn, {
    ms: cfg.HOLD_MS, ignore: cfg.HOLD_IGNORE_MS,
    onDone: () => doPaid(app, pid, { after }),
    onAlt: () => confirmSheet(app, { lines: ['받은 거 맞아?'], okLabel: '맞아', onOk: () => doPaid(app, pid, { after }) }),
  });

  const r1First = store.db.settings.hint.r1Seen;
  const r1Panel = !r1First ? h('section', { class: 'r1 glass', role: 'button', tabindex: '0', 'aria-label': '안내. 누르면 닫혀' }, COPY.R1.map((t) => h('p', { text: t }))) : null;
  function closeR1() {
    if (!r1Panel || r1Panel.dataset.closed) return;
    r1Panel.dataset.closed = '1';
    store.update((d) => { d.settings.hint.r1Seen = true; });
    r1Panel.classList.add('gone');
    setTimeout(() => { r1Panel.remove(); page.querySelector('.r1-slot').append(h('p', { class: 'note r1-line', text: COPY.R1[0] })); }, app.reduce() ? 160 : 300);
  }
  if (r1Panel) { r1Panel.addEventListener('click', closeR1); r1Panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeR1(); } }); }

  const copyBtn = h('button', { class: 'cta copy', type: 'button', text: '문구 복사' });
  copyBtn.addEventListener('click', () => {
    // 눌림 이벤트 안에서 바로 복사를 시작한다
    const text = ta.value;
    copyText(text, ta).then((ok) => {
      if (!ok) { ta.focus(); ta.select(); app.toast.show(UI.copyFail, { ms: 6000 }); return; }
      store.update((d) => copyAsk(d, pid, today, app.now(), cfg), { undo: true });
      app.say(COPY.G1);
      app.toast.show([COPY.G1, COPY.P1[1]], { ms: cfg.UNDO_SEC * 1000, undo: () => { store.undo(); app.refresh(); } });
    });
  });
  const page = h('div', { class: 'page ask-page' },
    nav(app, holdBtn),
    h('div', { class: 'ask-head' },
      h('p', { class: 'who-name', text: v.name }),
      h('b', { class: 'owe' }, num, h('small', { text: '원' })),
      h('p', { class: 'cnt num' }, `${v.items}건 · `, h('span', { text: v.daysLabel }))),
    h('div', { class: 'r1-slot' }, r1Panel || h('p', { class: 'note r1-line', text: COPY.R1[0] })),
    msgBox,
    h('div', { class: 'ask-row2' }, other, softer,
      h('button', { class: 'tbtn', type: 'button', text: '오늘은 패스', onclick: () => { store.update((d) => passPerson(d, pid, today, cfg)); app.go('#/'); } })),
    h('div', { class: 'ask-notes' }, h('p', { text: COPY.G3 }), h('p', { text: COPY.G2 }), h('p', { text: COPY.P1[1] })),
    copyBtn);
  paintMsg(false);
  countTo(app, num, 0, v.remaining);
  setTimeout(fit, 50);
  void S; void openSheet; void won;
  return page;
}
