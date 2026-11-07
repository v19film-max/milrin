// 해시 주소 라우터. 알려진 경로 이름 외의 값(?와 추가 조각)은 무시하고, 모르는 주소는 메인으로 보낸다.
// 전환은 직접 클래스로: 앞으로 = 오른쪽에서 28px 밀려 들어옴 320ms, 이전 화면은 -12px 밀리며 어두워짐. 뒤로는 반대.
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = raw.split('/');
  let name = parts[0] || '', arg = parts[1] || '';
  try { arg = decodeURIComponent(arg); } catch { arg = ''; }
  return { name, arg };
}
const WITH_ARG = new Set(['night', 'person', 'ask']);
export function canonical(route, known) {
  if (!known.has(route.name)) return '#/';
  if (WITH_ARG.has(route.name)) return route.arg ? `#/${route.name}/${encodeURIComponent(route.arg)}` : '#/';
  return route.name ? `#/${route.name}` : '#/';
}

export function createRouter(app, screens) {
  const host = document.getElementById('screens');
  const known = new Set(Object.keys(screens));
  const stack = [];
  let current = null, first = true, token = 0;

  function show() {
    const route = parseHash(location.hash);
    const canon = canonical(route, known);
    if (canon !== (location.hash || '#/')) { history.replaceState(null, '', canon); }
    if (stack.length && stack[stack.length - 1] === canon) return;
    let dir = 'fwd';
    if (canon === '#/') { dir = stack.length > 1 || (stack.length === 1 && stack[0] !== '#/') ? 'back' : 'fade'; stack.length = 0; stack.push(canon); }
    else if (stack.length >= 2 && stack[stack.length - 2] === canon) { stack.pop(); dir = 'back'; }
    else stack.push(canon);
    if (first) dir = 'fade';
    first = false;
    const name = known.has(route.name) ? route.name : '';
    const page = screens[name](app, route.arg);
    const mode = app.reduce() ? 'fade' : dir;
    page.classList.add(`enter-${mode}`);
    host.appendChild(page);
    const old = current; current = page;
    if (old) {
      old.classList.add(`leave-${mode}`);
      const mine = ++token;
      setTimeout(() => { if (old.destroy) old.destroy(); old.remove(); }, mode === 'fade' ? 200 : 360);
      void mine;
    }
    page.scrollTop = 0;
    const h1 = page.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); }
  }
  window.addEventListener('hashchange', show);
  return {
    start() { show(); },
    go(hash) { if ((location.hash || '#/') === hash) { return; } location.hash = hash; },
    back() {
      if (stack.length > 1) location.hash = stack[stack.length - 2];
      else location.hash = '#/';
    },
    depth: () => stack.length,
    // 같은 화면을 데이터가 바뀐 채로 다시 그린다(투명도 전환)
    refresh() {
      const route = parseHash(location.hash);
      const name = known.has(route.name) ? route.name : '';
      const page = screens[name](app, route.arg);
      page.classList.add('enter-fade');
      host.appendChild(page);
      const old = current; current = page;
      if (old) { old.classList.add('leave-fade'); setTimeout(() => { if (old.destroy) old.destroy(); old.remove(); }, 200); }
    },
  };
}
