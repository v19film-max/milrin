import { h, chip, field, textInput, won } from './dom.js';
import { CONFIG } from '../config.js';
import { COPY, UI } from '../copy.js';
import { addPerson, addGroup } from '../core/db.js';
import { cleanName, cleanText, nameKey } from '../core/text.js';
import { frameOf, guessAttendees } from '../core/guess.js';
import { confirmCard, dismissCard, gapToCard } from '../core/cards.js';
import { parseMoney } from '../core/parse.js';
import { nightKeyOf } from '../core/night.js';

// 카드 뒷면(고치기). 저장하면 이 값으로 확정한다.
export function buildCardBack(app, panel, ctl, pid, mode0, done) {
  const store = app.store;
  const p0 = store.db.payments.find((x) => x.id === pid);
  const frame = frameOf(store.db, p0);
  const isGap = p0.kind === 'gap';
  const S = {
    mode: isGap ? (mode0 === 'left' ? 'me' : 'other') : 'card',
    groupId: frame.groupId, wantNewGroup: false, attendees: new Set(frame.attendeeIds), touched: false, payerId: null,
  };
  const db = () => store.db;
  const isCardLike = () => S.mode !== 'other';

  const errEl = h('p', { class: 'err', role: 'alert' });
  const amount = textInput({ inputmode: 'numeric', placeholder: isGap ? '모르면 비워 둬' : '금액', value: p0.amount == null ? '' : won(p0.amount), 'aria-label': '금액' });
  const merchant = textInput({ maxlength: String(CONFIG.MAX_MERCHANT * 2), value: p0.merchant, placeholder: '가게 이름(선택)', 'aria-label': '가맹점 이름' });
  const modeBox = h('div', { class: 'chips' });
  const groupBox = h('div', { class: 'chips' });
  const newGroupName = textInput({ placeholder: '새 모임 이름', maxlength: '30', 'aria-label': '새 모임 이름' });
  const newGroupWrap = h('div', { class: 'inline-add', hidden: true }, newGroupName);
  const peopleBox = h('div', { class: 'chips' });
  const addName = textInput({ placeholder: '사람 추가', maxlength: '30', 'aria-label': '사람 추가' }, { onEnter: () => addOne() });
  const payerBox = h('div', { class: 'chips' });
  const payerName = textInput({ placeholder: '새 이름', maxlength: '30', 'aria-label': '결제한 사람 새 이름' }, { onEnter: () => addPayer() });
  const payerSec = h('section', { class: 'sec' });
  const meSec = h('section', { class: 'sec' });

  function redrawMode() {
    modeBox.replaceChildren();
    if (!isGap) return;
    const mk = (label, v) => { const b = chip(label, S.mode === v, () => { S.mode = v; redrawMode(); showSections(); }); b.setAttribute('aria-pressed', String(S.mode === v)); return b; };
    modeBox.append(mk('다른 사람이 냈어', 'other'), mk('내가 냈어', 'me'));
  }
  function redrawGroups() {
    groupBox.replaceChildren();
    for (const g of db().groups) {
      groupBox.append(chip(g.name, S.groupId === g.id, () => {
        S.groupId = S.groupId === g.id ? null : g.id; S.wantNewGroup = false; newGroupWrap.hidden = true;
        if (S.groupId != null && !S.touched) S.attendees = new Set(guessAttendees(db(), S.groupId));
        redrawGroups(); redrawPeople(); redrawPayer();
      }));
    }
    groupBox.append(chip('새 모임', S.wantNewGroup, (v) => {
      S.wantNewGroup = v; if (v) S.groupId = null; newGroupWrap.hidden = !v; redrawGroups();
      if (v) setTimeout(() => newGroupName.focus(), 30);
    }));
  }
  function peopleIds() {
    const g = db().groups.find((x) => x.id === S.groupId);
    const ids = new Set(g ? g.memberIds : []);
    for (const x of S.attendees) ids.add(x);
    if (!g) for (const x of db().people.slice(-40)) ids.add(x.id);
    return db().people.filter((x) => ids.has(x.id));
  }
  function redrawPeople() {
    peopleBox.replaceChildren();
    for (const x of peopleIds()) {
      peopleBox.append(chip(x.name, S.attendees.has(x.id), (v) => { S.touched = true; if (v) S.attendees.add(x.id); else S.attendees.delete(x.id); }));
    }
    if (!peopleBox.firstChild) peopleBox.append(h('p', { class: 'note', text: '아직 사람이 없어. 아래에서 추가해 줘' }));
  }
  function redrawPayer() {
    payerBox.replaceChildren();
    const g = db().groups.find((x) => x.id === S.groupId);
    const ids = new Set([...(g ? g.memberIds : []), ...S.attendees, ...(S.payerId != null ? [S.payerId] : [])]);
    for (const x of db().people.filter((y) => ids.has(y.id))) {
      const b = chip(x.name, S.payerId === x.id, () => { S.payerId = S.payerId === x.id ? null : x.id; if (S.payerId != null) { S.attendees.add(x.id); redrawPeople(); } redrawPayer(); });
      b.setAttribute('aria-pressed', String(S.payerId === x.id));
      payerBox.append(b);
    }
  }
  function ensurePerson(name) {
    const nm = cleanName(name, CONFIG.MAX_NAME);
    if (!nm) return null;
    const hit = db().people.filter((x) => nameKey(x.name) === nameKey(nm));
    if (hit.length === 1) return hit[0].id;
    let id; store.update((d) => { id = addPerson(d, nm); });
    return id;
  }
  function addOne() {
    const id = ensurePerson(addName.value);
    if (id == null) return;
    addName.value = ''; S.touched = true; S.attendees.add(id);
    redrawPeople(); redrawPayer();
  }
  function addPayer() {
    const id = ensurePerson(payerName.value);
    if (id == null) return;
    payerName.value = ''; S.payerId = id; S.attendees.add(id); S.touched = true;
    redrawPeople(); redrawPayer();
  }
  function showSections() {
    payerSec.hidden = S.mode !== 'other';
    meSec.hidden = false;
    amount.setAttribute('placeholder', S.mode === 'other' ? '모르면 비워 둬' : '금액');
  }

  function fail(msg) { errEl.textContent = msg; }
  function save() {
    fail('');
    const raw = cleanText(amount.value);
    let amt = null;
    if (raw) { const v = parseMoney(raw); if (v == null || Number.isNaN(v)) return fail('금액을 확인해 줘'); amt = v; }
    if (isCardLike() && amt == null) return fail('금액을 넣어 줘');
    let result;
    const attendees = [...S.attendees];
    const ok = (() => {
      let msg = null;
      const snapshotBefore = JSON.stringify(db());
      store.update((d) => {
        let gid = S.groupId;
        if (S.wantNewGroup && cleanName(newGroupName.value)) {
          const dup = d.groups.find((g) => nameKey(g.name) === nameKey(newGroupName.value));
          gid = dup ? dup.id : addGroup(d, newGroupName.value, attendees);
        }
        if (S.mode === 'me') { const r = gapToCard(d, pid, amt); if (!r.ok) { msg = '금액을 넣어 줘'; return; } }
        let payerId = null;
        if (S.mode === 'other') {
          payerId = S.payerId;
          if (payerId == null) { msg = '누가 냈는지 골라 줘'; return; }
        }
        const r = confirmCard(d, pid, { groupId: gid, attendeeIds: attendees, payerId, amount: amt, merchant: merchant.value, fixed: true }, app.today(), app.now());
        if (!r.ok) { msg = r.code === 'attendees' ? '같이 있던 사람을 골라 줘' : r.code === 'amount' ? '금액을 확인해 줘' : '참석자나 금액을 확인해 줘'; return; }
        result = r;
      }, { undo: true });
      if (msg) {
        // 실패했으면 이번 시도의 변경(새 모임 등)을 되돌린다
        store.undo();
        fail(msg); return false;
      }
      return snapshotBefore.length > 0;
    })();
    if (!ok) return;
    ctl.close({ saved: true });
    done({ kind: 'saved', result });
  }
  function dismiss() {
    store.update((d) => dismissCard(d, pid, app.today()), { undo: true });
    ctl.close({ saved: true });
    done({ kind: 'dismissed' });
  }

  redrawMode(); redrawGroups(); redrawPeople(); redrawPayer(); showSections();
  const key = nightKeyOf(db().payments, pid);
  panel.append(...[
    h('p', { class: 'flip-title', text: p0.merchant || (isGap ? '빠진 차수' : UI.untitledPay) }),
    isGap ? h('section', { class: 'sec' }, h('p', { class: 'lab', text: '누가 냈어?' }), modeBox) : null,
    h('section', { class: 'sec' }, h('p', { class: 'lab', text: '모임' }), groupBox, newGroupWrap),
    h('section', { class: 'sec' }, h('p', { class: 'lab', text: '같이 있던 사람' }), peopleBox, h('div', { class: 'inline-add' }, addName, h('button', { class: 'tbtn', type: 'button', text: '추가', onclick: addOne }))),
    (() => { payerSec.append(h('p', { class: 'lab', text: '결제한 사람' }), payerBox, h('div', { class: 'inline-add' }, payerName, h('button', { class: 'tbtn', type: 'button', text: '추가', onclick: addPayer }))); return payerSec; })(),
    !isGap ? h('section', { class: 'sec' }, h('p', { class: 'lab', text: '결제한 사람' }), h('p', { class: 'static', text: '나' })) : null,
    field(isGap ? '금액(선택)' : '금액', amount),
    field('가맹점 이름', merchant),
    errEl,
    h('button', { class: 'cta', type: 'button', text: '저장', onclick: save }),
    h('div', { class: 'back-row' },
      h('button', { class: 'tbtn', type: 'button', text: isGap ? '그 차수는 없었어' : '이 결제는 정산 아니야', onclick: dismiss }),
      key ? h('button', { class: 'tbtn', type: 'button', text: '그날 밤 보기', onclick: () => { ctl.close({ saved: false }); setTimeout(() => app.go(`#/night/${encodeURIComponent(key)}`), 80); } }) : null,
      h('button', { class: 'tbtn', type: 'button', text: '닫기', onclick: () => { ctl.close({ saved: false }); done({ kind: 'closed' }); } })),
  ].filter(Boolean));
}
