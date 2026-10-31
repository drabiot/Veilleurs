/* ══════════════════════════════════════════════════════
   TICKETS — « Nous contacter » (joueur connecté)
   Chargé par auth-widget.js. Un ticket = un document de la collection `reports` créé par report-widget.js (bug, suggestion, autre, erreur de fiche) :
   le texte d'origine puis `messages` [{ from: 'user'|'admin', text, at }]. Le joueur retrouve ici tous ses tickets (ouverts ou clos), lit les réponses
   des admins et leur répond ; une réponse non lue = pastille sur le bouton « Nous contacter » (window.vclSetTickets, défini par report-widget.js).
   Anciennes réponses (champ `reply`) : affichées comme un premier message des admins. Clore = `closedAt` ; écrire de nouveau rouvre le ticket.
══════════════════════════════════════════════════════ */

import { collection, doc, getDocs, query, where, updateDoc, arrayUnion } from './d1db.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ms = t => t?.toMillis?.() ?? t?.__ts ?? (typeof t === 'number' ? t : 0);
const fmt = t => t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

const LOGO = new URL('img/VeilleursLogo.png', import.meta.url).href;   // blason des Veilleurs : en-tête et réponses des admins
const CATS = { bug: '🐛 Bug', suggestion: '💡 Suggestion', autre: '❓ Autre', fiche: '⚑ Fiche' };
const STATES = { waiting: '⏳ En attente', answered: '💬 Réponse reçue', closed: '✔ Clos' };

/** Conversation complète : texte d'origine, ancienne réponse (champ `reply`), puis les messages. */
function thread(r) {
  const out = [{ from: 'user', text: r.text || '', at: ms(r.createdAt) }];
  if (r.reply) out.push({ from: 'admin', text: r.reply, at: ms(r.replyAt) });
  return out.concat(r.messages || []);
}
const lastMsg = r => { const t = thread(r); return t[t.length - 1]; };
const lastAt = r => lastMsg(r).at || 0;
const isUnread = r => r.unreadUser === true || (!!r.reply && !r.replySeen && r.unreadUser !== false);
function status(r) {
  if (r.closedAt && lastAt(r) <= r.closedAt) return 'closed';
  return lastMsg(r).from === 'admin' ? 'answered' : 'waiting';
}

export function initReportChat(db, uid) {
  let convs = [];
  let loadFailed = false;
  let ov = null;

  async function load() {
    try {
      loadFailed = false;
      const snap = await getDocs(query(collection(db, 'reports'), where('submittedBy', '==', uid)));
      convs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => isUnread(b) - isUnread(a) || (status(a) === 'closed') - (status(b) === 'closed') || lastAt(b) - lastAt(a))   // réponses non lues d'abord, clos en dernier.slice(0, 30);
    } catch (e) { convs = []; loadFailed = true; console.warn('[tickets]', e.message); }
    paint();
  }

  function paint() {
    window.vclSetTickets?.({ total: convs.length, unread: convs.filter(isUnread).length, open });
  }

  const bubbles = r => thread(r).map(m => {
    const admin = m.from === 'admin';
    return `<div class="vcl-chat-msg ${admin ? 'admin' : 'me'}">${admin ? `<img class="vcl-chat-avatar" src="${LOGO}" alt="">` : ''}
      <div class="vcl-chat-stack"><div class="vcl-chat-who">${admin ? 'Les Veilleurs' : 'Toi'} · ${fmt(m.at)}</div>
      <div class="vcl-chat-text">${esc(m.text).split('\n').join('<br>')}</div></div></div>`;
  }).join('');

  const cardHtml = r => {
    const st = status(r), cat = r.ficheId ? 'fiche' : (r.category || 'autre');
    const tag = r.ficheId ? '⚑ ' + esc(r.ficheName || r.ficheId) : (CATS[cat] || '🎫 Ticket');
    return `<div class="vcl-chat c-${esc(cat)}${isUnread(r) ? ' is-unread' : ''}" data-id="${esc(r.id)}">
      <div class="vcl-chat-head" role="button" tabindex="0">
        <div class="vcl-chat-label"><span class="vcl-chip">${tag}</span>${isUnread(r) ? '<span class="vcl-chat-new">NOUVEAU</span>' : ''}<span class="vcl-chat-state s-${st}">${STATES[st]}</span></div>
        <div class="vcl-chat-quote">${esc(String(r.text || '').slice(0, 140))}</div>
        <div class="vcl-chat-date">Dernier message : ${fmt(lastAt(r))}</div>
      </div>
      <div class="vcl-chat-detail" hidden>
        <div class="vcl-chat-log">${bubbles(r)}</div>
        <div class="vcl-chat-send"><textarea rows="1" maxlength="2000" placeholder="Écrire aux Veilleurs…"></textarea><button type="button" class="vcl-chat-go">Envoyer</button></div>
        <div class="vcl-chat-status"></div>
        ${st === 'closed' ? '' : '<button type="button" class="vcl-chat-resolve">✔ Marquer comme résolu</button>'}
      </div>
    </div>`;
  };

  function close() { ov?.remove(); ov = null; document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function rerender(box, r) {
    const wasOpen = !box.querySelector('.vcl-chat-detail').hidden;
    box.outerHTML = cardHtml(r);
    if (wasOpen) { const nb = ov.querySelector(`.vcl-chat[data-id="${CSS.escape(r.id)}"]`); nb.querySelector('.vcl-chat-detail').hidden = false; nb.classList.add('is-open'); nb.querySelector('.vcl-chat-log').scrollTop = 1e9; }
  }

  async function open() {
    await load();   // à jour au moment d'ouvrir (une réponse a pu arriver depuis le chargement de la page)
    close();
    ov = document.createElement('div');
    ov.id = 'vcl-reply-overlay';
    ov.className = 'vcl-reply-overlay';
    ov.innerHTML = `<div class="vcl-reply-modal vcl-chat-modal"><div class="vcl-reply-bar"><div class="vcl-reply-title"><img class="vcl-chat-crest" src="${LOGO}" alt=""><div><h3>Nous contacter</h3><span class="vcl-reply-sub">Les Veilleurs te répondent</span></div></div>`
      + '<span class="vcl-reply-bar-actions"><button type="button" class="vcl-chat-new-ticket">＋ Nouveau ticket</button><button type="button" class="vcl-chat-close" title="Fermer">✕</button></span></div>'
      + '<div class="vcl-chat-body">' + (loadFailed ? '<div class="vcl-chat-empty"><b>⚠</b>Impossible de charger tes tickets pour le moment.<br>Réessaie dans un instant.</div>' : convs.length ? convs.map(cardHtml).join('') : '<div class="vcl-chat-empty">Tu n\'as encore aucun ticket.</div>') + '</div></div>';
    document.body.appendChild(ov);
    document.addEventListener('keydown', onKey);
    ov.onclick = async e => {
      if (e.target === ov) return close();
      if (e.target.closest('.vcl-chat-close')) return close();
      if (e.target.closest('.vcl-chat-new-ticket')) { close(); window.vclNewTicket?.(); return; }
      const box = e.target.closest('.vcl-chat');
      if (!box) return;
      const r = convs.find(x => x.id === box.dataset.id);
      if (!r) return;
      const detail = box.querySelector('.vcl-chat-detail');

      if (e.target.closest('.vcl-chat-head')) {          // déplier / replier ; déplier = lu
        detail.hidden = !detail.hidden;
        box.classList.toggle('is-open', !detail.hidden);
        if (!detail.hidden) {
          box.querySelector('.vcl-chat-log').scrollTop = 1e9;
          if (isUnread(r)) {
            r.unreadUser = false; r.replySeen = true;
            box.classList.remove('is-unread');
            box.querySelector('.vcl-chat-new')?.remove();
            updateDoc(doc(db, 'reports', r.id), { unreadUser: false, replySeen: true }).catch(() => {});
            paint();
          }
        }
        return;
      }
      if (e.target.closest('.vcl-chat-go')) {
        const ta = box.querySelector('textarea'), btn = e.target.closest('.vcl-chat-go'), st = box.querySelector('.vcl-chat-status');
        const text = ta.value.trim();
        if (!text) return;
        btn.disabled = true; st.textContent = 'Envoi…';
        try {
          const msg = { from: 'user', text, at: Date.now() };
          await updateDoc(doc(db, 'reports', r.id), { messages: arrayUnion(msg), unreadUser: false, replySeen: true });
          r.messages = [...(r.messages || []), msg]; r.unreadUser = false; r.replySeen = true;
          rerender(box, r);
          const nb = ov.querySelector(`.vcl-chat[data-id="${CSS.escape(r.id)}"]`);
          nb.querySelector('.vcl-chat-status').textContent = 'Envoyé, les admins sont prévenus.';
        } catch (err) { st.textContent = 'Erreur : ' + (err.message || 'envoi refusé'); btn.disabled = false; }
        return;
      }
      if (e.target.closest('.vcl-chat-resolve')) {
        try {
          r.closedAt = Date.now();
          await updateDoc(doc(db, 'reports', r.id), { closedAt: r.closedAt });
          rerender(box, r);
          paint();
        } catch (err) { r.closedAt = null; box.querySelector('.vcl-chat-status').textContent = 'Erreur : ' + (err.message || 'refusé'); }
      }
    };
    // un ticket avec une réponse non lue s'ouvre directement
    const firstUnread = convs.find(isUnread);
    if (firstUnread) ov.querySelector(`.vcl-chat[data-id="${CSS.escape(firstUnread.id)}"] .vcl-chat-head`)?.click();
  }

  window.vclTicketsRefresh = opts => (opts?.open ? open() : load());
  return load();
}
