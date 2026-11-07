import { h, nav, chip, textInput, icon } from '../dom.js';
import { UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { addPerson, addGroup } from '../../core/db.js';
import { cleanName, nameKey } from '../../core/text.js';
import { confirmSheet } from '../flows.js';

export function render(app) {
  const store = app.store;
  const box = h('div', { class: 'panel rows stagger' });
  const openIds = new Set();
  const add = h('div', { class: 'inline-add new-g', hidden: true });
  function paint() {
    box.replaceChildren();
    const db = store.db;
    if (!db.groups.length) box.append(h('p', { class: 'empty-note', text: UI.none }));
    for (const g of db.groups) {
      const open = openIds.has(g.id);
      const head = h('button', { class: 'lrow', type: 'button', 'aria-expanded': String(open) },
        h('span', { class: 'lt' }, h('span', { class: 'nm', text: g.name }), h('span', { class: 'sb', text: `${g.memberIds.length}명` })), icon('down'));
      const nameI = textInput({ value: g.name, maxlength: '40', 'aria-label': '모임 이름' }, { onEnter: () => nameI.blur() });
      nameI.addEventListener('blur', () => { const nm = cleanName(nameI.value, CONFIG.MAX_NAME); if (nm && nm !== g.name) { store.update((d) => { d.groups.find((x) => x.id === g.id).name = nm; }); paint(); } });
      const members = h('div', { class: 'chips' });
      const paintMembers = () => {
        members.replaceChildren();
        const cur = store.db.groups.find((x) => x.id === g.id);
        for (const p of store.db.people.slice(-60)) {
          members.append(chip(p.name, cur.memberIds.includes(p.id), (v) => {
            store.update((d) => { const gg = d.groups.find((x) => x.id === g.id); gg.memberIds = v ? [...new Set([...gg.memberIds, p.id])] : gg.memberIds.filter((m) => m !== p.id); });
            head.querySelector('.sb').textContent = `${store.db.groups.find((x) => x.id === g.id).memberIds.length}명`;
          }));
        }
      };
      paintMembers();
      const pn = textInput({ placeholder: '사람 추가', maxlength: '40', 'aria-label': '사람 추가' }, { onEnter: addP });
      function addP() {
        const nm = cleanName(pn.value, CONFIG.MAX_NAME); if (!nm) return;
        store.update((d) => {
          const hit = d.people.filter((p) => nameKey(p.name) === nameKey(nm));
          const id = hit.length === 1 ? hit[0].id : addPerson(d, nm);
          const gg = d.groups.find((x) => x.id === g.id); gg.memberIds = [...new Set([...gg.memberIds, id])];
        });
        pn.value = ''; paintMembers(); head.querySelector('.sb').textContent = `${store.db.groups.find((x) => x.id === g.id).memberIds.length}명`;
      }
      const body = h('div', { class: 'acc-body' }, h('div', { class: 'acc-in g-edit' },
        h('label', { class: 'field' }, h('span', { text: '이름' }), nameI), h('p', { class: 'lab', text: '멤버' }), members,
        h('div', { class: 'inline-add' }, pn, h('button', { class: 'tbtn', type: 'button', text: '추가', onclick: addP })),
        h('button', { class: 'tbtn', type: 'button', text: '지우기', onclick: () => confirmSheet(app, { lines: [UI.groupDel], okLabel: '지우기', onOk: () => {
          store.update((d) => { d.groups = d.groups.filter((x) => x.id !== g.id); for (const p of d.payments) { if (p.groupId === g.id) p.groupId = null; p.rejectedGroupIds = p.rejectedGroupIds.filter((x) => x !== g.id); } for (const e of d.entries) if (e.groupId === g.id) e.groupId = null; for (const o of d.owes) if (o.groupId === g.id) o.groupId = null; }, { undo: true });
          app.toast.show(UI.deleted, { undo: () => { store.undo(); paint(); }, ms: CONFIG.UNDO_SEC * 1000 }); paint();
        } }) })));
      const wrap = h('div', { class: `acc ${open ? 'open' : ''}` }, head, body);
      head.addEventListener('click', () => { const o = head.getAttribute('aria-expanded') !== 'true'; head.setAttribute('aria-expanded', String(o)); wrap.classList.toggle('open', o); if (o) openIds.add(g.id); else openIds.delete(g.id); });
      box.append(wrap);
    }
  }
  const newName = textInput({ placeholder: '새 모임 이름', maxlength: '40', 'aria-label': '새 모임 이름' }, { onEnter: make });
  function make() {
    const nm = cleanName(newName.value, CONFIG.MAX_NAME); if (!nm) return;
    if (store.db.groups.length >= CONFIG.MAX_GROUPS) return;
    let id; store.update((d) => { id = addGroup(d, nm, []); });
    openIds.add(id); newName.value = ''; add.hidden = true; paint();
  }
  add.append(newName, h('button', { class: 'tbtn', type: 'button', text: '만들기', onclick: make }));
  paint();
  return h('div', { class: 'page groups' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '모임' })), box,
    add, h('button', { class: 'tbtn new-btn', type: 'button', text: '새 모임', onclick: () => { add.hidden = !add.hidden; if (!add.hidden) newName.focus(); } }));
}
