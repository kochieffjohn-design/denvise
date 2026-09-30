/*
 * Service worker Denvise: РїСЂРёР»РѕР¶РµРЅРёРµ Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ Р±РµР· РёРЅС‚РµСЂРЅРµС‚Р°.
 *
 * Р§С‚Рѕ РєРµС€РёСЂСѓРµС‚СЃСЏ:
 *   - РѕР±РѕР»РѕС‡РєР°: index.html Рё JS-Р±Р°РЅРґР» (РІ Р±Р°РЅРґР»Рµ РІРµСЃСЊ Р±РµСЃРїР»Р°С‚РЅС‹Р№ РєРѕРЅС‚РµРЅС‚ вЂ” data/*.ts);
 *   - С€СЂРёС„С‚С‹ РёРєРѕРЅРѕРє, РєР°СЂС‚РёРЅРєРё, РјР°РЅРёС„РµСЃС‚, РёРєРѕРЅРєРё PWA вЂ” РїРѕ РјРµСЂРµ РїРµСЂРІРѕРіРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ.
 * Р§С‚Рѕ РќР• РєРµС€РёСЂСѓРµС‚СЃСЏ: Р·Р°РїСЂРѕСЃС‹ РЅР° РґСЂСѓРіРёРµ РґРѕРјРµРЅС‹ (С€Р»СЋР· Р”РµРЅС‚РР / РР-РџР°С†РёРµРЅС‚Р°) вЂ”
 * Р±РµР· СЃРµС‚Рё РѕРЅРё РїСЂРѕСЃС‚Рѕ РЅРµ РїСЂРѕС…РѕРґСЏС‚, СЌРєСЂР°РЅС‹ РїРѕРєР°Р·С‹РІР°СЋС‚ РѕС€РёР±РєСѓ.
 *
 * РћР±РЅРѕРІР»РµРЅРёСЏ: СЃС‚СЂР°РЅРёС†Р° (index.html) РІСЃРµРіРґР° СЃРЅР°С‡Р°Р»Р° Р·Р°РїСЂР°С€РёРІР°РµС‚СЃСЏ РёР· СЃРµС‚Рё,
 * РєРµС€ вЂ” С‚РѕР»СЊРєРѕ РµСЃР»Рё СЃРµС‚Рё РЅРµС‚. РџРѕСЌС‚РѕРјСѓ РЅРѕРІР°СЏ РІРµСЂСЃРёСЏ РїСЂРёС…РѕРґРёС‚ РїСЂРё РїРµСЂРІРѕРј Р¶Рµ
 * Р·Р°РїСѓСЃРєРµ РѕРЅР»Р°Р№РЅ, Р° РЅРµ В«Р·Р°СЃС‚СЂРµРІР°РµС‚В» РІ РєРµС€Рµ. Р¤Р°Р№Р»С‹ РІ /_expo/static/ Рё /assets/
 * РёРјРµСЋС‚ С…РµС€ РІ РёРјРµРЅРё, РёС… Р±РµР·РѕРїР°СЃРЅРѕ РѕС‚РґР°РІР°С‚СЊ РёР· РєРµС€Р° СЃСЂР°Р·Сѓ.
 */
const VERSION = 'v4';
const CACHE = `denvise-${VERSION}`;
const SHELL_URL = '/';
// РќСѓР¶РЅС‹ РґР»СЏ Р·Р°РїСѓСЃРєР° СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅРѕРіРѕ РїСЂРёР»РѕР¶РµРЅРёСЏ; РёРјРµРЅР° Р±РµР· С…РµС€Р°.
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
 * Р¤Р°Р№Р»С‹, РєРѕС‚РѕСЂС‹Рµ СЃС‚СЂР°РЅРёС†Р° СѓСЃРїРµР»Р° Р·Р°РіСЂСѓР·РёС‚СЊ РґРѕ С‚РѕРіРѕ, РєР°Рє service worker РЅР°С‡Р°Р»
 * РїРµСЂРµС…РІР°С‚С‹РІР°С‚СЊ Р·Р°РїСЂРѕСЃС‹ (РїСЂРё СЃР°РјРѕРј РїРµСЂРІРѕРј Р·Р°РїСѓСЃРєРµ), вЂ” РїСЂРµР¶РґРµ РІСЃРµРіРѕ С€СЂРёС„С‚С‹
 * РёРєРѕРЅРѕРє. Р‘РµР· РЅРёС… РѕС„Р»Р°Р№РЅ-Р·Р°РїСѓСЃРє РїР°РґР°Р»: СЃС‚СЂР°РЅРёС†Р° РїСЂРёСЃС‹Р»Р°РµС‚ РёС… СЃРїРёСЃРѕРє СЃР°РјР°
 * (СЃРј. СЂРµРіРёСЃС‚СЂР°С†РёСЋ РІ index.html).
 */
self.addEventListener('message', (event) => {
  const data = event.data;
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
          // РЅРµС‚ СЃРµС‚Рё вЂ” РґРѕРєР°С‡Р°РµРј РїСЂРё СЃР»РµРґСѓСЋС‰РµРј Р·Р°РїСѓСЃРєРµ
        }
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API С€Р»СЋР·Р° Рё РїСЂРѕС‡РёРµ РґРѕРјРµРЅС‹ вЂ” РјРёРјРѕ

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
 * РљР»Р°РґС‘С‚ РІ РєРµС€ index.html Рё РІСЃРµ СЃРєСЂРёРїС‚С‹/СЃС‚РёР»Рё, РЅР° РєРѕС‚РѕСЂС‹Рµ РѕРЅ СЃСЃС‹Р»Р°РµС‚СЃСЏ.
 * РЈР¶Рµ Р·Р°РєРµС€РёСЂРѕРІР°РЅРЅС‹Рµ С„Р°Р№Р»С‹ РЅРµ СЃРєР°С‡РёРІР°СЋС‚СЃСЏ РїРѕРІС‚РѕСЂРЅРѕ (РёРјРµРЅР° СЃ С…РµС€РµРј).
 * `res` вЂ” СѓР¶Рµ РїРѕР»СѓС‡РµРЅРЅС‹Р№ РѕС‚РІРµС‚ РЅР° index.html, РµСЃР»Рё РµСЃС‚СЊ.
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
  // index.html РєР»Р°РґС‘Рј РїРѕСЃР»РµРґРЅРёРј: РѕРЅ РЅРµ РґРѕР»Р¶РµРЅ СЃСЃС‹Р»Р°С‚СЊСЃСЏ РЅР° Р±Р°РЅРґР», РєРѕС‚РѕСЂРѕРіРѕ РЅРµС‚ РІ РєРµС€Рµ
  await cache.put(SHELL_URL, res);
  await pruneOldBundles(cache, assets);
}

/** РЈРґР°Р»СЏРµС‚ РёР· РєРµС€Р° Р±Р°РЅРґР»С‹ РїСЂРѕС€Р»С‹С… РІРµСЂСЃРёР№ вЂ” РѕРЅРё Р±РѕР»СЊС€Рµ РЅРёРєРѕРјСѓ РЅРµ РЅСѓР¶РЅС‹. */
async function pruneOldBundles(cache, current) {
  const keep = new Set(current.map((p) => new URL(p, self.location.origin).href));
  for (const req of await cache.keys()) {
    if (new URL(req.url).pathname.startsWith('/_expo/static/') && !keep.has(req.url)) {
      await cache.delete(req);
    }
  }
}

// РЎРєРѕР»СЊРєРѕ Р¶РґР°С‚СЊ СЃРµС‚СЊ РїСЂРё Р·Р°РїСѓСЃРєРµ, РїСЂРµР¶РґРµ С‡РµРј РѕС‚РєСЂС‹С‚СЊ РїСЂРёР»РѕР¶РµРЅРёРµ РёР· РєРµС€Р°.
// РќР° iPhone РІ Р°РІРёР°СЂРµР¶РёРјРµ (РѕСЃРѕР±РµРЅРЅРѕ СЃ РїСЂРѕС„РёР»РµРј VPN) Р·Р°РїСЂРѕСЃ РЅРµ РїР°РґР°РµС‚ СЃСЂР°Р·Сѓ,
// Р° РІРёСЃРёС‚ РґРѕ СЃРёСЃС‚РµРјРЅРѕРіРѕ С‚Р°Р№РјР°СѓС‚Р° вЂ” Р±РµР· СЌС‚РѕРіРѕ РїСЂРµРґРµР»Р° Р±С‹Р» Р±РµР»С‹Р№ СЌРєСЂР°РЅ.
const NAVIGATION_TIMEOUT_MS = 3000;

async function navigationResponse(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then((res) => {
    if (res.ok) {
      // Р›СЋР±РѕР№ РїСѓС‚СЊ SPA РѕС‚РґР°С‘С‚ РѕРґРёРЅ Рё С‚РѕС‚ Р¶Рµ index.html вЂ” С…СЂР°РЅРёРј РµРіРѕ РїРѕРґ '/'.
      // Р‘Р°РЅРґР»С‹ РЅРѕРІРѕР№ РІРµСЂСЃРёРё РґРѕРєР°С‡РёРІР°РµРј РІ С„РѕРЅРµ, С‡С‚РѕР±С‹ Рё РѕРЅР° СЂР°Р±РѕС‚Р°Р»Р° РѕС„Р»Р°Р№РЅ.
      event.waitUntil(cacheShell(cache, res.clone()).catch(() => {}));
    }
    return res;
  });
  // Р”Р°С‘Рј СЃРµС‚Рё РґРѕР¶РёС‚СЊ РІ С„РѕРЅРµ, РґР°Р¶Рµ РµСЃР»Рё РѕС‚РІРµС‚РёР»Рё РёР· РєРµС€Р°
  event.waitUntil(network.catch(() => {}));

  const cached = await cache.match(SHELL_URL);
  if (!cached) return network.catch(() => Response.error());

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    if (res && res.ok) return res;
  } catch {
    // РЅРµС‚ СЃРµС‚Рё вЂ” РѕС‚РІРµС‡Р°РµРј РёР· РєРµС€Р°
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
