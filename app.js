/* ═══════════════════════════════════════════════
   PATCHNOTES — app.js
═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Compteur d'entrées ── */
  const entries = document.querySelectorAll('.patch-entry');
  const countEl = document.getElementById('entry-count');
  countEl.textContent = `${entries.length} version${entries.length > 1 ? 's' : ''}`;

  /* ── Date footer ── */
  const footerDate = document.getElementById('footer-date');
  const now = new Date();
  footerDate.textContent = `généré le ${now.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })}`;

  /* ── Accordion : collapse / expand ── */
  document.querySelectorAll('.version-header').forEach(header => {
    header.addEventListener('click', () => {
      const entry = header.closest('.patch-entry');
      const body  = entry.querySelector('.patch-body');
      const isOpen = !body.classList.contains('hidden');

      if (isOpen) {
        body.classList.add('hidden');
        entry.classList.remove('open');
      } else {
        body.classList.remove('hidden');
        entry.classList.add('open');
      }
    });
  });

  /* ── Filter bar toggle ── */
  const filterToggle = document.getElementById('filter-toggle');
  const filterBar    = document.getElementById('filter-bar');

  filterToggle.addEventListener('click', () => {
    const isHidden = filterBar.classList.contains('hidden');
    filterBar.classList.toggle('hidden', !isHidden);
    filterToggle.textContent = isHidden ? 'fermer ✕' : 'filtrer ↓';
  });

  /* ── Filtres par type ── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Active state
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      entries.forEach(entry => {
        if (filter === 'all') {
          entry.classList.remove('hidden-by-filter');
          return;
        }

        // Cherche si l'entrée contient ce type de changement
        const hasType = entry.querySelector(`.change-group[data-type="${filter}"]`);
        entry.classList.toggle('hidden-by-filter', !hasType);
      });

      // Mise à jour compteur
      const visible = document.querySelectorAll('.patch-entry:not(.hidden-by-filter)').length;
      countEl.textContent = `${visible} version${visible > 1 ? 's' : ''}`;
    });
  });

  /* ── Keyboard shortcut : "f" pour focus filtre ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
      filterBar.classList.remove('hidden');
      filterToggle.textContent = 'fermer ✕';
    }
    if (e.key === 'Escape') {
      filterBar.classList.add('hidden');
      filterToggle.textContent = 'filtrer ↓';
    }
  });

});


/* ═══════════════════════════════════════════════
   COMMENT AJOUTER UNE NOUVELLE VERSION
   ───────────────────────────────────────────────
   Copie ce bloc dans index.html avant la première
   <article> existante :

  <article class="patch-entry mb-1" data-version="X.Y.Z">
    <div class="version-header flex items-baseline gap-4 py-5 cursor-pointer select-none group">
      <span class="version-tag text-accent font-bold text-sm">vX.Y.Z</span>
      <span class="text-bright font-display font-bold text-xl group-hover:text-accent transition-colors">Titre de la version</span>
      <span class="text-muted text-xs ml-auto tabular-nums">AAAA-MM-JJ</span>
      <span class="chevron text-muted text-xs ml-2 transition-transform">▼</span>
    </div>
    <div class="patch-body border-l-2 border-accent/30 ml-1 pl-6 pb-6 space-y-4">
      <div class="change-group" data-type="added|fixed|changed|removed">
        <div class="type-label added|fixed|changed|removed">✦ ajouté</div>
        <ul class="change-list">
          <li>Description du changement</li>
        </ul>
      </div>
    </div>
  </article>
  <div class="separator"></div>

═══════════════════════════════════════════════ */
