import { CONFIG } from './config.js';
import { APP_BUILD } from './version.js';
import { createStore } from './store.js';
import { createRouter } from './ui/router.js';
import { createToast } from './ui/toast.js';
import { todayStr } from './core/date.js';
import { logOpen } from './core/actions.js';
import * as welcome from './ui/screens/welcome.js';
import * as main from './ui/screens/main.js';
import * as night from './ui/screens/night.js';
import * as ledger from './ui/screens/ledger.js';
import * as person from './ui/screens/person.js';
import * as ask from './ui/screens/ask.js';
import * as owes from './ui/screens/owes.js';
import * as add from './ui/screens/add.js';
import * as review from './ui/screens/review.js';
import * as groups from './ui/screens/groups.js';
import * as settings from './ui/screens/settings.js';
import * as backup from './ui/screens/backup.js';
import * as stats from './ui/screens/stats.js';
import * as licenses from './ui/screens/licenses.js';

const store = createStore(window.localStorage, {
  onError: () => { if (app.toast) app.toast.show('저장하지 못했어. 내보내기로 백업해 줘', { ms: 6000 }); },
});
const mql = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

const app = {
  cfg: CONFIG, build: APP_BUILD, store, session: {},
  layer: document.getElementById('layer'),
  today: () => todayStr(), now: () => Date.now(),
  reduce: () => document.documentElement.classList.contains('reduce'),
  say(msg) { const l = document.getElementById('live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); },
  go: (h) => router.go(h), back: () => router.back(), refresh: () => router.refresh(),
};
app.toast = createToast(app);

function applyMotion() {
  const on = store.db && store.db.settings.reduceMotion === 'on';
  document.documentElement.classList.toggle('reduce', on || !!(mql && mql.matches));
}
app.applyMotion = applyMotion;

// 화면이 안 보일 때는 배경 빛 번짐을 멈춘다
document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('paused', document.hidden));
const load = store.load();
applyMotion();
if (mql && mql.addEventListener) mql.addEventListener('change', applyMotion);
store.update((db) => logOpen(db, app.today()));
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* 결과는 무시 */ }

const screens = {
  '': (a) => main.render(a), welcome: (a) => welcome.render(a), night: (a, k) => night.render(a, k), ledger: (a) => ledger.render(a),
  person: (a, id) => person.render(a, id), ask: (a, id) => ask.render(a, id), owes: (a) => owes.render(a), add: (a) => add.render(a),
  review: (a) => review.render(a), groups: (a) => groups.render(a), settings: (a) => settings.render(a), backup: (a) => backup.render(a),
  stats: (a) => stats.render(a), licenses: (a) => licenses.render(a),
};
const router = createRouter(app, screens);

if (!store.db.settings.hint.welcomeDone && !location.hash.startsWith('#/welcome')) history.replaceState(null, '', '#/welcome');
router.start();
if (load.notice) setTimeout(() => app.toast.show(load.notice === 'recovered' ? '저장본이 깨져서 이전 판으로 복구했어' : '저장본이 깨져서 빈 장부로 시작했어', { ms: 6000 }), 600);

// 서비스 워커: 같은 주소 파일만 캐시. 새 판은 앱을 완전히 닫았다 열 때 적용된다.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => { try { reg.update(); } catch { /* 무시 */ } }).catch(() => {});
}
