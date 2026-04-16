/* ══════════════════════════════════════════════════════
   TOAST — Notifications non-bloquantes
   Remplace tous les alert() de feedback positif/erreur.

   Usage :
     import { toast } from '../components/toast.js';
     toast('Item approuvé', 'success');
     toast('Erreur réseau', 'error');
     toast('Attention : champ vide', 'warning');
     toast('3 résultats trouvés', 'info');

   Types : 'success' | 'error' | 'warning' | 'info'
   Clic sur le toast = fermeture immédiate.
══════════════════════════════════════════════════════ */

let _container = null;

function getContainer() {
  if (_container) return _container;
  _container = document.createElement('div');
  _container.id = 'vcl-toast-container';
  _container.style.cssText = [
    'position:fixed',
    'bottom:20px',
    'right:20px',
    'display:flex',
    'flex-direction:column-reverse',
    'gap:6px',
    'z-index:9999',
    'pointer-events:none',
    'max-width:340px',
  ].join(';');
  document.body.appendChild(_container);
  return _container;
}

function ensureStyles() {
  if (document.getElementById('vcl-toast-style')) return;
  const s = document.createElement('style');
  s.id = 'vcl-toast-style';
  s.textContent = `
    @keyframes _vcl-in  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    @keyframes _vcl-out { from { opacity:1; transform:none; } to { opacity:0; transform:translateY(4px); } }
    #vcl-toast-container .vcl-toast {
      pointer-events:auto;
      border-radius:6px;
      padding:9px 13px;
      font-family:'JetBrains Mono',monospace;
      font-size:12px;
      line-height:1.4;
      display:flex;
      align-items:flex-start;
      gap:8px;
      cursor:pointer;
      word-break:break-word;
      animation:_vcl-in .18s ease;
    }
  `;
  document.head.appendChild(s);
}

const THEMES = {
  success: { bg: '#162216', border: '#3a7a3a', icon: '✓' },
  error:   { bg: '#221616', border: '#7a3a3a', icon: '✕' },
  warning: { bg: '#22200e', border: '#7a6a30', icon: '⚠' },
  info:    { bg: '#16202a', border: '#3a5a7a', icon: 'ℹ' },
};

/**
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=3200]  ms avant disparition automatique
 */
export function toast(message, type = 'info', duration = 3200) {
  ensureStyles();
  const container = getContainer();
  const t = THEMES[type] ?? THEMES.info;

  const el = document.createElement('div');
  el.className = 'vcl-toast';
  el.style.cssText = `background:${t.bg};border:1px solid ${t.border};color:var(--text,#ddd);`;
  el.innerHTML = `<span style="font-weight:700;flex-shrink:0;color:${t.border};">${t.icon}</span><span>${message}</span>`;
  container.appendChild(el);

  const dismiss = () => {
    el.style.animation = '_vcl-out .18s ease forwards';
    setTimeout(() => el.remove(), 190);
  };
  el.addEventListener('click', dismiss);
  const timer = setTimeout(dismiss, duration);
  el.addEventListener('click', () => clearTimeout(timer), { once: true });
}
