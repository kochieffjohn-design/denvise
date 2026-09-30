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
const VERSION = 'v4';
const CACHE = `denvise-${VERSION}`;
const SHELL_URL = '/';
// Нужны для запуска установленного приложения; имена без хеша.
const APP_FILES = ['/manifest.webmanifest', '/favicon.png', '/apple-touch-icon.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cacheShell(cache);
      await cache.addAll(APP_FILES);
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

/*
 * Файлы, которые страница успела загрузить до того, как service worker начал
 * перехватывать запросы (при самом первом запуске), — прежде всего шрифты
 * иконок. Без них офлайн-запуск падал: страница присылает их список сама
 * (см. регистрацию в index.html).
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  // Страница вернулась из фона (iOS не перезапускает PWA) — проверяем, нет ли новой версии
  if (data && data.type === 'check-update') {
    event.waitUntil(caches.open(CACHE).then((cache) => cacheShell(cache)).catch(() => {}));
    return;
  }
  if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const u of data.urls) {
        const url = new URL(u, self.location.origin);
        if (url.origin !== self.location.origin) continue;
        if (!url.pathname.startsWith('/_expo/static/') && !url.pathname.startsWith('/assets/')) continue;
        if (await cache.match(url.href)) continue;
        try {
          const res = await fetch(url.href);
          if (res.ok) await cache.put(url.href, res);
        } catch {
          // нет сети — докачаем при следующем запуске
        }
      }
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
  // Сохраняем только настоящую страницу приложения (она ссылается на бандл).
  // Иначе ответ на любой другой переход — страница ошибки, прокси, заглушка
  // провайдера — подменил бы приложение в кеше, и офлайн был бы белый экран.
  if (!assets.some((a) => a.includes('/js/'))) throw new Error('not the app shell');
  const missing = [];
  for (const a of assets) if (!(await cache.match(a))) missing.push(a);
  await cache.addAll(missing);
  const previous = await cache.match(SHELL_URL);
  const previousBundle = previous ? bundleOf(await previous.text()) : null;
  // index.html кладём последним: он не должен ссылаться на бандл, которого нет в кеше
  await cache.put(SHELL_URL, res);
  await pruneOldBundles(cache, assets);
  // Скачана новая версия — сообщаем открытым окнам; страница сама решит,
  // старая ли она (сравнит со своим бандлом), и покажет «Обновить»
  const bundle = bundleOf(html);
  if (previousBundle && bundle && bundle !== previousBundle) {
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.postMessage({ type: 'update-ready', bundle });
    }
  }
}

function bundleOf(html) {
  const m = html.match(/\/_expo\/static\/js\/[^"]+/);
  return m ? m[0] : null;
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

// Сколько ждать сеть при запуске, прежде чем открыть приложение из кеша.
// На iPhone в авиарежиме (особенно с профилем VPN) запрос не падает сразу,
// а висит до системного таймаута — без этого предела был белый экран.
const NAVIGATION_TIMEOUT_MS = 3000;

async function navigationResponse(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then((res) => {
    if (res.ok) {
      // Любой путь SPA отдаёт один и тот же index.html — храним его под '/'.
      // Бандлы новой версии докачиваем в фоне, чтобы и она работала офлайн.
      event.waitUntil(cacheShell(cache, res.clone()).catch(() => {}));
    }
    return res;
  });
  // Даём сети дожить в фоне, даже если ответили из кеша
  event.waitUntil(network.catch(() => {}));

  const cached = await cache.match(SHELL_URL);
  if (!cached) return network.catch(() => Response.error());

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    if (res && res.ok) return res;
  } catch {
    // нет сети — отвечаем из кеша
  }
  return cached;
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
