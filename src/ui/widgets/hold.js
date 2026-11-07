import { h } from '../dom.js';

// 길게 누르기. 처음 ignore ms는 무시(오탭 방지), 누르는 동안 글자색이 라임으로 차오름(--p 0~1),
// 400ms 뒤부터 떨림, ms 전에 떼면 아무 일 없음. 키보드·보조 기술은 두 번 눌러 "받은 거 맞아?" 확인으로 대신한다.
export function attachHold(app, btn, { ms, ignore = 0, onDone, onAlt }) {
  let t0 = 0, raf = 0, active = false, lastClick = 0, doneT = 0, shakeT = 0;
  const reset = () => { active = false; cancelAnimationFrame(raf); clearTimeout(doneT); clearTimeout(shakeT); btn.classList.remove('holding', 'shaking'); btn.style.setProperty('--p', '0'); };
  // 글자색이 차오르는 것은 화면 갱신(rAF)으로, 끝나는 시점은 타이머로 정해 화면 갱신이 느려져도 700ms에 끝난다
  const tick = (t) => {
    if (!active) return;
    const el = t - t0;
    btn.style.setProperty('--p', String(Math.max(0, Math.min(1, (el - ignore) / (ms - ignore)))));
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    reset();
    active = true; t0 = performance.now(); btn.classList.add('holding'); raf = requestAnimationFrame(tick);
    shakeT = setTimeout(() => { if (active && !app.reduce()) btn.classList.add('shaking'); }, 400);
    doneT = setTimeout(() => { if (!active) return; reset(); btn.dataset.held = '1'; onDone(); }, ms);
    try { btn.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => { if (active) reset(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    if (btn.dataset.held) { delete btn.dataset.held; return; }
    const now = performance.now();
    const keyboard = e.detail === 0;
    if (keyboard || now - lastClick < 600) { lastClick = 0; if (onAlt) onAlt(); } else lastClick = now;
  });
  return { reset };
}
export const holdLabel = (text, cls = '') => h('span', { class: `hold-label ${cls}`.trim(), text });
