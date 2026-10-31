(function () {

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Libellés des types de fiche (affichés dans le widget et en modération)
  const FICHE_LABELS = { item: 'Item', mob: 'Monstre', pnj: 'PNJ', quete: 'Quête', build: 'Build' };

  // HTML d'un bouton « Signaler une erreur » lié à une fiche ; le clic est capté par délégation (cf. init)
  window.vclReportFicheHtml = function (type, id, name) {
    return '<button type="button" class="vcl-fiche-report" data-report-fiche="1"' +
      ' data-rtype="' + escHtml(type) + '" data-rid="' + escHtml(id) + '" data-rname="' + escHtml(name || id) + '"' +
      ' title="Signaler une erreur sur cette fiche">⚑ Signaler une erreur</button>';
  };

  // Bulle « nouveau message » : alimentée par report-chat.js (window.vclSetReportBubble), éventuellement avant la création du bouton
  let bubbleEl = null, bubbleState = null;
  function paintBubble() {
    if (!bubbleEl) return;
    const s = bubbleState;
    bubbleEl.hidden = !s || !s.total;
    if (!s) return;
    bubbleEl.classList.toggle('unread', s.unread > 0);
    bubbleEl.textContent = s.unread > 0 ? '💬 ' + (s.unread > 1 ? s.unread + ' nouveaux messages' : 'Nouveau message') : '💬 Mes échanges';
  }
  window.vclSetReportBubble = s => { bubbleState = s; paintBubble(); };

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

    bubbleEl = document.createElement('button');
    bubbleEl.className = 'vcl-report-bubble';
    bubbleEl.hidden = true;
    bubbleEl.title = 'Réponses des admins à tes signalements';
    bubbleEl.onclick = () => bubbleState?.open?.();
    btn.insertAdjacentElement('afterend', bubbleEl);
    paintBubble();

    // ── Bug / Suggestion overlay ─────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'vcl-report-overlay';
    overlay.className = 'vcl-report-overlay hidden';
    overlay.innerHTML = [
      '<div class="vcl-report-modal">',
      '  <h3>Bug / Suggestion</h3>',
      '  <p id="vcl-report-ctx" class="vcl-report-ctx" hidden></p>',
      '  <textarea id="vcl-report-text" placeholder="Décris le bug ou ta suggestion..." rows="5"></textarea>',
      '  <p id="vcl-report-login" class="vcl-report-login" hidden>💬 Connecte-toi pour recevoir une réponse de l\'équipe.',
      '    <a href="#" id="vcl-report-login-link">Se connecter</a></p>',
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

    const ctxEl = document.getElementById('vcl-report-ctx');
    const loginEl = document.getElementById('vcl-report-login');
    const loginLink = document.getElementById('vcl-report-login-link');
    // Sans compte, l'équipe ne peut pas répondre : on propose de se connecter (auth-widget.js sur le wiki, _vcl_auth sur creator.html)
    const isLogged = () => !!(window._vcl_uid || window._vcl_auth?.currentUser);
    function syncLogin() {
      loginEl.hidden = isLogged();
      loginLink.hidden = typeof window.vclOpenLogin !== 'function';
    }
    loginLink.onclick = e => {
      e.preventDefault();
      window.vclOpenLogin?.('Connecte-toi avec Discord pour recevoir la réponse de l\'équipe à ton signalement.');
    };
    document.addEventListener('vcl:auth-ready', syncLogin);
    let ficheCtx = null; // { type, id, name } de la fiche signalée, null = signalement général

    function close() { overlay.classList.add('hidden'); statusEl.textContent = ''; ficheCtx = null; }
    function open(ctx) {
      ficheCtx = ctx && ctx.id ? ctx : null;
      ctxEl.hidden = !ficheCtx;
      ctxEl.textContent = ficheCtx
        ? 'Fiche : ' + (FICHE_LABELS[ficheCtx.type] || ficheCtx.type) + ' · ' + (ficheCtx.name || ficheCtx.id)
        : '';
      syncLogin();
      overlay.classList.remove('hidden');
      textEl.focus();
    }

    btn.onclick = () => open();
    document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-report-fiche]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      open({ type: b.dataset.rtype, id: b.dataset.rid, name: b.dataset.rname });
    });
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
        const sent = await window._vclLogReport(pseudo, page, text, ficheCtx);
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
