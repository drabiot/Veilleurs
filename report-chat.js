/* ══════════════════════════════════════════════════════
   RÉPONSES AUX SIGNALEMENTS — conversation avec les admins
   Chargé par auth-widget.js une fois le joueur connecté. Un signalement (collection `reports`) est une conversation :
   le texte d'origine puis `messages` [{ from: 'user'|'admin', text, at }]. Quand les admins ont répondu, une bulle apparaît à droite du
   bouton « Bug / Suggestion » (report-widget.js : window.vclSetReportBubble) ; un clic ouvre les conversations, où le joueur peut répondre.
   Anciennes réponses (champ `reply`) : affichées comme un premier message des admins.
══════════════════════════════════════════════════════ */

import { collection, doc, getDocs, query, where, updateDoc, arrayUnion } from './d1db.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ms = t => t?.toMillis?.() ?? t?.__ts ?? (typeof t === 'number' ? t : 0);
const fmt = t => t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

/** Conversation complète : texte d'origine, ancienne réponse (champ `reply`), puis les messages. */
function thread(r) {
  const out = [{ from: 'user', text: r.text || '', at: ms(r.createdAt) }];
  if (r.reply) out.push({ from: 'admin', text: r.reply, at: ms(r.replyAt) });
  return out.concat(r.messages || []);
}
const hasAdmin = r => thread(r).some(m => m.from === 'admin');
const isUnread = r => r.unreadUser === true || (!!r.reply && !r.replySeen && r.unreadUser !== false);
const lastAt = r => { const t = thread(r); return t[t.length - 1].at || 0; };

export function initReportChat(db, uid) {
  let convs = [];

  async function load() {
    try {
      const snap = await getDocs(query(collection(db, 'reports'), where('submittedBy', '==', uid)));
      convs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(hasAdmin).sort((a, b) => lastAt(b) - lastAt(a)).slice(0, 10);
    } catch { convs = []; }
    paint();
  }

  function paint() {
    window.vclSetReportBubble?.(convs.length ? { total: convs.length, unread: convs.filter(isUnread).length, open } : null);
  }

  function bubbles(r) {
    return thread(r).map(m => `<div class="vcl-chat-msg ${m.from === 'admin' ? 'admin' : 'me'}">
      <div class="vcl-chat-who">${m.from === 'admin' ? 'Les admins' : 'Toi'} · ${fmt(m.at)}</div>
      <div class="vcl-chat-text">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`).join('');
  }

  async function open() {
    await load();   // à jour au moment d'ouvrir (une réponse a pu arriver depuis le chargement de la page)
    if (!convs.length || document.getElementById('vcl-reply-overlay')) return;
    const unreadIds = convs.filter(isUnread).map(r => r.id);
    const ov = document.createElement('div');
    ov.id = 'vcl-reply-overlay';
    ov.className = 'vcl-reply-overlay';
    ov.innerHTML = '<div class="vcl-reply-modal vcl-chat-modal"><button type="button" class="vcl-chat-close" title="Fermer">✕</button>'
      + '<h3>💬 Échanges avec les admins</h3>'
      + convs.map(r => `<div class="vcl-chat" data-id="${esc(r.id)}">
          <div class="vcl-chat-head">${r.ficheId ? '⚑ ' + esc(r.ficheName || r.ficheId) + ' — ' : ''}${esc(String(r.text || '').slice(0, 80))}${unreadIds.includes(r.id) ? ' <span class="vcl-chat-new">nouveau</span>' : ''}</div>
          <div class="vcl-chat-log">${bubbles(r)}</div>
          <div class="vcl-chat-send"><textarea rows="2" maxlength="2000" placeholder="Répondre aux admins…"></textarea><button type="button">Envoyer</button></div>
          <div class="vcl-chat-status"></div>
        </div>`).join('')
      + '</div>';
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelector('.vcl-chat-close').onclick = close;
    ov.querySelectorAll('.vcl-chat-log').forEach(l => { l.scrollTop = l.scrollHeight; });

    ov.querySelectorAll('.vcl-chat').forEach(box => {
      const r = convs.find(x => x.id === box.dataset.id);
      const ta = box.querySelector('textarea'), btn = box.querySelector('.vcl-chat-send button'), st = box.querySelector('.vcl-chat-status');
      btn.onclick = async () => {
        const text = ta.value.trim();
        if (!text) return;
        btn.disabled = true; st.textContent = 'Envoi…';
        try {
          const msg = { from: 'user', text, at: Date.now() };
          await updateDoc(doc(db, 'reports', r.id), { messages: arrayUnion(msg), unreadUser: false, replySeen: true });
          r.messages = [...(r.messages || []), msg]; r.unreadUser = false; r.replySeen = true;
          box.querySelector('.vcl-chat-log').innerHTML = bubbles(r);
          box.querySelector('.vcl-chat-log').scrollTop = 1e9;
          ta.value = ''; st.textContent = 'Envoyé, les admins sont prévenus.';
        } catch (e) { st.textContent = 'Erreur : ' + (e.message || 'envoi refusé'); }
        btn.disabled = false;
      };
    });

    // Ouverture = lu
    unreadIds.forEach(id => updateDoc(doc(db, 'reports', id), { unreadUser: false, replySeen: true }).catch(() => {}));
    convs.forEach(r => { if (unreadIds.includes(r.id)) { r.unreadUser = false; r.replySeen = true; } });
    paint();
  }

  return load();
}
