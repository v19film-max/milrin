import { h, textInput } from './dom.js';
import { openSheet } from './toast.js';
import { UI } from '../copy.js';
import { markPaid } from '../core/actions.js';
import { totalOwed } from '../core/ledger.js';

// 확인 시트: lines 글자, 확인/취소
export function confirmSheet(app, { lines = [], okLabel = '확인', cancelLabel = '취소', onOk, tone = '' }) {
  return openSheet(app, (panel, close) => {
    panel.append(
      h('div', { class: 'sheet-t' }, lines.map((t) => h('p', { text: t }))),
      h('button', { class: 'cta', type: 'button', text: okLabel, onclick: () => { close(); onOk(); } }),
      h('button', { class: 'tbtn', type: 'button', text: cancelLabel, onclick: close }));
    void tone; void textInput;
  });
}

// 받았어(전액): 처리 직후 6초 되돌리기
export function doPaid(app, pid, { after } = {}) {
  const store = app.store;
  let r;
  store.update((db) => { r = markPaid(db, pid, app.now()); }, { undo: true });
  if (totalOwed(store.db) === 0) app.session.justZero = true;
  app.say('받은 걸로 적었어');
  app.toast.show(UI.paidNote, {
    ms: app.cfg.UNDO_SEC * 1000,
    undo: () => { store.undo(); app.session.justZero = false; app.refresh(); },
  });
  if (after) after(r);
  return r;
}
