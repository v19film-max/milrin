// 화면 조립 도우미. 글자는 항상 textContent/텍스트 노드로만 넣는다(innerHTML 사용 금지).
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style') throw new Error('style 속성은 쓰지 않는다(CSP)');
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function icon(name, cls = '') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', `ic ${cls}`.trim());
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVG_NS, 'use');
  u.setAttribute('href', `#i-${name}`);
  s.appendChild(u);
  return s;
}
export const backButton = (app) => h('button', { class: 'back', type: 'button', 'aria-label': '뒤로', onclick: () => app.back() }, icon('left'));
export const nav = (app, right) => h('div', { class: 'nav' }, backButton(app), right ? h('div', { class: 'nav-r' }, right) : null);

// 켜고 끄는 선택칸(체크 표시 포함, 색만으로 구분하지 않음)
export function chip(label, pressed, onToggle, { role = 'button' } = {}) {
  const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!pressed) }, icon('check'), label);
  b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); onToggle(v, b); });
  return b;
}
export function setChip(b, v) { b.setAttribute('aria-pressed', String(!!v)); }

// 한글 조합 중에는 Enter를 무시하고, 입력이 끝난 값만 읽는다
export function textInput(props = {}, { onEnter } = {}) {
  const el = h('input', { class: 'inp', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...props });
  let composing = false;
  el.addEventListener('compositionstart', () => { composing = true; });
  el.addEventListener('compositionend', () => { composing = false; });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (composing || e.isComposing) return; e.preventDefault(); if (onEnter) onEnter(); } });
  return el;
}
export const field = (label, input, extra) => h('label', { class: 'field' }, h('span', { text: label }), input, extra);
export const won = (n) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// 클립보드: 눌림 이벤트 안에서 동기적으로 시작해야 한다(홈 화면 앱)
export function copyText(text, fallbackEl) {
  let p;
  try { p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('none')); } catch (e) { p = Promise.reject(e); }
  return p.then(() => true).catch(() => {
    try {
      if (fallbackEl) { fallbackEl.focus(); fallbackEl.select(); fallbackEl.setSelectionRange(0, 99999); }
      return !!(fallbackEl && document.execCommand && document.execCommand('copy'));
    } catch { return false; }
  });
}
