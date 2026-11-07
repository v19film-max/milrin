// 서비스 워커: 같은 주소의 파일만 캐시한다. 다른 주소·GET이 아닌 요청은 건드리지 않는다.
// 새 판은 앱을 완전히 닫았다 열 때 적용된다(skipWaiting을 쓰지 않아 실행 중 파일이 섞이지 않는다).
const VERSION = '4w-001';
const CACHE = `mj-${VERSION}`;
const ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/screens.css',
  './css/motion.css',
  './lib/tool-calc.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/main.js',
  './src/config.js',
  './src/version.js',
  './src/copy.js',
  './src/store.js',
  './src/core/text.js',
  './src/core/date.js',
  './src/core/night.js',
  './src/core/split.js',
  './src/core/parse.js',
  './src/core/guess.js',
  './src/core/cards.js',
  './src/core/ledger.js',
  './src/core/actions.js',
  './src/core/headline.js',
  './src/core/stats.js',
  './src/core/db.js',
  './src/core/backup.js',
  './src/core/importer.js',
  './src/core/example.js',
  './src/ui/dom.js',
  './src/ui/router.js',
  './src/ui/toast.js',
  './src/ui/flows.js',
  './src/ui/cardback.js',
  './src/ui/widgets/card-stack.js',
  './src/ui/widgets/flip.js',
  './src/ui/widgets/hold.js',
  './src/ui/widgets/count.js',
  './src/ui/screens/welcome.js',
  './src/ui/screens/main.js',
  './src/ui/screens/night.js',
  './src/ui/screens/ledger.js',
  './src/ui/screens/person.js',
  './src/ui/screens/ask.js',
  './src/ui/screens/owes.js',
  './src/ui/screens/add.js',
  './src/ui/screens/review.js',
  './src/ui/screens/groups.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/backup.js',
  './src/ui/screens/stats.js',
  './src/ui/screens/licenses.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', ...ASSETS])));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('mj-')).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
