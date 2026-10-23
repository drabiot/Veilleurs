(function () {

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
        // Les signalements sont enregistrés dans Firestore (collection reports), lus par l'admin
        if (typeof window._vclLogReport !== 'function') throw new Error('envoi indisponible sur cette page');
        const sent = await window._vclLogReport(pseudo, page, text);
        if (!sent) throw new Error('envoi refusé, réessaie plus tard');
        statusEl.textContent = 'Envoyé !';
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
