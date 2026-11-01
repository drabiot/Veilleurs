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

  // Bouton « Nous contacter » : report-chat.js (joueur connecté) lui donne l'état de ses tickets (window.vclSetTickets) et la liste à ouvrir.
  // Sans ticket (ou sans compte), le bouton ouvre directement le formulaire de nouveau ticket.
  const CHAT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11.5h7M8.5 14.5h4"/></svg>';
  // Logo Discord (Simple Icons), rempli
  const DISCORD_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>';
  let btnEl = null, ticketState = null;
  function paintBtn() {
    if (!btnEl) return;
    const n = ticketState?.unread || 0;
    btnEl.classList.toggle('unread', n > 0);
    btnEl.innerHTML = CHAT_ICON + '<span>Nous contacter</span>' + (n > 0 ? '<span class="vcl-report-count" aria-hidden="true">' + n + '</span>' : '');
    btnEl.title = n > 0 ? (n > 1 ? n + ' tickets avec une réponse des Veilleurs' : 'Un ticket avec une réponse des Veilleurs') : 'Signaler un bug, proposer une suggestion, poser une question';
  }
  window.vclSetTickets = s => { ticketState = s; paintBtn(); };

  function init() {
    const logo = document.querySelector('.header-logo');
    if (!logo) return;

    // ── Bouton « Nous contacter » ────────────────────────
    const btn = document.createElement('button');
    btn.className = 'vcl-report-btn';
    btn.id = 'vcl-report-btn';
    logo.insertAdjacentElement('afterend', btn);
    btnEl = btn;
    paintBtn();

    // ── Lien Discord (à droite de « Nous contacter ») ────
    const dc = document.createElement('a');
    dc.className = 'vcl-report-btn vcl-discord-btn';
    dc.href = 'https://discord.gg/gnQXt4y4pn';
    dc.target = '_blank';
    dc.rel = 'noopener noreferrer';
    dc.title = 'Rejoindre le Discord des Veilleurs';
    dc.innerHTML = DISCORD_ICON + '<span>Discord</span>';
    btn.insertAdjacentElement('afterend', dc);

    // ── Bug / Suggestion overlay ─────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'vcl-report-overlay';
    overlay.className = 'vcl-report-overlay hidden';
    overlay.innerHTML = [
      '<div class="vcl-report-modal">',
      '  <h3>Nouveau ticket</h3>',
      '  <p id="vcl-report-ctx" class="vcl-report-ctx" hidden></p>',
      '  <div id="vcl-report-cats" class="vcl-report-cats">',
      '    <label><input type="radio" name="vcl-cat" value="bug" checked><span>🐛 Bug</span></label>',
      '    <label><input type="radio" name="vcl-cat" value="suggestion"><span>💡 Suggestion</span></label>',
      '    <label><input type="radio" name="vcl-cat" value="autre"><span>❓ Autre</span></label>',
      '  </div>',
      '  <textarea id="vcl-report-text" placeholder="Décris ton problème, ta suggestion ou ta question..." rows="5"></textarea>',
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
    const catsEl = document.getElementById('vcl-report-cats');
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
      // les textarea sont ignorées par l'observateur i18n : on traduit le placeholder à l'ouverture (i18n.js est chargé à ce moment-là)
      textEl.placeholder = window.VCL_I18N?.t?.('Décris ton problème, ta suggestion ou ta question...') ?? textEl.placeholder;
      ctxEl.hidden = !ficheCtx;
      catsEl.hidden = !!ficheCtx;   // erreur sur une fiche : pas de catégorie à choisir
      ctxEl.textContent = ficheCtx
        ? 'Fiche : ' + (FICHE_LABELS[ficheCtx.type] || ficheCtx.type) + ' · ' + (ficheCtx.name || ficheCtx.id)
        : '';
      syncLogin();
      overlay.classList.remove('hidden');
      textEl.focus();
    }

    window.vclNewTicket = () => open();   // utilisé par la liste des tickets (report-chat.js)
    // Connecté : toujours la liste des tickets (même vide, avec « Nouveau ticket ») ; sans compte : le formulaire
    btn.onclick = () => (typeof window.vclTicketsRefresh === 'function' ? window.vclTicketsRefresh({ open: true }) : open());
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
        const category = ficheCtx ? 'fiche' : (document.querySelector('input[name="vcl-cat"]:checked')?.value || 'autre');
        const sent = await window._vclLogReport(pseudo, page, text, ficheCtx, category);
        if (!sent) throw new Error('envoi refusé, réessaie plus tard');
        statusEl.textContent = 'Envoyé !';
        textEl.value = '';
        setTimeout(() => {
          close();
          if (window._vcl_uid) window.vclTicketsRefresh?.({ open: true });   // connecté : on montre la liste, avec le nouveau ticket
        }, 900);
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
