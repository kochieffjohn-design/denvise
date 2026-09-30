/*
 * Service worker Denvise: приложение запускается без интернета.
 *
 * Что кешируется:
 *   - оболочка: index.html и JS-бандл (в бандле весь бесплатный контент — data/*.ts);
 *   - шрифты иконок, картинки, манифест, иконки PWA — по мере первого использования.
 * Что НЕ кешируется: запросы на другие домены (шлюз ДентИИ / ИИ-Пациента) —
 * без сети они просто не проходят, экраны показывают ошибку.
 *
 * Обновления: страница (index.html) всегда сначала запрашивается из сети,
 * кеш — только если сети нет. Поэтому новая версия приходит при первом же
 * запуске онлайн, а не «застревает» в кеше. Файлы в /_expo/static/ и /assets/
 * имеют хеш в имени, их безопасно отдавать из кеша сразу.
 */
const VERSION = 'v1';
const CACHE = `denvise-${VERSION}`;
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cacheShell(cache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('denvise-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API шлюза и прочие домены — мимо

  if (req.mode === 'navigate') {
    event.respondWith(navigationResponse(event));
    return;
  }
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(staleWhileRevalidate(event, req));
});

/**
 * Кладёт в кеш index.html и все скрипты/стили, на которые он ссылается.
 * Уже закешированные файлы не скачиваются повторно (имена с хешем).
 * `res` — уже полученный ответ на index.html, если есть.
 */
async function cacheShell(cache, res) {
  if (!res) res = await fetch(SHELL_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`shell ${res.status}`);
  const html = await res.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="(\/_expo\/static\/[^"]+)"/g)].map((m) => m[1]);
  const missing = [];
  for (const a of assets) if (!(await cache.match(a))) missing.push(a);
  await cache.addAll(missing);
  // index.html кладём последним: он не должен ссылаться на бандл, которого нет в кеше
  await cache.put(SHELL_URL, res);
  await pruneOldBundles(cache, assets);
}

/** Удаляет из кеша бандлы прошлых версий — они больше никому не нужны. */
async function pruneOldBundles(cache, current) {
  const keep = new Set(current.map((p) => new URL(p, self.location.origin).href));
  for (const req of await cache.keys()) {
    if (new URL(req.url).pathname.startsWith('/_expo/static/') && !keep.has(req.url)) {
      await cache.delete(req);
    }
  }
}

async function navigationResponse(event) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(event.request);
    if (res.ok) {
      // Любой путь SPA отдаёт один и тот же index.html — храним его под '/'.
      // Бандлы новой версии докачиваем в фоне, чтобы и она работала офлайн.
      event.waitUntil(cacheShell(cache, res.clone()).catch(() => {}));
    }
    return res;
  } catch {
    const cached = await cache.match(SHELL_URL);
    return cached || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}
