/* ══════════════════════════════════════════════════════
   MODAL — Dialogs asynchrones non-bloquants
   Remplace confirm() et alert() natifs (qui bloquent le thread).

   Usage :
     import { modal } from '../components/modal.js';

     // Confirmation
     const ok = await modal.confirm('Supprimer ce mob ?', { danger: true });
     if (ok) { ... }

     // Alerte simple
     await modal.alert('Opération terminée.');

     // Options complètes
     modal.confirm('Écraser les données ?', {
       danger: true,
       confirmLabel: 'Écraser',
       cancelLabel: 'Annuler',
     });
══════════════════════════════════════════════════════ */

function ensureStyles() {
  if (document.getElementById('vcl-modal-style')) return;
  const s = document.createElement('style');
  s.id = 'vcl-modal-style';
  s.textContent = `
    @keyframes _vcl-modal-in { from { opacity:0; transform:scale(.96); } to { opacity:1; transform:none; } }
    .vcl-modal-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center;
      z-index:10000;
    }
    .vcl-modal-card {
      background:var(--surface,#1e1e2e);
      border:1px solid var(--border,#333);
      border-radius:8px;
      padding:22px 20px 18px;
      max-width:380px; width:90%;
      font-family:'JetBrains Mono',monospace;
      animation:_vcl-modal-in .15s ease;
    }
    .vcl-modal-msg {
      font-size:13px; color:var(--text,#ddd);
      line-height:1.55; margin-bottom:18px;
    }
    .vcl-modal-btns { display:flex; gap:8px; justify-content:flex-end; }
    .vcl-modal-btns .btn { font-size:12px; }
  `;
  document.head.appendChild(s);
}

function makeOverlay() {
  ensureStyles();
  const overlay = document.createElement('div');
  overlay.className = 'vcl-modal-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

export const modal = {
  /**
   * Dialogue de confirmation asynchrone.
   * @param {string} message
   * @param {{ danger?: boolean, confirmLabel?: string, cancelLabel?: string }} [opts]
   * @returns {Promise<boolean>}
   */
  confirm(message, opts = {}) {
    const {
      danger        = false,
      confirmLabel  = 'Confirmer',
      cancelLabel   = 'Annuler',
    } = opts;
    return new Promise(resolve => {
      const overlay = makeOverlay();
      const btnColor = danger ? 'var(--danger,#c0392b)' : 'var(--accent,#7c5cbf)';
      overlay.innerHTML = `
        <div class="vcl-modal-card">
          <div class="vcl-modal-msg">${message}</div>
          <div class="vcl-modal-btns">
            <button class="btn btn-ghost" id="_vcl-cancel">${cancelLabel}</button>
            <button class="btn" id="_vcl-confirm" style="background:${btnColor};color:#fff;">${confirmLabel}</button>
          </div>
        </div>
      `;
      const close = val => { overlay.remove(); resolve(val); };
      overlay.querySelector('#_vcl-confirm').addEventListener('click', () => close(true));
      overlay.querySelector('#_vcl-cancel').addEventListener('click', () => close(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    });
  },

  /**
   * Alerte asynchrone (un seul bouton OK).
   * @param {string} message
   * @param {{ label?: string }} [opts]
   * @returns {Promise<void>}
   */
  alert(message, opts = {}) {
    const { label = 'OK' } = opts;
    return new Promise(resolve => {
      const overlay = makeOverlay();
      overlay.innerHTML = `
        <div class="vcl-modal-card">
          <div class="vcl-modal-msg">${message}</div>
          <div class="vcl-modal-btns">
            <button class="btn" id="_vcl-ok" style="background:var(--accent,#7c5cbf);color:#fff;">${label}</button>
          </div>
        </div>
      `;
      const close = () => { overlay.remove(); resolve(); };
      overlay.querySelector('#_vcl-ok').addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    });
  },
};
