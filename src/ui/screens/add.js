import { h, nav, field, textInput, chip, icon, won } from '../dom.js';
import { UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { addPayments, addMovedEntries } from '../../core/importer.js';
import { parseMoney, parsePayLines, parseMoveLines, markDuplicates } from '../../core/parse.js';
import { cleanText, nameKey } from '../../core/text.js';
import { isValidDay, diffDays } from '../../core/date.js';

export function moneyOf(raw) {
  const t = cleanText(raw).replace(/[,원\s]/g, '');
  if (!t) return null;
  if (/^\d{1,10}$/.test(t)) { const n = Number(t); return n >= 1 && n <= CONFIG.MAX_AMOUNT ? n : NaN; }
  return parseMoney(raw);
}

export function render(app) {
  const store = app.store, today = app.today();
  const pre = app.session.addPrefill || null; app.session.addPrefill = null;
  let tab = 'pay';
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', { class: 'tab-body' });
  const tabBtn = (id, label) => h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { if (tab === id) return; tab = id; paintTabs(); paintBody(true); } }, label);
  function paintTabs() { tabs.replaceChildren(tabBtn('pay', '결제'), tabBtn('move', '못 받은 돈 옮기기'), h('i', { class: `tab-ink ${tab}` })); }

  // ----- 결제 탭 -----
  function payForm() {
    let payer = pre && pre.payer === 'other' ? 'other' : 'me';
    const date = h('input', { class: 'inp', type: 'date', value: pre ? pre.day : today, 'aria-label': '날짜' });
    const time = h('input', { class: 'inp', type: 'time', 'aria-label': '시각(선택)' });
    const merchant = textInput({ placeholder: '가게 이름(선택)', maxlength: '60', 'aria-label': '가맹점' });
    const amount = textInput({ inputmode: 'numeric', placeholder: '금액', 'aria-label': '금액' });
    const err = h('p', { class: 'err', role: 'alert' });
    const warn = h('p', { class: 'err' });
    const payerBox = h('div', { class: 'chips' });
    const paintPayer = () => { payerBox.replaceChildren(
      ...[['me', '나'], ['other', '다른 사람']].map(([v, l]) => { const b = chip(l, payer === v, () => { payer = v; paintPayer(); hint(); }); b.setAttribute('aria-pressed', String(payer === v)); return b; })); };
    const hint = () => { amount.setAttribute('placeholder', payer === 'other' ? '금액(모르면 비워 둬)' : '금액'); time.setAttribute('aria-required', String(payer === 'other')); };
    date.addEventListener('change', () => { warn.textContent = isValidDay(date.value) && diffDays(date.value, today) > 0 ? UI.futureDay : ''; });
    paintPayer(); hint();
    function submit() {
      err.textContent = '';
      if (!isValidDay(date.value)) return void (err.textContent = UI.dayCheck);
      const amt = moneyOf(amount.value);
      if (payer === 'me' && (amt == null || Number.isNaN(amt))) return void (err.textContent = UI.amountCheck);
      if (payer === 'other' && amt != null && Number.isNaN(amt)) return void (err.textContent = UI.amountCheck);
      if (payer === 'other' && !time.value) return void (err.textContent = UI.timeNeed);
      const mer = cleanText(merchant.value);
      if (Array.from(mer).length > CONFIG.MAX_MERCHANT) return void (err.textContent = UI.merchantLong);
      const at = time.value ? `${date.value}T${time.value}` : date.value;
      let r;
      store.update((d) => { r = addPayments(d, [{ at, merchant: mer, amount: amt, kind: payer === 'other' ? 'gap' : 'card' }], 'manual', app.now()); }, { undo: true });
      if (!r.added.length) return void (err.textContent = UI.amountCheck);
      app.session.rise = true;
      app.go('#/');
    }
    const paste = pasteBox('pay');
    return [field('날짜', date, warn), field('시각(선택)', time), field('가맹점(선택)', merchant), field('금액', amount),
      h('div', { class: 'field' }, h('span', { text: '결제한 사람' }), payerBox), err,
      h('button', { class: 'cta', type: 'button', text: '추가', onclick: submit }), paste];
  }

  // ----- 옮기기 탭 -----
  function moveForm() {
    let prior = true, pick = null;
    const name = textInput({ placeholder: '이름', maxlength: '40', 'aria-label': '이름' });
    const amount = textInput({ inputmode: 'numeric', placeholder: '1인 몫', 'aria-label': '금액(1인 몫)' });
    const merchant = textInput({ placeholder: '가게 이름(선택)', maxlength: '60', 'aria-label': '가맹점' });
    const date = h('input', { class: 'inp', type: 'date', value: today, 'aria-label': '날짜' });
    const err = h('p', { class: 'err', role: 'alert' });
    const cands = h('div', { class: 'chips cands' });
    const matches = () => store.db.people.filter((p) => nameKey(p.name) === nameKey(name.value));
    const paintC = () => {
      cands.replaceChildren();
      const m = matches();
      if (!m.length) { pick = null; return; }
      if (pick == null || (pick !== 'new' && !m.some((x) => x.id === pick))) pick = m.length === 1 ? m[0].id : null;
      for (const x of m) { const b = chip(`기존 ${x.name}`, pick === x.id, () => { pick = x.id; paintC(); }); b.setAttribute('aria-pressed', String(pick === x.id)); cands.append(b); }
      const nb = chip('새 사람', pick === 'new', () => { pick = 'new'; paintC(); }); nb.setAttribute('aria-pressed', String(pick === 'new')); cands.append(nb);
    };
    name.addEventListener('input', paintC);
    const priorChip = chip('이미 카톡 등으로 요청한 적 있어', true, (v) => { prior = v; });
    function submit() {
      err.textContent = '';
      const nm = cleanText(name.value);
      if (!nm) return void (err.textContent = UI.nameNeed);
      const amt = moneyOf(amount.value);
      if (amt == null || Number.isNaN(amt)) return void (err.textContent = UI.amountCheck);
      if (!isValidDay(date.value)) return void (err.textContent = UI.dayCheck);
      const m = matches();
      if (m.length > 1 && pick == null) return void (err.textContent = UI.pickPerson);
      const personId = pick === 'new' ? undefined : (pick != null ? pick : (m.length === 1 ? m[0].id : undefined));
      store.update((d) => { addMovedEntries(d, [{ personId, name: nm, amount: amt, merchant: merchant.value, day: date.value, priorAsk: prior }], app.now()); }, { undo: true });
      app.go('#/ledger');
    }
    return [field('이름', name, cands), field('금액(1인 몫)', amount), field('가맹점(선택)', merchant), field('날짜', date),
      h('div', { class: 'field' }, priorChip), err, h('button', { class: 'cta', type: 'button', text: '추가', onclick: submit }), pasteBox('move', () => prior)];
  }

  // ----- 여러 줄 붙여넣기 -----
  function pasteBox(mode, priorFn) {
    const ta = h('textarea', { class: 'inp', rows: '5', placeholder: mode === 'pay' ? '10/12 22:10 을지로 곱창 84,000' : '철수 21000 곱창 10/12', 'aria-label': '여러 줄 붙여넣기' });
    const err = h('p', { class: 'err', role: 'alert' });
    const wrap = h('div', { class: 'paste-wrap' }, h('div', { class: 'paste-in' }, ta, err,
      h('button', { class: 'cta', type: 'button', text: '읽기', onclick: () => {
        const t = ta.value;
        const r = mode === 'pay' ? parsePayLines(t, today) : parseMoveLines(t, today);
        if (!r.lines.length) { err.textContent = UI.noLines; return; }
        if (mode === 'pay') markDuplicates(r.lines, store.db.payments);
        app.session.review = { mode, lines: r.lines, warnings: r.warnings, priorAsk: priorFn ? priorFn() : true };
        app.go('#/review');
      } })));
    const t = h('button', { class: 'tbtn paste-t', type: 'button', 'aria-expanded': 'false', onclick: () => { const o = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', String(o)); wrap.classList.toggle('open', o); if (o) setTimeout(() => ta.focus({ preventScroll: true }), 260); } }, '여러 건 붙여넣기', icon('down', 'sm'));
    return h('div', { class: 'paste' }, t, wrap);
  }

  function paintBody(animate) {
    body.replaceChildren(...(tab === 'pay' ? payForm() : moveForm()));
    if (animate) { body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap'); }
  }
  paintTabs(); paintBody(false);
  void won;
  return h('div', { class: 'page add' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '결제 추가' })), tabs, body);
}
