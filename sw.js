/* Service worker : cache des images et polices (le plus lourd), pages et scripts disponibles hors ligne.
   - images / polices : on sert le cache tout de suite et on le met à jour en arrière-plan (stale-while-revalidate) ;
   - pages, scripts, styles : le réseau d'abord (toujours la dernière version), le cache seulement si le réseau est coupé ;
   - données du wiki (Worker Cloudflare), Discord, statistiques : jamais mises en cache ici (le site gère déjà son cache de données).
   Changer VERSION vide les anciens caches. */
const VERSION = 'vcl-v2';
const IMG_CACHE = VERSION + '-img';
const PAGE_CACHE = VERSION + '-pages';
const MAX_IMG = 600;
const MAX_PAGES = 150;   // les anciennes versions (?v=…) sortent d'elles-mêmes

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isImage = req => req.destination === 'image' || /\.(png|webp|jpe?g|gif|svg|ico|woff2?|ttf)(\?|$)/i.test(new URL(req.url).pathname);
const isFont  = url => url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await cache.delete(k);
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()).then(() => trim(cache, MAX_IMG)).catch(() => {}); }
    return res;
  }).catch(() => hit);
  return hit || net;
}

async function networkFirst(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    // no-cache : revalide toujours auprès du serveur (sinon le cache HTTP de l'hébergeur peut servir une vieille page ~10 min)
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) cache.put(req, res.clone()).then(() => trim(cache, MAX_PAGES)).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return;
  // jamais : Worker (données, connexion), Discord, Google Analytics, API
  if (/workers\.dev$|discord|googletagmanager|google-analytics|identitytoolkit|firebase/i.test(url.hostname)) return;
  if (isFont(url) || (url.origin === self.location.origin && isImage(req))) {
    e.respondWith(staleWhileRevalidate(req, IMG_CACHE));
    return;
  }
  if (url.origin === self.location.origin && /\.(html|js|css|json)$|\/$/.test(url.pathname)) {
    e.respondWith(networkFirst(req));
  }
});
