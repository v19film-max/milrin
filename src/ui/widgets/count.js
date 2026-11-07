// 금액 이어 세기 400ms. 동작 줄이기에서는 바로 바꾼다.
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// 아주 큰 금액은 글자를 줄여 한 줄에 들어오게 한다
const fit = (el, text) => { const box = el.closest('.amount, .owe'); if (box) box.classList.toggle('long', text.length >= 10); };
export function countTo(app, el, from, to, ms = 400) {
  if (el._raf) cancelAnimationFrame(el._raf);
  clearTimeout(el._to);
  if (app.reduce() || from === to) { el.textContent = fmt(to); fit(el, fmt(to)); return; }
  fit(el, fmt(to));
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(step); else el._raf = 0;
  };
  el._raf = requestAnimationFrame(step);
  // 화면 갱신이 멈춰도 끝 값은 반드시 맞게
  clearTimeout(el._to);
  el._to = setTimeout(() => { if (el._raf) { cancelAnimationFrame(el._raf); el._raf = 0; } el.textContent = fmt(to); fit(el, fmt(to)); }, ms + 60);
}
