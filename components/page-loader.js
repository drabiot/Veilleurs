/* ══════════════════════════════════════════════════════
   PAGE LOADER — écran de chargement aux couleurs du wiki
   Utilisé par store.js : s'affiche seulement si le chargement des données
   dépasse un court délai (pas de flash quand tout vient du cache), avec une
   barre qui avance à chaque collection reçue.
══════════════════════════════════════════════════════ */

const SHOW_DELAY = 2000;  // ms avant d'afficher : l'écran n'apparaît que si le chargement dépasse 2 s
const MIN_VISIBLE = 350;  // ms d'affichage minimum une fois visible (évite le clignotement)

const CSS = `
#vcl-loader {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: radial-gradient(ellipse 70% 55% at 50% 38%, #211a10 0%, #13100d 55%, #0e0c0a 100%);
  color: #c9b99a; opacity: 0; transition: opacity .25s ease;
  font-family: 'JetBrains Mono', monospace;
}
#vcl-loader.show { opacity: 1; }
#vcl-loader .vl-moon {
  width: 84px; height: 84px; border-radius: 50%;
  background: radial-gradient(circle at 38% 38%, #f5e4c0 0%, #d4a848 38%, #7a4f15 70%, rgba(122,79,21,0) 100%);
  box-shadow: 0 0 60px rgba(224,172,96,.28), 0 0 140px rgba(224,172,96,.12);
  animation: vl-pulse 2.6s ease-in-out infinite; position: relative;
}
#vcl-loader .vl-moon img { position: absolute; inset: 14px; width: 56px; height: 56px; object-fit: contain; opacity: .9; }
#vcl-loader .vl-title {
  font-family: 'Cinzel', serif; font-size: 15px; font-weight: 600;
  letter-spacing: .22em; text-transform: uppercase; color: #ede0c8;
}
#vcl-loader .vl-bar {
  position: relative; width: min(320px, 70vw); height: 6px; overflow: hidden;
  border: 1px solid #3d3020; border-radius: 3px; background: #191410;
}
#vcl-loader .vl-fill {
  position: absolute; inset: 0 auto 0 0; width: 8%;
  background: linear-gradient(90deg, #9a7040, #E0AC60 60%, #f3d9a0);
  box-shadow: 0 0 12px rgba(224,172,96,.55);
  transition: width .35s ease;
}
#vcl-loader .vl-fill::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  transform: translateX(-100%); animation: vl-shimmer 1.4s linear infinite;
}
#vcl-loader .vl-sub { font-size: 11px; letter-spacing: .08em; color: #6b5a45; min-height: 16px; }
@keyframes vl-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes vl-shimmer { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) {
  #vcl-loader .vl-moon, #vcl-loader .vl-fill::after { animation: none; }
}
`;

let el = null, fill = null, sub = null;
let total = 0, done = 0, active = 0;
let showTimer = null, shownAt = 0, hideTimer = null;

function ensureDom() {
  if (el) return true;
  if (!document.body) return false;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  el = document.createElement('div');
  el.id = 'vcl-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const logo = new URL('../img/VeilleursLogo.png', import.meta.url).href;
  el.innerHTML =
    `<div class="vl-moon"><img src="${logo}" alt="" onerror="this.remove()"></div>` +
    `<div class="vl-title">Veilleurs au Clair de Lune</div>` +
    `<div class="vl-bar"><div class="vl-fill"></div></div>` +
    `<div class="vl-sub">Chargement des données… merci de patienter</div>`;
  fill = el.querySelector('.vl-fill');
  sub = el.querySelector('.vl-sub');
  document.body.appendChild(el);
  return true;
}

function render() {
  if (!fill) return;
  const pct = total ? Math.max(8, Math.round((done / total) * 100)) : 8;
  fill.style.width = pct + '%';
  if (sub) sub.textContent = total ? `Chargement des données… ${done}/${total}` : 'Chargement des données…';
}

function reveal() {
  if (!ensureDom()) return;
  clearTimeout(hideTimer);
  shownAt = Date.now();
  render();
  requestAnimationFrame(() => el && el.classList.add('show'));
}

function hide() {
  if (!el) return;
  const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt));
  hideTimer = setTimeout(() => {
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => { if (el && !active) { el.remove(); el = fill = sub = null; } }, 280);
  }, wait);
}

/* ── Barre de progression sous les onglets (tous les chargements) ──
   Se remplit de gauche à droite à mesure que les collections arrivent. Sans barre d'onglets
   sur la page, elle se place tout en haut de la fenêtre. */
const NAVBAR_CSS = `
#vcl-navbar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 6;
  pointer-events: none; opacity: 0; transition: opacity .3s ease; }
#vcl-navbar.fixed { position: fixed; top: 0; bottom: auto; z-index: 100000; }
#vcl-navbar > i { display: block; height: 100%; width: 0;
  background: linear-gradient(90deg, #9a7040, #E0AC60 70%, #f3d9a0);
  box-shadow: 0 0 8px rgba(224,172,96,.75); border-radius: 0 2px 2px 0; }
`;
let nbar = null, nfill = null, nbarTimer = null;

function navBar() {
  if (nbar) return nbar;
  if (!document.body) return null;
  if (!document.getElementById('vcl-navbar-css')) {
    const st = document.createElement('style');
    st.id = 'vcl-navbar-css';
    st.textContent = NAVBAR_CSS;
    document.head.appendChild(st);
  }
  nbar = document.createElement('div');
  nbar.id = 'vcl-navbar';
  nbar.setAttribute('aria-hidden', 'true');
  nfill = document.createElement('i');
  nbar.appendChild(nfill);
  const host = document.querySelector('.header-nav');
  if (host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(nbar);
  } else {
    nbar.classList.add('fixed');
    document.body.appendChild(nbar);
  }
  return nbar;
}

function barUpdate() {
  if (!navBar()) return;
  clearTimeout(nbarTimer);
  nbar.style.opacity = '1';
  const target = total ? Math.min(95, ((done + 0.85) / total) * 100) : 30;
  nfill.style.transition = 'width 1.2s cubic-bezier(.1,.7,.2,1)';
  nfill.style.width = target + '%';
}

function barFinish() {
  if (!nbar) return;
  nfill.style.transition = 'width .25s ease';
  nfill.style.width = '100%';
  nbarTimer = setTimeout(() => {
    nbar.style.opacity = '0';
    nbarTimer = setTimeout(() => { nfill.style.transition = 'none'; nfill.style.width = '0%'; }, 320);
  }, 320);
}

export const loader = {
  /** Démarre le suivi de `n` éléments à charger. Retourne begin() → { step, end }. */
  begin(n) {
    total += n; active++;
    if (active === 1) {
      done = 0; total = n;
      showTimer = setTimeout(() => { if (active) reveal(); }, SHOW_DELAY);
    } else if (el) render();
    barUpdate();
    let finished = false;
    return {
      step() { done++; render(); barUpdate(); },
      end() {
        if (finished) return; finished = true;
        active = Math.max(0, active - 1);
        if (!active) { clearTimeout(showTimer); barFinish(); total = done = 0; if (el) { fill.style.width = '100%'; hide(); } }
      },
    };
  },
};
