(function () {
  const REPORT_WEBHOOK = 'https://discord.com/api/webhooks/1498346521765085386/beF1fOIgiwBxgoSovl_akVZFGpw2wsLpycAV2k0xk5Np0YyKYJwf_E6ff-U4VHIyzKCY';

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function init() {
    const logo = document.querySelector('.header-logo');
    if (!logo) return;

    // ── Bug / Suggestion button ──────────────────────────
    const btn = document.createElement('button');
    btn.className = 'vcl-report-btn';
    btn.id = 'vcl-report-btn';
    btn.title = 'Signaler un bug / Suggestion';
    btn.textContent = '⚑ Bug / Suggestion';
    logo.insertAdjacentElement('afterend', btn);

    // ── Bugs connus button ───────────────────────────────
    const bugsBtn = document.createElement('button');
    bugsBtn.className = 'vcl-report-btn vcl-bugs-btn';
    bugsBtn.id = 'vcl-bugs-btn';
    bugsBtn.title = 'Liste des bugs connus';
    bugsBtn.textContent = '🐛 Bugs connus';
    btn.insertAdjacentElement('afterend', bugsBtn);

    // ── Bugs connus overlay ──────────────────────────────
    const bugsOverlay = document.createElement('div');
    bugsOverlay.id = 'vcl-bugs-overlay';
    bugsOverlay.className = 'vcl-report-overlay hidden';
    bugsOverlay.innerHTML = [
      '<div class="vcl-report-modal vcl-bugs-modal">',
      '  <div class="vcl-bugs-header">',
      '    <h3>🐛 Bugs connus</h3>',
      '    <button id="vcl-bugs-close" class="vcl-bugs-close-btn" title="Fermer">✕</button>',
      '  </div>',
      '  <div id="vcl-bugs-list"><p class="vcl-bugs-loading">Chargement…</p></div>',
      '</div>'
    ].join('');
    document.body.appendChild(bugsOverlay);

    function closeBugs() { bugsOverlay.classList.add('hidden'); }
    async function openBugs() {
      bugsOverlay.classList.remove('hidden');
      const listEl = document.getElementById('vcl-bugs-list');
      listEl.innerHTML = '<p class="vcl-bugs-loading">Chargement…</p>';
      try {
        const all = typeof window._vclGetKnownBugs === 'function'
          ? await window._vclGetKnownBugs()
          : [];
        const visible = all.filter(b => b.status === 'actif' || b.status === 'en_cours');
        if (!visible.length) {
          listEl.innerHTML = '<p class="vcl-bugs-empty">Aucun bug connu actuellement.</p>';
          return;
        }
        const STATUS_LABEL = { actif: 'Bug connu', en_cours: 'En cours de résolution' };
        listEl.innerHTML = visible.map(b => [
          '<div class="vcl-bug-item">',
          '  <div class="vcl-bug-item-top">',
          '    <span class="vcl-bug-title">' + escHtml(b.title || '(sans titre)') + '</span>',
          '    <span class="vcl-bug-badge vcl-bug-badge--' + b.status + '">' + (STATUS_LABEL[b.status] || b.status) + '</span>',
          '  </div>',
          b.description ? '  <p class="vcl-bug-desc">' + escHtml(b.description) + '</p>' : '',
          '</div>'
        ].join('')).join('');
      } catch (err) {
        listEl.innerHTML = '<p class="vcl-bugs-empty">Impossible de charger les bugs.</p>';
        console.error('[bugs-widget]', err);
      }
    }

    bugsBtn.onclick = openBugs;
    document.getElementById('vcl-bugs-close').onclick = closeBugs;
    bugsOverlay.onclick = e => { if (e.target === bugsOverlay) closeBugs(); };

    // ── Bug / Suggestion overlay ─────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'vcl-report-overlay';
    overlay.className = 'vcl-report-overlay hidden';
    overlay.innerHTML = [
      '<div class="vcl-report-modal">',
      '  <h3>Bug / Suggestion</h3>',
      '  <textarea id="vcl-report-text" placeholder="Décris le bug ou ta suggestion..." rows="5"></textarea>',
      '  <div class="vcl-report-actions">',
      '    <button id="vcl-report-cancel">Annuler</button>',
      '    <button id="vcl-report-submit">Envoyer</button>',
      '  </div>',
      '  <p id="vcl-report-status"></p>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    const textEl   = document.getElementById('vcl-report-text');
    const statusEl = document.getElementById('vcl-report-status');

    function close() { overlay.classList.add('hidden'); statusEl.textContent = ''; }
    function open()  { overlay.classList.remove('hidden'); textEl.focus(); }

    btn.onclick = open;
    document.getElementById('vcl-report-cancel').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); closeBugs(); } });

    document.getElementById('vcl-report-submit').onclick = async function () {
      const text = textEl.value.trim();
      if (!text) return;

      this.disabled = true;
      statusEl.textContent = 'Envoi...';

      try {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        // auth-widget.js (wiki) expose _vcl_uid + #vcl-user-pseudo
        // creator.html expose _vcl_auth.currentUser directement
        let pseudo = 'Anonyme';
        if (window._vcl_uid) {
          pseudo = document.getElementById('vcl-user-pseudo')?.textContent?.trim() || 'Utilisateur';
        } else if (window._vcl_auth?.currentUser) {
          const u = window._vcl_auth.currentUser;
          pseudo = u.displayName || u.email?.split('@')[0] || 'Utilisateur';
        }
        const res = await fetch(REPORT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: 'Bug / Suggestion',
              description: text,
              color: 15251531,
              author: { name: pseudo },
              footer: { text: page }
            }]
          })
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error('HTTP ' + res.status + (body ? ' — ' + body : ''));
        }
        statusEl.textContent = 'Envoyé !';
        window._vclLogReport?.(pseudo, page, text);
        textEl.value = '';
        setTimeout(close, 1200);
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message;
        console.error('[report-widget]', err);
      } finally {
        this.disabled = false;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
