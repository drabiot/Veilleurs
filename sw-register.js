/* Enregistre le service worker (cache des images et polices, pages hors ligne) et vérifie que le site est à jour.
   Version : version.json (écrit par tools/stamp-versions.js à chaque mise en ligne). Si elle a changé depuis la dernière visite :
   les caches sont vidés, la page est rechargée à neuf ; sur un onglet resté ouvert, un bandeau propose d'actualiser.
   Silencieux si le navigateur ne gère pas le service worker ou si le réseau est coupé. */
(function () {
  const cs = document.currentScript;
  if (!cs || !cs.src) return;
  const KEY = 'vcl-build', LOOP = 'vcl-build-reloads';
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
  };
  let last = 0;

  if ('serviceWorker' in navigator) {
    const url = new URL('sw.js', cs.src);   // sw.js est à la racine du site ; sa portée couvre tous les dossiers
    window.addEventListener('load', () => { navigator.serviceWorker.register(url.href).catch(() => {}); });
  }

  async function purge() {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* pas de Cache API */ }
    try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update().catch(() => {}))); } catch { /* pas de service worker */ }
    try { await fetch(location.href, { cache: 'reload' }); } catch { /* hors ligne */ } // renouvelle la page dans le cache HTTP : le rechargement ne ressert pas l'ancienne
  }
  function banner() {
    if (document.getElementById('vcl-update')) return;
    const b = document.createElement('div');
    b.id = 'vcl-update';
    b.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;background:#1b1b22;color:#eee;border:1px solid #b79cff;border-radius:8px;padding:10px 14px;font:13px/1.3 system-ui,sans-serif;box-shadow:0 4px 18px #0008;display:flex;gap:10px;align-items:center';
    b.innerHTML = '<span>Nouvelle version du site disponible.</span><button style="background:#b79cff;color:#111;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit">Actualiser</button>';
    b.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(b);
  }

  /** onLoad : vrai au chargement de la page (rechargement automatique) ; faux sur un onglet déjà ouvert (bandeau, pour ne pas perdre un travail en cours). */
  async function check(onLoad) {
    if (Date.now() - last < 30000) return;
    last = Date.now();
    let v;
    try { v = (await (await fetch(new URL('version.json', cs.src).href + '?t=' + Date.now(), { cache: 'no-store' })).json()).v; } catch { return; }
    if (!v) return;
    const seen = store.get(KEY);
    if (seen === v) { try { sessionStorage.removeItem(LOOP); } catch { /* ignore */ } return; }
    store.set(KEY, v);                       // les autres onglets le voient (évènement « storage »)
    if (!seen) return;                       // première visite : rien à renouveler
    await purge();
    let n = 0; try { n = +sessionStorage.getItem(LOOP) || 0; } catch { /* ignore */ }
    if (onLoad && n < 2) { try { sessionStorage.setItem(LOOP, String(n + 1)); } catch { /* ignore */ } location.reload(); }
    else banner();
  }

  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue && e.oldValue && e.newValue !== e.oldValue) banner(); }); // un autre onglet a détecté une nouvelle version
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  window.addEventListener('load', () => check(true));
  setInterval(() => check(false), 5 * 60 * 1000);
})();
