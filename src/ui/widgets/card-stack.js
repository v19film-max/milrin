import { h, icon, clear } from '../dom.js';
import { CONFIG } from '../../config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 추측 카드 더미. 판단과 저장은 hooks가 하고, 이 부품은 끌기·날려 보내기·올라오기만 맡는다.
// hooks: { getQueue()->[payment], face(p)->Node[], label(p)->string, onYes(p)->{flip?}, onNo(p), onLater(p), openBack(p, mode), emptyNode()->Node }
export function createCardStack(app, hooks, cfg = CONFIG) {
  const hint = (cls, name) => h('span', { class: `hint ${cls}`, 'aria-hidden': 'true' }, icon(name));
  const stack = h('div', { class: 'stack' },
    h('i', { class: 'glow l' }), h('i', { class: 'glow r' }), h('i', { class: 'glow u' }),
    hint('l', 'left'), hint('r', 'chev'), hint('u', 'up'));
  const back2 = h('div', { class: 'back-card b2' }), back1 = h('div', { class: 'back-card b1' });
  stack.append(back2, back1);
  const emptyHost = h('div', { class: 'stack-empty' });
  stack.append(emptyHost);
  let front = null, nx = null, busy = false, queue = [];

  const T = (ms) => (app.reduce() ? 160 : ms);

  function makeCard(p, role) {
    const c = h('article', { class: `card glass ${role === 'nx' ? 'nx' : ''}`.trim(), 'data-id': String(p.id) }, h('div', { class: 'face' }, hooks.face(p)));
    if (role === 'front') arm(c, p);
    else c.setAttribute('aria-hidden', 'true');
    return c;
  }
  function arm(c, p) {
    c.tabIndex = 0; c.setAttribute('role', 'group'); c.setAttribute('aria-label', hooks.label(p));
    // 보이지 않는 버튼 3개(스크린리더·키보드용, 초점을 받으면 보임)
    const btn = (t, cls, f) => h('button', { class: `kb ${cls}`, type: 'button', text: t, onclick: (e) => { e.stopPropagation(); f(); } });
    c.append(h('div', { class: 'kbs' },
      btn('아니야', 'l', () => commit('l')), btn('나중에', 'u', () => commit('u')), btn('맞아', 'r', () => commit('r'))));
    c.addEventListener('keydown', (e) => { if (e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); hooks.openBack(p, 'tap', c); } });
    let sx = 0, sy = 0, st = 0, lx = 0, ly = 0, lt = 0, vx = 0, vy = 0, id = null, drag = false, dx = 0, dy = 0;
    c.addEventListener('pointerdown', (e) => {
      if (busy || e.target.closest('.kb') || (e.button != null && e.button > 0)) return;
      id = e.pointerId; sx = lx = e.clientX; sy = ly = e.clientY; st = lt = e.timeStamp; vx = vy = 0; drag = false; dx = dy = 0;
      try { c.setPointerCapture(id); } catch { /* 무시 */ }
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      const dt = Math.max(1, e.timeStamp - lt);
      vx = 0.6 * vx + 0.4 * ((e.clientX - lx) / dt); vy = 0.6 * vy + 0.4 * ((e.clientY - ly) / dt);
      lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
      if (!drag && Math.hypot(dx, dy) >= 8) { drag = true; c.classList.add('dragging'); c.style.transition = 'none'; }
      if (!drag) return;
      const rot = clamp(dx * 0.06, -14, 14);
      c.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${rot}deg)`;
      const horiz = Math.abs(dx) >= Math.abs(dy);
      const pr = horiz ? clamp(dx / 96, 0, 1) : 0, pl = horiz ? clamp(-dx / 96, 0, 1) : 0, pu = horiz ? 0 : clamp(-dy / 80, 0, 1);
      stack.style.setProperty('--pr', pr.toFixed(3)); stack.style.setProperty('--pl', pl.toFixed(3)); stack.style.setProperty('--pu', pu.toFixed(3));
      stack.classList.toggle('hot-r', pr >= 1); stack.classList.toggle('hot-l', pl >= 1); stack.classList.toggle('hot-u', pu >= 1);
    });
    const end = (e, cancelled) => {
      if (e.pointerId !== id) return;
      id = null; c.classList.remove('dragging');
      if (!drag) { if (!cancelled) hooks.openBack(p, 'tap', c); return; }
      resetHints();
      let dir = null;
      if (!cancelled) {
        if (dx >= 96) dir = 'r'; else if (dx <= -96) dir = 'l'; else if (dy <= -80) dir = 'u';
        else {
          const speed = Math.hypot(vx, vy);
          if (speed >= 0.5 && Math.hypot(dx, dy) >= 40) dir = Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'r' : 'l') : (vy < 0 ? 'u' : null);
        }
      }
      if (dir) commit(dir, true); else spring(c);
    };
    c.addEventListener('pointerup', (e) => end(e, false));
    c.addEventListener('pointercancel', (e) => end(e, true));
  }
  function resetHints() {
    for (const k of ['--pr', '--pl', '--pu']) stack.style.setProperty(k, '0');
    stack.classList.remove('hot-r', 'hot-l', 'hot-u');
  }
  function spring(c) {
    c.style.transition = app.reduce() ? 'none' : 'transform 320ms var(--ease-spring)';
    c.style.transform = '';
  }
  function fly(c, dir, then) {
    busy = true;
    const ms = T(240);
    if (app.reduce()) { c.style.transition = `opacity ${ms}ms linear`; c.style.opacity = '0'; }
    else {
      c.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.9,.6), opacity ${ms}ms ease-in`;
      c.style.transform = dir === 'r' ? 'translate3d(560px,-30px,0) rotate(18deg)' : 'translate3d(0,-720px,0) rotate(0deg)';
      c.style.opacity = '0.6';
    }
    setTimeout(then, ms);
  }
  function commit(dir, fromDrag = false) {
    if (busy || !front) return;
    const p = queue[0];
    if (dir === 'l') {
      hooks.onNo(p);
      spring(front);
      setTimeout(() => hooks.openBack(p, 'left', front), app.reduce() ? 0 : 160);
      return;
    }
    if (dir === 'r') {
      const r = hooks.onYes(p);
      if (r && r.flip) { spring(front); setTimeout(() => hooks.openBack(p, 'right', front), app.reduce() ? 0 : 120); return; }
      fly(front, 'r', () => advance(r));
      return;
    }
    hooks.onLater(p);
    fly(front, 'u', () => advance(null));
  }

  function layers() {
    back2.hidden = queue.length < 3; back1.hidden = queue.length < 2;
    stack.classList.toggle('empty', queue.length === 0);
  }
  function showEmpty() {
    clear(emptyHost);
    emptyHost.append(hooks.emptyNode());
    emptyHost.classList.remove('in'); void emptyHost.offsetWidth; emptyHost.classList.add('in');
  }
  // 앞 카드를 치우고 다음 카드를 올린다
  function advance(result, { rise = true } = {}) {
    busy = false;
    const old = front;
    queue = hooks.getQueue();
    if (old) old.remove();
    front = null;
    const next = nx; nx = null;
    if (queue.length && next && next.dataset.id === String(queue[0].id)) {
      next.classList.remove('nx'); next.removeAttribute('aria-hidden');
      next.classList.add('rising');
      front = next; arm(front, queue[0]);
      setTimeout(() => front && front.classList.remove('rising'), T(360));
    } else if (queue.length) {
      front = makeCard(queue[0], 'front');
      stack.append(front);
      if (rise) front.classList.add('arrive');
      setTimeout(() => front && front.classList.remove('arrive'), T(400));
    }
    if (queue.length > 1) { nx = makeCard(queue[1], 'nx'); stack.insertBefore(nx, front); }
    layers();
    if (!queue.length) showEmpty(); else clear(emptyHost);
    hooks.onAdvance && hooks.onAdvance(result, queue);
  }
  function mount() {
    for (const c of stack.querySelectorAll('.card')) c.remove();
    front = nx = null; busy = false;
    queue = hooks.getQueue();
    if (queue.length) { front = makeCard(queue[0], 'front'); stack.append(front); }
    if (queue.length > 1) { nx = makeCard(queue[1], 'nx'); stack.insertBefore(nx, front); }
    layers();
    if (!queue.length) showEmpty(); else clear(emptyHost);
  }
  mount();
  return {
    el: stack,
    get front() { return front; },
    get size() { return queue.length; },
    advance, mount,
    // 카드를 닫지 않고 데이터가 바뀐 뒤 다시 그린다
    refresh(opts) { advance(null, opts); },
    focusId(id) {
      const q = hooks.getQueue();
      return q.length && q[0].id === id;
    },
  };
}
