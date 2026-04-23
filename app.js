/* ═══════════════════════════════════════════════
   Les Veilleurs au Clair de Lune — home/app.js
═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Date footer ── */
  document.getElementById('footer-date').textContent =
    new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  /* ── Étoiles générées aléatoirement ── */
  const starsEl = document.getElementById('stars');
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size  = Math.random() * 1.8 + .4;
    const delay = Math.random() * 6;
    const dur   = Math.random() * 4 + 2;
    const a1    = Math.random() * .12 + .04;
    const a2    = Math.random() * .4  + .12;
    s.style.cssText = `
      left:${Math.random() * 100}%;
      top:${Math.random()  * 100}%;
      width:${size}px;
      height:${size}px;
      --d:${dur}s;
      --a1:${a1};
      --a2:${a2};
      animation-delay:${delay}s;
    `;
    starsEl.appendChild(s);
  }

});
