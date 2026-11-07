import { h, nav, chip, icon } from '../dom.js';
import { UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { APP_BUILD } from '../../version.js';
import { attachHold, holdLabel } from '../widgets/hold.js';
import { confirmSheet } from '../flows.js';
import { exampleCounts, hasExample, clearExample } from '../../core/example.js';

export function render(app) {
  const store = app.store;
  const go = (hash) => () => app.go(hash);
  const link = (label, hash, value) => h('button', { class: 'setrow', type: 'button', onclick: go(hash) }, h('span', { text: label }), value ? h('span', { class: 'sv', text: value }) : null, icon('chev', 'sm'));
  const rows = [];
  rows.push(link('모임', '#/groups'), link('통계', '#/stats'), link('내보내기·불러오기', '#/backup'), link('첫 안내 다시 보기', '#/welcome'));

  const mot = h('div', { class: 'setrow static' }, h('span', { text: '동작 줄이기' }));
  const chips = h('div', { class: 'chips' });
  const paintMot = () => {
    chips.replaceChildren();
    for (const [v, l] of [['auto', '자동'], ['on', '켜기']]) {
      const b = chip(l, store.db.settings.reduceMotion === v, () => { store.update((d) => { d.settings.reduceMotion = v; }); app.applyMotion(); paintMot(); });
      b.setAttribute('aria-pressed', String(store.db.settings.reduceMotion === v)); chips.append(b);
    }
  };
  paintMot(); mot.append(chips); rows.push(mot);

  const code = h('input', { class: 'inp code', type: 'text', maxlength: '6', value: store.db.settings.testerCode, 'aria-label': '테스터 코드', autocomplete: 'off', autocapitalize: 'off' });
  code.addEventListener('change', () => { code.value = code.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6); store.update((d) => { d.settings.testerCode = code.value; }); });
  rows.push(h('div', { class: 'setrow static' }, h('span', { text: '테스터 코드' }), code));

  if (hasExample(store.db)) {
    rows.push(h('button', { class: 'setrow', type: 'button', onclick: () => {
      const c = exampleCounts(store.db);
      confirmSheet(app, { lines: [UI.exClear, `사람 ${c.people} · 모임 ${c.groups} · 결제 ${c.payments} · 건 ${c.entries}`], okLabel: '지우기', onOk: () => {
        store.update((d) => clearExample(d), { undo: true });
        app.toast.show(UI.exCleared, { undo: () => { store.undo(); app.refresh(); }, ms: CONFIG.UNDO_SEC * 1000 });
        app.refresh();
      } });
    } }, h('span', { text: '예시 지우기' }), icon('chev', 'sm')));
  }
  rows.push(link('오픈소스 고지', '#/licenses'));
  const reload = h('button', { class: 'tbtn', type: 'button', text: '앱 새로고침', onclick: async () => {
    try {
      const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      for (const r of regs) await r.unregister();
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    } catch { /* 장부 데이터는 건드리지 않는다 */ }
    location.reload();
  } });
  rows.push(h('div', { class: 'setrow static' }, h('span', { text: '앱 판 번호' }), h('span', { class: 'sv num', text: APP_BUILD }), reload));

  const wipe = h('button', { class: 'setrow hold danger', type: 'button', 'aria-label': '모두 지우기. 1.5초 길게 눌러' }, holdLabel('모두 지우기'), h('span', { class: 'sv', text: UI.wipeHint }));
  attachHold(app, wipe, { ms: CONFIG.HOLD_ALL_MS, ignore: CONFIG.HOLD_IGNORE_MS, onDone: () => {
    store.clearAll(); app.session = {}; app.applyMotion();
    history.replaceState(null, '', '#/welcome'); app.refresh();
  }, onAlt: () => confirmSheet(app, { lines: [UI.wipeAsk], okLabel: '모두 지우기', onOk: () => { store.clearAll(); app.applyMotion(); history.replaceState(null, '', '#/welcome'); app.refresh(); } }) });
  rows.push(wipe);
  return h('div', { class: 'page settings' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '설정' })), h('div', { class: 'panel set-list stagger' }, rows));
}
