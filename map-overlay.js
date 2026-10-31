/* ══ map-overlay.js — les liens « coordonnées » vers la carte s'ouvrent dans un overlay au lieu de quitter la page ══
   Intercepte tout clic gauche sur un lien vers Map/map.html portant pnjId, questId ou ghost_gx (le menu « Carte » n'est pas touché).
   La carte est chargée avec ?embed=1 (carte seule). Ctrl / Maj / clic milieu gardent le comportement normal (nouvel onglet).
   Une page l'inclut avec <script src="…/map-overlay.js" defer></script> ; rien d'autre à brancher. */
(function () {
  'use strict';
  if (window.VCL_MAP_OVERLAY) return;
  const KEYS = ['pnjId', 'questId', 'ghost_gx'];
  let box = null, frame = null, title = null;

  function mapUrl(a) {
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return null; }
    if (!/\/Map\/map\.html$/i.test(u.pathname)) return null;
    if (u.searchParams.get('pick') === '1' || !KEYS.some(k => u.searchParams.has(k))) return null;
    u.searchParams.set('embed', '1');
    return u;
  }

  function build() {
    const css = document.createElement('style');
    css.textContent =
      '#vcl-map-ov{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72)}' +
      '#vcl-map-ov.open{display:flex}' +
      '#vcl-map-ov .mo-box{width:min(1000px,94vw);height:min(700px,88vh);display:flex;flex-direction:column;background:#17130f;border:1px solid #e0ac60;border-radius:10px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.7)}' +
      '#vcl-map-ov .mo-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 12px;font:12px/1.4 "JetBrains Mono",ui-monospace,monospace;color:#d8cdb8;border-bottom:1px solid #3a3024}' +
      '#vcl-map-ov .mo-head button{font:inherit;background:#1f1a14;color:#d8cdb8;border:1px solid #3a3024;border-radius:5px;padding:4px 10px;cursor:pointer}' +
      '#vcl-map-ov .mo-head button:hover{border-color:#e0ac60}' +
      '#vcl-map-ov iframe{flex:1;width:100%;border:0;background:#000}';
    document.head.appendChild(css);
    box = document.createElement('div');
    box.id = 'vcl-map-ov';
    box.setAttribute('data-no-i18n', '');
    box.innerHTML = '<div class="mo-box" role="dialog" aria-modal="true"><div class="mo-head"><span class="mo-title"></span>' +
      '<span><a class="mo-full" target="_blank" rel="noopener" style="color:#e0ac60;margin-right:12px;font-size:11px">↗</a><button type="button" class="mo-close">✕</button></span></div>' +
      '<iframe title="Map"></iframe></div>';
    document.body.appendChild(box);
    frame = box.querySelector('iframe');
    title = box.querySelector('.mo-title');
    box.addEventListener('click', e => { if (e.target === box) close(); });
    box.querySelector('.mo-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
  }

  function open(u, label) {
    if (!box) build();
    title.textContent = '📍 ' + (label || u.searchParams.get('ghost_name') || '');
    const full = new URL(u); full.searchParams.delete('embed');
    box.querySelector('.mo-full').href = full.href;
    frame.src = u.href;
    box.classList.add('open');
  }

  function close() {
    if (!box) return;
    box.classList.remove('open');
    frame.src = 'about:blank';
  }

  document.addEventListener('click', e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href*="map.html"]');
    if (!a) return;
    const u = mapUrl(a);
    if (!u) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open(u, (a.dataset.mapTitle || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80));
  }, true);

  window.VCL_MAP_OVERLAY = { open, close };
})();
