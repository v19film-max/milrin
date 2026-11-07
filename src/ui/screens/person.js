import { h, nav, won, textInput, chip } from '../dom.js';
import { COPY, UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { countTo } from '../widgets/count.js';
import { attachHold, holdLabel } from '../widgets/hold.js';
import { openSheet } from '../toast.js';
import { confirmSheet, doPaid } from '../flows.js';
import { openEntriesOf, sumRemaining, remainingOf } from '../../core/ledger.js';
import { askView, partialPaid, hidePerson, deleteEntry } from '../../core/actions.js';
import { cleanName } from '../../core/text.js';
import { mdLabel } from '../../core/date.js';
import { parseMoney } from '../../core/parse.js';

export function render(app, idStr) {
  const store = app.store, pid = Number(idStr), today = app.today();
  const person = store.db.people.find((x) => x.id === pid);
  if (!person) return h('div', { class: 'page' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '사람' }), h('p', { text: UI.noPerson })));
  const v = askView(store.db, pid, today);
  const nameBox = h('div', { class: 'who-box' });
  const num = h('span', { class: 'num' });
  function paintName() {
    nameBox.replaceChildren();
    nameBox.append(h('button', { class: 'who-name editable', type: 'button', 'aria-label': `${store.db.people.find((x) => x.id === pid).name}. 눌러서 이름 고치기`, onclick: editName }, store.db.people.find((x) => x.id === pid).name));
  }
  function editName() {
    const cur = store.db.people.find((x) => x.id === pid).name;
    const inp = textInput({ value: cur, maxlength: '40', 'aria-label': '이름' }, { onEnter: () => inp.blur() });
    nameBox.replaceChildren(inp);
    inp.focus(); inp.select();
    inp.addEventListener('blur', () => {
      const nm = cleanName(inp.value, CONFIG.MAX_NAME);
      if (nm) store.update((d) => { d.people.find((x) => x.id === pid).name = nm; });
      paintName();
    });
  }
  paintName();
  const list = openEntriesOf(store.db, pid).sort((a, b) => (a.baseDay < b.baseDay ? -1 : a.baseDay > b.baseDay ? 1 : a.id - b.id));
  const rows = list.map((e) => {
    const left = h('span', { class: 'lt' }, h('span', { class: 'nm', text: e.merchant || UI.settleWord }), h('span', { class: 'sb num', text: mdLabel(e.baseDay) }));
    const amount = e.paid > 0 ? `${won(e.share)} 중 ${won(remainingOf(e))}` : won(e.share);
    const night = e.paymentId != null ? store.db.payments.find((p) => p.id === e.paymentId) : null;
    return h('div', { class: 'srow' },
      night ? h('button', { class: 'lbtn', type: 'button', onclick: () => {
        const key = nightKey(store.db, night.id); if (key) app.go(`#/night/${encodeURIComponent(key)}`);
      } }, left) : left,
      h('span', { class: 'amt2 num', text: `${amount}원` }),
      h('button', { class: 'tbtn', type: 'button', text: '지우기', onclick: () => confirmSheet(app, { lines: [UI.deleteAsk], okLabel: '지우기', onOk: () => { store.update((d) => deleteEntry(d, e.id), { undo: true }); app.toast.show(UI.deleted, { undo: () => { store.undo(); app.refresh(); }, ms: CONFIG.UNDO_SEC * 1000 }); app.refresh(); } }) }));
  });
  const paidHold = h('button', { class: 'tbtn hold', type: 'button', 'aria-label': '받았어. 길게 눌러서 처리' }, holdLabel('받았어'));
  attachHold(app, paidHold, {
    ms: CONFIG.HOLD_MS, ignore: CONFIG.HOLD_IGNORE_MS,
    onDone: () => doPaid(app, pid, { after: () => setTimeout(() => app.back(), app.reduce() ? 300 : 900) }),
    onAlt: () => confirmSheet(app, { lines: ['받은 거 맞아?'], okLabel: '맞아', onOk: () => doPaid(app, pid, { after: () => setTimeout(() => app.back(), 400) }) }),
  });
  const page = h('div', { class: 'page person' },
    nav(app),
    nameBox,
    h('b', { class: 'owe' }, num, h('small', { text: '원' })),
    h('p', { class: 'cnt num' }, `${v.items}건 · `, h('span', { text: v.daysLabel })),
    v.copiedAgo != null ? h('p', { class: 'note', text: `복사한 지 ${v.copiedAgo}일` }) : null,
    h('div', { class: 'panel rows stagger' }, rows.length ? rows : h('p', { class: 'empty-note', text: UI.none })),
    h('div', { class: 'p-btns' },
      h('button', { class: 'cta', type: 'button', text: '받아내기', disabled: !list.length, onclick: () => app.go(`#/ask/${pid}`) }),
      h('div', { class: 'p-row' },
        CONFIG.PARTIAL_PAYMENT ? h('button', { class: 'tbtn', type: 'button', text: '일부만 받았어', disabled: !list.length, onclick: partialSheet }) : null,
        paidHold,
        h('button', { class: 'tbtn', type: 'button', text: UI.hideBtn, disabled: !list.length, onclick: hideSheet }))));
  countTo(app, num, 0, v.remaining);

  function partialSheet() {
    openSheet(app, (panel, close) => {
      const total = sumRemaining(openEntriesOf(store.db, pid));
      const err = h('p', { class: 'err', role: 'alert' });
      const inp = textInput({ inputmode: 'numeric', placeholder: `${won(total)} 이하`, 'aria-label': '받은 금액' }, { onEnter: ok });
      function ok() {
        const val = parseMoney(inp.value);
        if (val == null || Number.isNaN(val)) { err.textContent = UI.amountCheck; return; }
        if (val > total) { err.textContent = UI.overRemain; return; }
        let r; store.update((d) => { r = partialPaid(d, pid, val, app.now()); }, { undo: true });
        if (!r.ok) { err.textContent = UI.amountCheck; return; }
        close();
        app.toast.show(UI.partialNote, { undo: () => { store.undo(); app.refresh(); }, ms: CONFIG.UNDO_SEC * 1000 });
        app.refresh();
      }
      panel.append(h('div', { class: 'sheet-t' }, h('p', { text: '얼마 받았어?' })), inp, err, h('button', { class: 'cta', type: 'button', text: '확인', onclick: ok }), h('button', { class: 'tbtn', type: 'button', text: '취소', onclick: close }));
    });
  }
  function hideSheet() {
    openSheet(app, (panel, close) => {
      panel.append(
        h('div', { class: 'sheet-t' }, COPY.Q1.map((t) => h('p', { text: t })), h('p', { class: 'note', text: COPY.Q2 })),
        h('button', { class: 'cta', type: 'button', text: UI.hideBtn, onclick: () => { close(); store.update((d) => hidePerson(d, pid), { undo: true }); app.toast.show(UI.hiddenNote, { undo: () => { store.undo(); app.refresh(); }, ms: CONFIG.UNDO_SEC * 1000 }); app.back(); } }),
        h('button', { class: 'tbtn', type: 'button', text: '취소', onclick: close }));
    });
  }
  void chip;
  return page;
}
import { nightKeyOf } from '../../core/night.js';
const nightKey = (db, id) => nightKeyOf(db.payments, id);
