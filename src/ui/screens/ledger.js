import { h, nav, icon, won, clear } from '../dom.js';
import { COPY } from '../../copy.js';
import { countTo } from '../widgets/count.js';
import { ledgerRows, totalOwed, daysLabel, remainingOf } from '../../core/ledger.js';
import { undoPaid, unhidePerson } from '../../core/actions.js';
import { mdLabel } from '../../core/date.js';
import { UI } from '../../copy.js';

export function acc(app, title, count, listBuilder) {
  const body = h('div', { class: 'acc-body' }, h('div', { class: 'acc-in' }));
  const btn = h('button', { class: 'acc-h', type: 'button', 'aria-expanded': 'false' }, h('span', { text: `${title} ${count}` }), icon('down'));
  const wrap = h('div', { class: 'acc' }, btn, body);
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('open', open);
  });
  const inner = body.firstChild;
  return { el: wrap, inner, redraw() { clear(inner); listBuilder(inner); } };
}

export function render(app) {
  const store = app.store;
  const today = app.today();
  const num = h('span', { class: 'num' });
  const rowsBox = h('div', { class: 'panel rows stagger' });
  const paidAcc = acc(app, '받은 돈', 0, () => {});
  const hidAcc = acc(app, '숨긴 것', 0, () => {});
  const page = h('div', { class: 'page ledger' },
    nav(app, h('button', { class: 'tbtn', type: 'button', text: '결제 추가', onclick: () => app.go('#/add') })),
    h('div', { class: 'hero' }, h('p', { class: 'lab', text: '받아낼 돈' }), h('b', { class: 'amount' }, num, h('small', { text: '원' })), h('p', { class: 'note x1', text: COPY.X1 })),
    rowsBox, paidAcc.el, hidAcc.el);

  function paint(first) {
    const db = store.db;
    const total = totalOwed(db);
    countTo(app, num, first ? 0 : Number(num.textContent.replace(/,/g, '')) || 0, total);
    clear(rowsBox);
    const rows = ledgerRows(db, today);
    if (!rows.length) rowsBox.append(h('p', { class: 'empty-note', text: UI.ledgerEmpty }));
    for (const r of rows) {
      const rest = r.restDays > 0;
      rowsBox.append(h('button', { class: `lrow ${rest ? 'rest' : ''}`, type: 'button', onclick: () => app.go(`#/person/${r.personId}`) },
        h('span', { class: 'lt' }, h('span', { class: 'nm', text: r.name }), h('span', { class: 'sb num' }, rest ? `${r.restDays}일 뒤 다시` : `${daysLabel(r.days)} · ${r.count}건`)),
        h('span', { class: 'amt2 num', text: `${won(r.remaining)}원` })));
    }
    rowsBox.hidden = !rows.length && false;
    // 받은 돈
    const paid = db.entries.filter((e) => !e.hidden && e.paid >= e.share).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
    const hiddenBy = new Map();
    for (const e of db.entries) if (e.hidden && e.paid < e.share) hiddenBy.set(e.personId, (hiddenBy.get(e.personId) || 0) + remainingOf(e));
    const pt = paidAcc.el.querySelector('.acc-h span'); pt.textContent = `받은 돈 ${paid.length}`;
    paidAcc.redraw = () => {};
    clear(paidAcc.inner);
    for (const e of paid) {
      const p = db.people.find((x) => x.id === e.personId);
      paidAcc.inner.append(h('div', { class: 'srow' },
        h('span', { class: 'lt' }, h('span', { class: 'nm', text: p ? p.name : '' }), h('span', { class: 'sb num', text: `${e.merchant || UI.settleWord} · ${mdLabel(e.baseDay)} · ${won(e.share)}원` })),
        h('button', { class: 'tbtn', type: 'button', text: '되돌리기', onclick: () => { store.update((d) => undoPaid(d, e.id)); paint(false); } })));
    }
    if (!paid.length) paidAcc.inner.append(h('p', { class: 'empty-note', text: UI.none }));
    const ht = hidAcc.el.querySelector('.acc-h span'); ht.textContent = `숨긴 것 ${hiddenBy.size}`;
    clear(hidAcc.inner);
    for (const [pid, amt] of hiddenBy) {
      const p = db.people.find((x) => x.id === pid);
      hidAcc.inner.append(h('div', { class: 'srow' },
        h('span', { class: 'lt' }, h('span', { class: 'nm', text: p ? p.name : '' }), h('span', { class: 'sb num', text: `${won(amt)}원` })),
        h('button', { class: 'tbtn', type: 'button', text: '다시 보이기', onclick: () => { store.update((d) => unhidePerson(d, pid)); paint(false); } })));
    }
    if (!hiddenBy.size) hidAcc.inner.append(h('p', { class: 'empty-note', text: UI.none }));
  }
  paint(true);
  return page;
}
