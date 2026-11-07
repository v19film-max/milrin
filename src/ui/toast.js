import { h } from './dom.js';

// 토스트: 한 번에 하나. 올라옴 200ms / 사라짐 180ms. undo를 주면 "되돌리기" 버튼을 둔다.
export function createToast(app) {
  let cur = null, timer = null;
  function remove(node, instant) {
    if (!node || !node.parentNode) return;
    if (instant) { node.remove(); return; }
    node.classList.add('out');
    setTimeout(() => node.remove(), 180);
  }
  function hide() { clearTimeout(timer); const n = cur; cur = null; remove(n); }
  function show(lines, { undo = null, ms = 4000, label = '되돌리기' } = {}) {
    clearTimeout(timer);
    remove(cur, true);
    const list = Array.isArray(lines) ? lines : [lines];
    const node = h('div', { class: 'toast glass', role: 'status' },
      h('div', { class: 'toast-t' }, list.map((t, i) => h('p', { class: i ? 'sub' : '', text: t }))),
      undo ? h('button', { class: 'tbtn toast-undo', type: 'button', text: label, onclick: () => { hide(); undo(); } }) : null);
    app.layer.appendChild(node);
    cur = node;
    app.say(list.join(' '));
    timer = setTimeout(() => { if (cur === node) hide(); }, ms);
    return hide;
  }
  return { show, hide };
}

// 시트: 아래에서 420ms 솟기, 닫기 260ms
export function openSheet(app, build) {
  const scrim = h('div', { class: 'scrim' });
  const panel = h('div', { class: 'sheet glass', role: 'dialog', 'aria-modal': 'true' });
  const wrap = h('div', { class: 'sheet-wrap' }, scrim, panel);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    wrap.classList.add('closing');
    setTimeout(() => { wrap.remove(); document.removeEventListener('keydown', onKey); }, 260);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  build(panel, close);
  app.layer.appendChild(wrap);
  panel.setAttribute('tabindex', '-1');
  setTimeout(() => panel.focus({ preventScroll: true }), 60);
  return close;
}
