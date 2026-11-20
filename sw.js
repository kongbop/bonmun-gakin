// 본문 각인 오프라인 지원.
// 앱 파일은 설치할 때 미리 저장하고, 이후에는 저장본을 바로 보여 주면서 뒤에서 새 버전을 받아 둔다.
// 새 버전은 그다음에 앱을 열 때 반영된다.
const VERSION = 'v1';
const APP_CACHE = 'bonmun-app-' + VERSION;
const FONT_CACHE = 'bonmun-fonts';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('bonmun-app-') && k !== APP_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 글꼴: 한 번 받은 글꼴은 저장본을 쓴다. 오프라인에서 처음 보는 글꼴은 기기 기본 글꼴로 대신 보인다.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }).catch(() => new Response('', { status: 503 })))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 앱 파일: 저장본을 바로 주고, 온라인이면 뒤에서 새 버전으로 바꿔 둔다.
  event.respondWith(
    caches.open(APP_CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const fresh = fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        if (hit) {
          event.waitUntil(fresh);
          return hit;
        }
        return fresh.then(res => res ||
          (req.mode === 'navigate' ? cache.match('./index.html') : new Response('', { status: 504 })));
      })
    )
  );
});
