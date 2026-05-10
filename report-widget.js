(function () {
  const REPORT_WEBHOOK = 'https://discord.com/api/webhooks/1498346521765085386/beF1fOIgiwBxgoSovl_akVZFGpw2wsLpycAV2k0xk5Np0YyKYJwf_E6ff-U4VHIyzKCY';

  function init() {
    const logo = document.querySelector('.header-logo');
    if (!logo) return;

    const btn = document.createElement('button');
    btn.className = 'vcl-report-btn';
    btn.id = 'vcl-report-btn';
    btn.title = 'Signaler un bug / Suggestion';
    btn.textContent = '⚑ Bug / Suggestion';
    logo.insertAdjacentElement('afterend', btn);

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
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    document.getElementById('vcl-report-submit').onclick = async function () {
      const text = textEl.value.trim();
      if (!text) return;

      this.disabled = true;
      statusEl.textContent = 'Envoi...';

      try {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const res = await fetch(REPORT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: 'Bug / Suggestion',
              description: text,
              color: 15251531,
              footer: { text: page }
            }]
          })
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error('HTTP ' + res.status + (body ? ' — ' + body : ''));
        }
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
