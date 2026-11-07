import { h, nav, chip, setChip, textInput, won } from '../dom.js';
import { UI } from '../../copy.js';
import { addPayments, addMovedEntries } from '../../core/importer.js';
import { nameKey, cleanText } from '../../core/text.js';
import { isValidDay, splitAt } from '../../core/date.js';
import { moneyOf } from './add.js';

export function render(app) {
  const store = app.store;
  const R = app.session.review;
  if (!R || !R.lines.length) return h('div', { class: 'page' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '읽은 줄' }), h('p', { text: UI.noLines })));
  const rows = R.lines.map((l) => {
    if (R.mode === 'pay') {
      const v = l.values; const s = v.at ? splitAt(v.at) : { day: '', time: null };
      return { l, on: l.ok && !l.dup, autoOff: !l.ok, dup: l.dup, date: s.day || '', time: s.time || '', merchant: v.merchant, amount: v.amount == null ? '' : String(v.amount), bad: new Set(l.bad) };
    }
    const v = l.values;
    const m = store.db.people.filter((p) => nameKey(p.name) === nameKey(v.name));
    return { l, on: l.ok, autoOff: !l.ok, name: v.name, merchant: v.merchant, amount: v.amount == null ? '' : String(v.amount), date: v.day || '', cands: m.map((p) => p.id), pickIdx: m.length ? 0 : -1, bad: new Set(l.bad) };
  });
  const cta = h('button', { class: 'cta', type: 'button' });
  const info = h('p', { class: 'note review-info' });
  const valid = (r) => {
    const bad = new Set();
    const a = moneyOf(r.amount);
    if (a == null || Number.isNaN(a)) bad.add('amount');
    if (!isValidDay(r.date)) bad.add('date');
    if (R.mode === 'move' && !cleanText(r.name || '')) bad.add('name');
    r.bad = bad;
    return bad.size === 0;
  };
  function recount() {
    let n = 0, skipped = 0;
    for (const r of rows) { if (!r.on) continue; if (valid(r)) n++; else skipped++; }
    cta.textContent = `담기 (${n}건)`;
    cta.disabled = n === 0;
    info.textContent = skipped ? UI.skipBad : '';
    return n;
  }
  const els = rows.map((r, i) => {
    const mark = (inp, key) => inp.classList.toggle('bad', r.bad.has(key));
    const mk = (key, props) => { const inp = textInput({ ...props }); inp.value = r[key]; inp.addEventListener('input', () => { r[key] = inp.value; refresh(); mark(inp, key); }); return inp; };
    // 못 읽어서 꺼져 있던 줄은 고쳐서 읽히게 되면 켠다
    const refresh = () => { const was = valid(r); if (was && r.autoOff && !r.touchedOn) { r.on = true; setChip(c, true); } recount(); status(); };
    const date = h('input', { class: 'inp', type: 'date', value: r.date, 'aria-label': '날짜' });
    date.addEventListener('change', () => { r.date = date.value; refresh(); mark(date, 'date'); });
    const amount = mk('amount', { inputmode: 'numeric', 'aria-label': '금액', placeholder: '금액' });
    const merchant = mk('merchant', { 'aria-label': '가맹점', placeholder: '가게 이름' });
    const statusEl = h('span', { class: 'rv-st' });
    const multi = r.l.warnings && r.l.warnings.includes('multiAmount');
    const status = () => { statusEl.textContent = r.dup && !r.on ? UI.already : (r.bad.size ? UI.cantRead : multi ? UI.multiAmount : ''); statusEl.classList.toggle('amber', r.bad.size > 0 || r.dup || !!multi); };
    const fields = [];
    let time = null, nameI = null, who = null;
    if (R.mode === 'pay') { time = h('input', { class: 'inp', type: 'time', value: r.time, 'aria-label': '시각' }); time.addEventListener('change', () => { r.time = time.value; }); fields.push(date, time, merchant, amount); }
    else {
      nameI = mk('name', { 'aria-label': '이름', placeholder: '이름' });
      fields.push(nameI, amount, merchant, date);
      who = h('button', { class: 'tbtn', type: 'button' });
      const paintWho = () => { if (!r.cands.length) { who.hidden = true; return; } who.hidden = false; const x = store.db.people.find((p) => p.id === r.cands[r.pickIdx]); who.textContent = r.pickIdx >= 0 && x ? `기존 ${x.name}에 넣기` : '새 사람'; };
      who.addEventListener('click', () => { r.pickIdx = r.pickIdx + 1 >= r.cands.length ? -1 : r.pickIdx + 1; if (r.pickIdx === -1 && false) r.pickIdx = 0; paintWho(); });
      paintWho();
      nameI.addEventListener('input', () => { const m = store.db.people.filter((p) => nameKey(p.name) === nameKey(r.name)); r.cands = m.map((p) => p.id); r.pickIdx = m.length ? 0 : -1; paintWho(); });
    }
    const c = chip('', r.on, (v) => { r.on = v; r.touchedOn = true; recount(); status(); });
    c.setAttribute('aria-label', `${i + 1}번째 줄 담기`);
    valid(r);
    [['amount', amount], ['date', date], ['merchant', merchant]].forEach(([k, el]) => { if (r.bad.has(k) || (k === 'date' && !r.date && r.bad.has('date'))) el.classList.add('bad'); });
    if (nameI && r.bad.has('name')) nameI.classList.add('bad');
    status();
    const cls = ['rv', r.dup ? 'dup' : '', r.bad.size ? 'badrow' : ''].filter(Boolean).join(' ');
    return h('div', { class: `${cls} panel row-in` }, h('div', { class: 'rv-h' }, c, h('span', { class: 'rv-n num', text: `${i + 1}줄` }), statusEl, who), h('div', { class: 'rv-f' }, fields));
  });
  function submit() {
    const ok = rows.filter((r) => r.on && valid(r));
    if (!ok.length) return;
    store.update((d) => {
      if (R.mode === 'pay') {
        addPayments(d, ok.map((r) => { const m = moneyOf(r.amount); return { at: r.time ? `${r.date}T${r.time}` : r.date, merchant: r.merchant, amount: m }; }), 'paste', app.now());
      } else {
        addMovedEntries(d, ok.map((r) => ({ personId: r.pickIdx >= 0 ? r.cands[r.pickIdx] : undefined, name: r.name, amount: moneyOf(r.amount), merchant: r.merchant, day: r.date, priorAsk: R.priorAsk })), app.now());
      }
    }, { undo: true });
    app.session.review = null;
    app.session.rise = R.mode === 'pay';
    app.go('#/');
  }
  cta.onclick = submit;
  recount();
  void won;
  return h('div', { class: 'page review' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '읽은 줄 확인' }), h('p', { text: R.warnings && R.warnings.includes('limit') ? UI.limitLines : UI.reviewSub })),
    h('div', { class: 'rv-list' }, els), info, cta);
}
