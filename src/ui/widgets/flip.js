import { h } from '../dom.js';

// 카드 뒤집기: 앞면(카드)이 90도까지 돌아 사라지고, 뒷면 패널이 -90도에서 0도로 돌아 나온다(각 260ms, 합쳐서 520ms).
// 뒷면은 입력칸이 많아 카드 크기에 안 들어가므로 화면 전체 크기 패널로 연다.
// 동작 줄이기에서는 돌지 않고 투명도 160ms로만 바뀐다.
export function openFlip(app, card, build, onClose) {
  const reduce = app.reduce();
  const scrim = h('div', { class: 'flip-scrim' });
  const panel = h('div', { class: 'flip-panel glass', role: 'dialog', 'aria-modal': 'true' });
  const wrap = h('div', { class: 'flip-wrap' }, scrim, panel);
  app.layer.appendChild(wrap);
  let closed = false;
  const rot = (deg) => { card.style.transition = reduce ? 'none' : 'transform 260ms var(--ease-in)'; card.style.transform = `perspective(1200px) rotateY(${deg}deg)`; };
  if (!reduce) rot(90);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const ctl = {
    panel,
    close({ saved = false } = {}) {
      if (closed) return; closed = true;
      wrap.classList.remove('open'); wrap.classList.add('closing');
      if (!saved && !reduce) { setTimeout(() => { card.style.transition = 'transform 260ms var(--ease-flip)'; card.style.transform = 'perspective(1200px) rotateY(0deg)'; }, 240); }
      setTimeout(() => { wrap.remove(); if (!saved) { card.style.transition = ''; card.style.transform = ''; } onClose && onClose({ saved }); }, reduce ? 160 : 520);
    },
  };
  build(panel, ctl);
  panel.setAttribute('tabindex', '-1');
  setTimeout(() => panel.focus({ preventScroll: true }), reduce ? 160 : 520);
  return ctl;
}
