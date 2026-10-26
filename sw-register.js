/* Enregistre le service worker (cache des images et polices, pages hors ligne). Silencieux si le navigateur ne le gère pas. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  const cs = document.currentScript;
  if (!cs || !cs.src) return;
  const url = new URL('sw.js', cs.src);   // sw.js est à la racine du site ; sa portée couvre tous les dossiers
  window.addEventListener('load', () => { navigator.serviceWorker.register(url.href).catch(() => {}); });
})();
