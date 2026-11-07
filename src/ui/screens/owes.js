import { h, nav, won, icon } from '../dom.js';
import { COPY, UI, fill } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { countTo } from '../widgets/count.js';
import { owesOpen, owesTotal } from '../../core/ledger.js';

export function render(app) {
  const store = app.store;
  const num = h('span', { class: 'num' });
  const box = h('div', { class: 'panel rows stagger' });
  function paint() {
    box.replaceChildren();
    const db = store.db;
    const by = new Map();
    for (const o of owesOpen(db)) by.set(o.personId, (by.get(o.personId) || 0) + o.share);
    if (!by.size) box.append(h('p', { class: 'empty-note', text: UI.none }));
    for (const [pid, amt] of by) {
      const p = db.people.find((x) => x.id === pid);
      const name = p ? p.name : '';
      const body = h('div', { class: 'acc-body' }, h('div', { class: 'acc-in' },
        h('div', { class: 'z2' }, COPY.Z2.map((t) => h('p', { text: fill(t, { 이름: name, 금액: won(amt) }) }))),
        h('div', { class: 'z2-btns' },
          h('button', { class: 'tbtn', type: 'button', text: '정리했어', onclick: () => set('done') }),
          h('button', { class: 'tbtn', type: 'button', text: UI.hideBtn, onclick: () => set('hidden') }))));
      function set(state) {
        store.update((d) => { for (const o of d.owes) if (o.personId === pid && o.state === 'open') o.state = state; }, { undo: true });
        app.toast.show(state === 'done' ? UI.owesDone : UI.hiddenNote, { undo: () => { store.undo(); paint(); }, ms: CONFIG.UNDO_SEC * 1000 });
        paint();
      }
      const head = h('button', { class: 'lrow', type: 'button', 'aria-expanded': 'false' },
        h('span', { class: 'lt' }, h('span', { class: 'nm', text: name })),
        h('span', { class: 'amt2 num', text: `${won(amt)}원` }), icon('down'));
      const wrap = h('div', { class: 'acc' }, head, body);
      head.addEventListener('click', () => { const o = head.getAttribute('aria-expanded') !== 'true'; head.setAttribute('aria-expanded', String(o)); wrap.classList.toggle('open', o); });
      box.append(wrap);
    }
    const total = owesTotal(db);
    countTo(app, num, Number(num.textContent.replace(/,/g, '')) || 0, total);
  }
  const page = h('div', { class: 'page owes' }, nav(app),
    h('div', { class: 'hero' }, h('p', { class: 'lab', text: '줄 돈일 수도' }), h('b', { class: 'amount' }, num, h('small', { text: '원' })), h('p', { class: 'note x1', text: COPY.X1 })), box);
  paint();
  return page;
}
