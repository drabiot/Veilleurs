/* ══════════════════════════════════════════════════════
   PAGE LOADER — barre de progression sous les onglets
   Utilisé par store.js : à chaque chargement de données, une fine barre dorée
   se remplit de gauche à droite à mesure que les collections arrivent.
   Sans barre d'onglets sur la page, elle se place tout en haut de la fenêtre.
══════════════════════════════════════════════════════ */

const CSS = `
#vcl-navbar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 6;
  pointer-events: none; opacity: 0; transition: opacity .3s ease; }
#vcl-navbar.fixed { position: fixed; top: 0; bottom: auto; z-index: 100000; }
#vcl-navbar > i { display: block; height: 100%; width: 0;
  background: linear-gradient(90deg, #9a7040, #E0AC60 70%, #f3d9a0);
  box-shadow: 0 0 8px rgba(224,172,96,.75); border-radius: 0 2px 2px 0; }
`;

let bar = null, fill = null, timer = null;
let total = 0, done = 0, active = 0;

function ensureBar() {
  if (bar) return bar;
  if (!document.body) return null;
  if (!document.getElementById('vcl-navbar-css')) {
    const st = document.createElement('style');
    st.id = 'vcl-navbar-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  bar = document.createElement('div');
  bar.id = 'vcl-navbar';
  bar.setAttribute('aria-hidden', 'true');
  fill = document.createElement('i');
  bar.appendChild(fill);
  const host = document.querySelector('.header-nav');
  if (host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(bar);
  } else {
    bar.classList.add('fixed');
    document.body.appendChild(bar);
  }
  return bar;
}

function update() {
  if (!ensureBar()) return;
  clearTimeout(timer);
  bar.style.opacity = '1';
  const target = total ? Math.min(95, ((done + 0.85) / total) * 100) : 30;
  fill.style.transition = 'width 1.2s cubic-bezier(.1,.7,.2,1)';
  fill.style.width = target + '%';
}

function finish() {
  if (!bar) return;
  fill.style.transition = 'width .25s ease';
  fill.style.width = '100%';
  timer = setTimeout(() => {
    bar.style.opacity = '0';
    timer = setTimeout(() => { fill.style.transition = 'none'; fill.style.width = '0%'; }, 320);
  }, 320);
}

export const loader = {
  /** Démarre le suivi de `n` éléments à charger. Retourne { step, end }. */
  begin(n) {
    total += n; active++;
    if (active === 1) { done = 0; total = n; }
    update();
    let finished = false;
    return {
      step() { done++; update(); },
      end() {
        if (finished) return; finished = true;
        active = Math.max(0, active - 1);
        if (!active) { finish(); total = done = 0; }
      },
    };
  },
};
