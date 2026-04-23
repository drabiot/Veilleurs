document.addEventListener('DOMContentLoaded', () => {

  /* ── Compteur ── */
  const entries = document.querySelectorAll('.patch-entry');
  const countEl = document.getElementById('entry-count');
  countEl.textContent = `${entries.length} version${entries.length > 1 ? 's' : ''}`;

  /* ── Date footer ── */
  document.getElementById('footer-date').textContent =
    new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  /* ── Accordion ── */
  document.querySelectorAll('.version-header').forEach(header => {
    const activate = () => {
      const entry   = header.closest('.patch-entry');
      const body    = entry.querySelector('.patch-body');
      const chevron = header.querySelector('.chevron');
      const isOpen  = !body.classList.contains('hidden');

      if (isOpen) {
        body.classList.add('hidden');
        chevron.classList.add('chevron-closed');
        header.setAttribute('aria-expanded', 'false');
      } else {
        body.classList.remove('hidden');
        chevron.classList.remove('chevron-closed');
        header.setAttribute('aria-expanded', 'true');
      }
    };

    header.addEventListener('click', activate);
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  /* ── Toggle barre de filtres ── */
  const filterToggle = document.getElementById('filter-toggle');
  const filterBar    = document.getElementById('filter-bar');

  filterToggle.addEventListener('click', () => {
    const opening = filterBar.classList.contains('hidden');
    filterBar.classList.toggle('hidden', !opening);
    filterToggle.textContent = opening ? 'fermer ✕' : 'filtrer ↓';
  });

  /* ── Filtres par type ── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      // Afficher/cacher les groupes à l'intérieur de chaque article
      document.querySelectorAll('.change-group').forEach(group => {
        if (filter === 'all') {
          group.classList.remove('hidden-by-filter');
        } else {
          group.classList.toggle('hidden-by-filter', group.dataset.type !== filter);
        }
      });

      // Mettre à jour le compteur avec les articles qui ont au moins un groupe visible
      const visible = [...entries].filter(entry => {
        if (filter === 'all') return true;
        return entry.querySelector(`.change-group[data-type="${filter}"]`);
      }).length;
      countEl.textContent = `${visible} version${visible > 1 ? 's' : ''}`;
    });
  });

  /* ── Raccourcis clavier ── */
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'f') {
      filterBar.classList.remove('hidden');
      filterToggle.textContent = 'fermer ✕';
    }
    if (e.key === 'Escape') {
      filterBar.classList.add('hidden');
      filterToggle.textContent = 'filtrer ↓';
    }
  });

});
