import { h, nav, won } from '../dom.js';
import { groupNights, nightTitle, clockText } from '../../core/night.js';
import { splitAt } from '../../core/date.js';
import { UI } from '../../copy.js';

export function render(app, key) {
  const db = app.store.db;
  const g = groupNights(db.payments).find((x) => x.key === key);
  if (!g) return h('div', { class: 'page' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '그날 밤' }), h('p', { text: UI.noNight })));
  const gp = g.items.map((i) => i.payment).find((p) => p.groupId != null);
  const grp = gp ? db.groups.find((x) => x.id === gp.groupId) : null;
  const who = (p) => {
    if (p.kind === 'card') return '네가 냄';
    if (p.status === 'confirmed' && p.payerId != null) { const x = db.people.find((y) => y.id === p.payerId); return `${x ? x.name : '다른 사람'} 냄`; }
    return '누가 냈더라';
  };
  const rows = g.items.map(({ payment: p, round }) => {
    const gap = p.kind === 'gap' && !(p.status === 'confirmed' && p.payerId != null);
    const s = splitAt(p.at);
    const t = `${s.time ? s.time + ' · ' : ''}${who(p)}`;
    const body = [h('span', { class: 't', text: t }),
      h('span', { class: 'm' }, h('span', { text: `${round}차 ${p.merchant || (p.kind === 'gap' ? '' : UI.settleWord)}`.trim() }), h('span', { class: 'num', text: p.amount ? `${won(p.amount)}원` : '?' }))];
    if (gap && p.status === 'pending') {
      return h('li', { class: 'gap' }, h('button', { class: 'ask-row', type: 'button', 'aria-label': `${clockText(p.at) || `${round}차`} ${round}차, 누가 냈더라? 눌러서 기억 더듬기`, onclick: () => { app.session.focusCard = p.id; app.go('#/'); } }, body));
    }
    return h('li', { class: gap ? 'gap' : '' }, body);
  });
  return h('div', { class: 'page night' },
    nav(app),
    h('div', { class: 'ttl' }, h('h1', { text: nightTitle(g) }), grp ? h('p', { text: grp.name }) : null),
    h('section', { class: 'night-panel glass', 'aria-label': `${nightTitle(g)} 순서` }, h('ol', { class: 'tl stagger' }, rows)),
    h('button', { class: 'tbtn night-add', type: 'button', text: '빠진 차수 추가', onclick: () => { app.session.addPrefill = { day: g.baseDay, payer: 'other' }; app.go('#/add'); } }));
}
