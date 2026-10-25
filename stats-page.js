// ══════════════════════════════════════════════════════
// Page « Statistiques » de la modération — rendu uniquement.
// Les données arrivent déjà agrégées par le worker (POST /stats, action « summary ») :
// ici on ne parcourt plus chaque profil, on met en forme.
// ══════════════════════════════════════════════════════

const SECTION_COLORS = {
  compendium: '#E0AC60', bestiaire: '#f87171', map: '#4ade80',
  quetes: '#fbbf24', atelier: '#60a5fa', patchnotes: '#a78bfa', builds: '#f97316',
};
const SECTION_LABELS = {
  compendium: '⚔️ Compendium', bestiaire: '💀 Bestiaire', map: '🗺️ Carte',
  quetes: '📜 Quêtes', atelier: '🔨 Atelier', patchnotes: '📰 Patchnotes', builds: '🏗️ Builds',
};
const SECTION_ICONS = {
  compendium: '⚔️', bestiaire: '💀', map: '🗺️', quetes: '📜', atelier: '🔨', patchnotes: '📰', builds: '🏗️',
};
const ALL_SECTIONS = Object.keys(SECTION_ICONS);
const TABS = [['audience', '👥 Audience'], ['contenu', '📚 Contenu'], ['qualite', '🛠️ Qualité'], ['quota', '🔥 Quota']];

const fmt = n => (n || 0).toLocaleString('fr-FR');
const fmtDate  = s => s?.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : (s || '');
const fmtMonth = s => s?.length >= 7  ? `${s.slice(5, 7)}/${s.slice(2, 4)}` : (s || '');
const fmtTime  = ms => ms ? new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

/** YYYY-MM-DD du jour local décalé de `offset` jours. */
export function statsDay(offset = 0, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Somme de `key` sur les jours daily dont la date est dans [from, to] (comparaison de chaînes ISO). */
const sumRange = (daily, from, to, key) => daily.reduce((s, x) => (x.d >= from && x.d <= to ? s + (x[key] || 0) : s), 0);

/** Pastille de variation face à la période précédente ; vide si on n'a rien à comparer. */
function delta(cur, prev) {
  if (!(prev > 0)) return '';
  const pct = Math.round((cur - prev) / prev * 100);
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '=';
  return `<span class="stats-delta stats-delta--${cls}" title="Période précédente : ${fmt(prev)}">${arrow} ${pct > 0 ? '+' : ''}${pct} %</span>`;
}

function kpi(icon, color, val, label, extra = '') {
  return `<div class="stats-kpi-card" style="--kpi-color:${color}">
    <div class="stats-kpi-icon">${icon}</div>
    <div class="stats-kpi-val">${val}</div>
    <div class="stats-kpi-lbl">${label}</div>
    ${extra ? `<div class="stats-kpi-delta">${extra}</div>` : ''}
  </div>`;
}

function dayChart(days, key, unitSing, unitPlur, esc) {
  const max = Math.max(...days.map(d => d[key]), 1);
  return `<div class="stats-day-chart">${days.map((x, i) => {
    const pct = Math.round(x[key] / max * 100);
    const label = `${x.d.slice(8, 10)}/${x.d.slice(5, 7)}`;
    return `<div class="stats-day-col" data-tooltip="${x[key]} ${x[key] === 1 ? unitSing : unitPlur} — ${label}">
      <div class="stats-day-track"><div class="stats-day-fill${x[key] > 0 ? ' stats-day-fill--active' : ''}" style="height:${pct}%"></div></div>
      <div class="stats-day-lbl">${i % 5 === 0 || i === days.length - 1 ? label : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

function barRows(entries, colorOf, labelOf, esc) {
  const max = Math.max(...entries.map(e => e[1]), 1);
  return entries.map(([k, v]) => `<div class="stats-sec-row">
    <div class="stats-sec-label">${esc(labelOf(k))}</div>
    <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${Math.round(v / max * 100)}%;background:${colorOf(k)}">${fmt(v)}</div></div>
  </div>`).join('');
}

// ── Onglet Audience ───────────────────────────────────
function audienceTab(s, ctx, esc) {
  const { daily, users, logins, hours } = s;
  const { today } = ctx;
  const d6 = statsDay(-6), d7 = statsDay(-7), d13 = statsDay(-13), d29 = statsDay(-29), d30 = statsDay(-30), d59 = statsDay(-59);

  const visitsToday = sumRange(daily, today, today, 'c');
  const visits7 = sumRange(daily, d6, today, 'c'), visits7p = sumRange(daily, d13, d7, 'c');
  const visits30 = sumRange(daily, d29, today, 'c'), visits30p = sumRange(daily, d59, d30, 'c');
  const uniq7 = sumRange(daily, d6, today, 'u'), uniq7p = sumRange(daily, d13, d7, 'u');
  const uniqToday = sumRange(daily, today, today, 'u');
  const visitsAll = daily.reduce((a, x) => a + x.c, 0);

  const kpis = `<div class="stats-kpi-grid">
    ${kpi('🧑‍🤝‍🧑', '#22d3ee', fmt(uniqToday), "Visiteurs uniques aujourd'hui")}
    ${kpi('🧑‍🤝‍🧑', '#22d3ee', fmt(uniq7), 'Uniques cumulés (7 jours)', delta(uniq7, uniq7p))}
    ${kpi('☀️', '#fbbf24', fmt(visitsToday), "Visites aujourd'hui")}
    ${kpi('📅', '#E0AC60', fmt(visits7), '7 derniers jours', delta(visits7, visits7p))}
    ${kpi('📆', '#60a5fa', fmt(visits30), '30 derniers jours', delta(visits30, visits30p))}
    ${kpi('🌍', '#4ade80', fmt(visitsAll), 'All-time')}
    ${kpi('👤', '#f87171', fmt(logins.today), "Connexions aujourd'hui", `${fmt(logins.week)} sur 7 jours`)}
  </div>`;

  // Fidélité : le suivi anonyme est lié au navigateur, pas à la personne — on montre donc des taux plutôt qu'un « nombre de visiteurs »
  const returning = Math.max(0, users.total - users.oneVisit);
  const retPct = users.total ? Math.round(returning / users.total * 100) : 0;
  const mobPct = users.mobile + users.desktop ? Math.round(users.mobile / (users.mobile + users.desktop) * 100) : 0;
  const depth = users.sessions ? (users.sectionVisits / users.sessions).toFixed(1) : '—';
  const fidelity = `<div class="stats-section">
    <div class="stats-section-title">Fidélité &amp; appareils</div>
    <div class="stats-kpi-grid">
      ${kpi('🔁', '#a78bfa', `${retPct} %`, 'Reviennent (≥ 2 visites)', `${fmt(returning)} sur ${fmt(users.total)} profils`)}
      ${kpi('🔥', '#4ade80', fmt(users.active7), 'Profils actifs (7 jours)', `${fmt(users.active30)} sur 30 jours`)}
      ${kpi('🌱', '#22d3ee', fmt(users.new7), 'Nouveaux profils (7 jours)')}
      ${kpi('📱', '#60a5fa', `${mobPct} %`, 'Sur mobile', `${fmt(users.mobile)} mobile · ${fmt(users.desktop)} desktop`)}
      ${kpi('📑', '#E0AC60', depth, 'Sections par session', `${fmt(users.sessions)} sessions`)}
      ${kpi('👤', '#7a7a90', `${fmt(users.members)} / ${fmt(users.anons)}`, 'Membres / navigateurs anonymes')}
    </div>
    <div class="stats-note">Un profil anonyme = un navigateur : vider le cache ou changer d'appareil en crée un nouveau, donc « profils » surestime le nombre de personnes. Les taux sont plus fiables que les totaux.</div>
  </div>`;

  const maxHour = Math.max(...hours, 1);
  const hourBars = hours.map((c, h) => {
    const label = String(h).padStart(2, '0') + 'h';
    return `<div class="stats-hour-col" data-tooltip="${c} visite${c !== 1 ? 's' : ''} — ${label}">
      <div class="stats-hour-track"><div class="stats-hour-fill" style="height:${Math.round(c / maxHour * 100)}%"></div></div>
      <div class="stats-hour-lbl">${h % 3 === 0 ? label : ''}</div>
    </div>`;
  }).join('');
  const loginRows = logins.recent.length
    ? logins.recent.map(l => `<div class="stats-login-row">
        <span class="stats-login-pseudo">${esc(l.pseudo || '?')}</span>
        <span class="stats-login-time">${esc(fmtTime(l.ts))}</span>
      </div>`).join('')
    : '<div class="stats-login-empty">Aucune connexion enregistrée</div>';

  const last30 = Array.from({ length: 30 }, (_, i) => statsDay(i - 29));
  const byDay = Object.fromEntries(daily.map(x => [x.d, x]));
  const days30 = last30.map(d => ({ d, c: byDay[d]?.c || 0, u: byDay[d]?.u || 0 }));

  const byMonth = {};
  for (const x of daily) byMonth[x.d.slice(0, 7)] = (byMonth[x.d.slice(0, 7)] || 0) + x.c;
  const monthRows = Object.keys(byMonth).sort().reverse()
    .map(m => `<tr><td style="font-weight:600;">${esc(fmtMonth(m))}</td><td style="font-weight:700;text-align:right;">${fmt(byMonth[m])}</td></tr>`).join('');

  return `${kpis}${fidelity}
    <div class="stats-mid-grid">
      <div class="stats-section"><div class="stats-section-title">Activité par heure (all-time)</div><div class="stats-hour-chart">${hourBars}</div></div>
      <div class="stats-section"><div class="stats-section-title">Connexions récentes</div><div class="stats-login-list">${loginRows}</div></div>
    </div>
    <div class="stats-section"><div class="stats-section-title">Visites par jour — 30 derniers jours</div>${dayChart(days30, 'c', 'visite', 'visites', esc)}</div>
    <div class="stats-section"><div class="stats-section-title">Visiteurs uniques par jour — 30 derniers jours</div>${dayChart(days30, 'u', 'visiteur unique', 'visiteurs uniques', esc)}
      <div class="stats-note">1 navigateur = 1 visiteur par jour. Collecté depuis l'ajout de ce suivi : les jours antérieurs restent vides.</div></div>
    <div class="stats-section"><div class="stats-section-title">Tableau mensuel</div>
      <table class="stats-table"><thead><tr><th>Mois</th><th style="text-align:right;">Total</th></tr></thead><tbody>${monthRows}</tbody></table></div>
    ${membersTable(s, ctx, esc)}`;
}

function membersTable(s, ctx, esc) {
  const rows = [...s.members];
  if (s.anonRest) {
    rows.push({ id: '__anon__', pseudo: `+${fmt(s.anonRest.n)} autres anonymes`, isAnonymous: true,
      total: s.anonRest.total, lastSeen: s.anonRest.lastSeen, sections: s.anonRest.sections });
  }
  if (!rows.length) return '';
  const cols = ALL_SECTIONS.filter(sec => rows.some(u => u.sections?.[sec] > 0));
  const body = rows.map(u => {
    const badge = u.isAnonymous
      ? '<span class="stats-badge stats-badge--anon">anon</span>'
      : '<span class="stats-badge stats-badge--member">membre</span>';
    const cells = cols.map(sec => { const v = u.sections?.[sec] || 0; return `<td style="text-align:right;color:${v > 0 ? 'var(--text)' : 'var(--muted)'}">${v > 0 ? fmt(v) : '—'}</td>`; }).join('');
    const click = u.id !== '__anon__';
    const name = u.isAnonymous && click ? ctx.anonName(u.id) : (u.pseudo || u.id);
    return `<tr class="stats-member-row" ${click ? `data-uid="${esc(u.id)}" style="cursor:pointer;" title="Voir l'historique"` : ''}>
      <td style="display:flex;align-items:center;gap:6px;">${badge} ${esc(name)}</td>${cells}
      <td style="text-align:right;font-weight:700;">${fmt(u.total)}</td>
      <td style="text-align:right;color:var(--muted);font-size:11px;">${esc(fmtDate(u.lastSeen))}</td></tr>`;
  }).join('');
  return `<div class="stats-section" id="stats-membres-section">
    <div class="stats-section-title">Visites par membre</div>
    <div style="overflow-x:auto;"><table class="stats-table" id="stats-members-table">
      <thead><tr><th>Membre</th>${cols.map(c => `<th style="text-align:right;">${esc(SECTION_ICONS[c])}</th>`).join('')}<th style="text-align:right;">Total</th><th style="text-align:right;">Dernière visite</th></tr></thead>
      <tbody>${body}</tbody></table></div>
    <div id="stats-user-detail" class="stats-user-detail" style="display:none;"></div>
  </div>`;
}

// ── Onglet Contenu ────────────────────────────────────
function contenuTab(s, ctx, esc) {
  const sections = Object.entries(s.sections).sort((a, b) => b[1] - a[1]);
  const secHtml = sections.length
    ? barRows(sections, k => SECTION_COLORS[k] || '#7a7a90', k => SECTION_LABELS[k] || k, esc)
    : '<div class="stats-note">Aucune visite de section enregistrée.</div>';
  const top = s.topItems.length
    ? barRows(s.topItems.map((it, i) => [`${i + 1}. ${it.name || it.id}`, it.count]), () => '#E0AC60', k => k, esc)
    : '<div class="stats-note">Pas encore de consultation d\'item enregistrée.</div>';
  const tags = s.topSearches.map(t => `<span class="stats-tag">${esc(t.term)} <b>${fmt(t.count)}</b></span>`).join('');
  return `<div class="stats-section"><div class="stats-section-title">Répartition par section</div>${secHtml}</div>
    <div class="stats-section"><div class="stats-section-title">Top 10 items consultés (compendium)</div>${top}</div>
    <div class="stats-section"><div class="stats-section-title">Top recherches</div>
      ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${tags}</div>` : '<div class="stats-note">Pas encore de recherche enregistrée.</div>'}</div>`;
}

// ── Onglet Qualité ────────────────────────────────────
function qualiteTab(s, ctx, esc) {
  let html = '';
  const items = ctx.items;
  if (items.length) {
    const total = items.length;
    const checks = [
      ['🖼️ Avec image', i => i.images?.length || i.img],
      ['📖 Avec lore', i => i.lore],
      ['📍 Avec obtention', i => i.obtain],
      ['🔨 Avec craft', i => Array.isArray(i.craft) ? i.craft.length : i.craft],
      ['📊 Avec stats', i => i.stats && Object.keys(i.stats).length],
    ];
    html += `<div class="stats-section"><div class="stats-section-title">Qualité du wiki — ${fmt(total)} items</div>${checks.map(([label, f]) => {
      const n = items.filter(f).length, pct = Math.round(n / total * 100);
      const color = pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171';
      return `<div class="stats-sec-row"><div class="stats-sec-label">${label}</div>
        <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${pct}%;background:${color}">${n}/${total} (${pct}%)</div></div></div>`;
    }).join('')}</div>`;
  }
  if (ctx.reports.length) {
    html += `<div class="stats-section"><div class="stats-section-title">Rapports récents (10 derniers)</div>${ctx.reports.map(r => `
      <div class="stats-report">
        <div class="stats-report-head"><b>${esc(r.pseudo || 'Anonyme')}</b><span>${esc(r.page || '')} · ${esc(fmtTime(r.ts))}</span></div>
        <div class="stats-report-text">${esc((r.text || '').slice(0, 200))}</div>
      </div>`).join('')}</div>`;
  }
  return html || '<div class="empty">Rien à signaler.</div>';
}


// ── Onglet Quota Firestore ────────────────────────────
const METERS = [['read', '📖 Lectures'], ['write', '✏️ Écritures'], ['delete', '🗑️ Suppressions']];

function quotaTab() { return '<div id="stats-quota"><div class="empty">Chargement…</div></div>'; }

function quotaHtml(q, esc) {
  if (q.error === 'permission') {
    const iam = `https://console.cloud.google.com/iam-admin/iam?project=${encodeURIComponent(q.projectId)}`;
    const api = `https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=${encodeURIComponent(q.projectId)}`;
    const fb  = `https://console.firebase.google.com/project/${encodeURIComponent(q.projectId)}/firestore/usage`;
    return `<div class="stats-section"><div class="stats-section-title">Quota Firestore</div>
      <div class="stats-note" style="font-size:12px;">Le compte de service du site n'a pas encore le droit de lire les métriques Firestore. Pour afficher le quota ici :</div>
      <ol class="stats-note" style="font-size:12px;padding-left:18px;">
        <li>Ouvre <a href="${esc(iam)}" target="_blank" rel="noopener" style="color:var(--accent)">Google Cloud → IAM</a> puis <b>Accorder l'accès</b>.</li>
        <li>Principal : <code>${esc(q.saEmail)}</code></li>
        <li>Rôle : <b>Lecteur Monitoring</b> (<i>Monitoring Viewer</i>), puis Enregistrer.</li>
        <li>Vérifie que <a href="${esc(api)}" target="_blank" rel="noopener" style="color:var(--accent)">l'API Cloud Monitoring</a> est activée.</li>
        <li>Reviens ici et clique sur Actualiser (la permission peut mettre une minute à s'appliquer).</li>
      </ol>
      <div class="stats-note">En attendant, le détail officiel est dans la <a href="${esc(fb)}" target="_blank" rel="noopener" style="color:var(--accent)">console Firebase → Firestore → Usage</a>.</div>
      <div><button class="stats-tab" data-quota-refresh>🔄 Actualiser</button></div></div>`;
  }
  if (q.error) {
    return `<div class="stats-section"><div class="stats-section-title">Quota Firestore</div>
      <div style="color:var(--danger);font-size:12px;">Lecture des métriques impossible : ${esc(q.message || q.error)}</div>
      <div><button class="stats-tab" data-quota-refresh>🔄 Réessayer</button></div></div>`;
  }

  const elapsedH = Math.max((q.now - q.dayStart) / 3600000, 0.0001);
  const pctOf = (k, v) => v / q.limits[k] * 100;
  const color = p => p >= 80 ? '#f87171' : p >= 50 ? '#fbbf24' : '#4ade80';
  const worst = Math.max(...METERS.map(([k]) => pctOf(k, q.today[k])));
  const projWorst = elapsedH >= 1 ? Math.max(...METERS.map(([k]) => pctOf(k, q.today[k] / elapsedH * 24))) : worst;
  const risk = Math.max(worst, projWorst);
  const verdict = risk >= 100 ? ['🛑', "Quota atteint ou en passe de l'être aujourd'hui", '#f87171']
    : risk >= 70 ? ['⚠️', "À surveiller : le quota risque d'être atteint avant la remise à zéro", '#fbbf24']
    : ['✅', 'Tout va bien : large marge pour la journée', '#4ade80'];

  const left = Math.max(q.resetAt - q.now, 0);
  const resetIn = `${Math.floor(left / 3600000)} h ${String(Math.floor(left % 3600000 / 60000)).padStart(2, '0')}`;
  const resetAt = new Date(q.resetAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const meters = METERS.map(([k, label]) => {
    const v = q.today[k], lim = q.limits[k], p = pctOf(k, v);
    const proj = elapsedH >= 1 ? Math.round(v / elapsedH * 24) : null;
    return `<div class="stats-meter">
      <div class="stats-meter-head"><span>${label}</span><span><b>${fmt(v)}</b> / ${fmt(lim)}</span></div>
      <div class="stats-meter-track"><div class="stats-meter-fill" style="width:${Math.min(p, 100)}%;background:${color(p)}"></div></div>
      <div class="stats-meter-foot"><span style="color:${color(p)};font-weight:700;">${p.toFixed(p < 10 ? 1 : 0)} %</span>
        <span>${proj != null ? `au rythme actuel : ~${fmt(proj)} en fin de journée` : 'trop tôt pour projeter'} · hier : ${fmt(q.yesterday[k])}</span></div>
    </div>`;
  }).join('');

  const byHour = Object.fromEntries(q.hourly.map(x => [x.h, x]));
  const slots = Array.from({ length: 24 }, (_, i) => q.dayStart + i * 3600000);
  const max = Math.max(...q.hourly.map(x => x.read), 1);
  const bars = slots.map(h => {
    const c = byHour[h]?.read || 0, future = h > q.now;
    const label = new Date(h).toLocaleTimeString('fr-FR', { hour: '2-digit' });
    return `<div class="stats-hour-col" data-tooltip="${fmt(c)} lecture${c !== 1 ? 's' : ''} — ${label}h">
      <div class="stats-hour-track"><div class="stats-hour-fill" style="height:${Math.round(c / max * 100)}%;${future ? 'opacity:.25' : ''}"></div></div>
      <div class="stats-hour-lbl">${new Date(h).getHours() % 3 === 0 ? label + 'h' : ''}</div></div>`;
  }).join('');

  return `<div class="stats-section"><div class="stats-section-title">Quota Firestore — aujourd'hui</div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:${verdict[2]};font-weight:700;">${verdict[0]} ${verdict[1]}</div>
      <div class="stats-note">Remise à zéro dans <b>${resetIn}</b> (à ${resetAt}, heure locale). Offre gratuite : 50 000 lectures, 20 000 écritures, 20 000 suppressions par jour.</div>
      ${meters}
      <div><button class="stats-tab" data-quota-refresh>🔄 Actualiser</button></div></div>
    <div class="stats-section"><div class="stats-section-title">Lectures par heure (depuis la dernière remise à zéro)</div>
      <div class="stats-hour-chart">${bars}</div>
      <div class="stats-note">Source : Google Cloud Monitoring, avec quelques minutes de décalage. Seules comptent les lectures qui atteignent Firestore : celles servies par le cache du navigateur ou par D1 n'y figurent pas.</div></div>`;
}

// ── Détail d'un visiteur (clic sur une ligne du tableau) ──
function userDetailHtml(u, fallbackName, esc) {
  if (!u) return '<div style="color:var(--muted);font-size:12px;">Aucune donnée trouvée pour ce visiteur.</div>';
  const mob = u.devices?.mobile || 0, desk = u.devices?.desktop || 0;
  const meta = [
    u.total ? `${fmt(u.total)} visite${u.total > 1 ? 's' : ''}` : '',
    u.totalSessions ? `${fmt(u.totalSessions)} session${u.totalSessions > 1 ? 's' : ''}` : '',
    u.firstSeen ? `1ère visite ${esc(fmtDate(u.firstSeen))}` : '',
    u.lastSeen ? `dernière ${esc(fmtDate(u.lastSeen))}` : '',
    mob + desk > 0 ? `📱 ${mob} mobile · 🖥️ ${desk} desktop` : '',
  ].filter(Boolean).join(' · ');
  const list = (data, names, label, max = 12) => {
    if (!data || !Object.keys(data).length) return '';
    const rows = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, max).map(([id, c]) =>
      `<div class="stats-detail-row"><span>${esc(names?.[id] || id.replace(/_/g, ' '))}</span><span>${fmt(c)}×</span></div>`).join('');
    return `<div class="stats-detail-title">${label}</div>${rows}`;
  };
  const searches = u.searches && Object.keys(u.searches).length
    ? `<div class="stats-detail-title">🔍 Recherches</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${
      Object.entries(u.searches).sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([t, c]) => `<span class="stats-tag">${esc(t.replace(/_/g, ' '))} <b>${c}</b></span>`).join('')}</div>` : '';
  const body = list(u.items, u.itemNames, '⚔️ Items consultés') + list(u.mobs, u.mobNames, '💀 Monstres consultés')
    + list(u.pnj, u.pnjNames, '🧑 PNJ consultés') + list(u.quetes, u.queteNames, '📜 Quêtes consultées') + searches;
  return `<div style="font-weight:700;font-size:13px;margin-bottom:3px;color:var(--accent);">${esc(u.pseudo || fallbackName)}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${meta}</div>
    ${body || '<div style="color:var(--muted);font-size:12px;margin-top:8px;">Aucun détail enregistré — les données se collecteront lors des prochaines visites.</div>'}`;
}

/**
 * Affiche la page stats dans `container`.
 * @param s     résumé du worker (daily, hours, users, sections, members, anonRest, topItems, topSearches, logins)
 * @param ctx   { items, reports: [{pseudo, page, text, ts}], anonName(id) }
 * @param deps  { escHtml, loadUser(id) → user|null, loadAudit(uid) → [{label, target, ts}], loadQuota() → quota Firestore du jour }
 */
export function renderStats(container, s, ctx, deps) {
  const esc = deps.escHtml;
  ctx = { ...ctx, today: statsDay(0) };
  const tabs = { audience: audienceTab, contenu: contenuTab, qualite: qualiteTab, quota: quotaTab };
  let tab = window._statsTab && tabs[window._statsTab] ? window._statsTab : 'audience';

  const draw = () => {
    container.innerHTML = `<div class="stats-tabs">${TABS.map(([id, label]) =>
      `<button class="stats-tab${id === tab ? ' active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="stats-tab-body">${tabs[tab](s, ctx, esc)}</div>`;
    if (tab === 'quota') fillQuota();
  };

  const fillQuota = async () => {
    const box = container.querySelector('#stats-quota');
    if (!box) return;
    box.innerHTML = '<div class="empty">Chargement…</div>';
    try { box.innerHTML = quotaHtml(await deps.loadQuota(), esc); }
    catch (err) { box.innerHTML = `<div style="color:var(--danger);font-size:12px;">Erreur : ${esc(err.message)}</div>`; }
  };
  draw();

  container.onclick = async e => {
    if (e.target.closest('[data-quota-refresh]')) { fillQuota(); return; }
    const t = e.target.closest('.stats-tab[data-tab]');
    if (t) { tab = window._statsTab = t.dataset.tab; draw(); return; }

    const row = e.target.closest('.stats-member-row[data-uid]');
    const panel = container.querySelector('#stats-user-detail');
    if (!row || !panel) return;
    const uid = row.dataset.uid;
    if (panel.dataset.uid === uid && panel.style.display !== 'none') { panel.style.display = 'none'; panel.dataset.uid = ''; return; }
    panel.dataset.uid = uid;
    panel.style.display = '';
    const name = row.querySelector('td')?.textContent?.trim() || uid;
    panel.innerHTML = '<div style="color:var(--muted);font-size:12px;">Chargement…</div>';
    let top = '';
    try { top = userDetailHtml(await deps.loadUser(uid), name, esc); }
    catch (err) { panel.innerHTML = `<div style="color:var(--danger);font-size:12px;">Erreur : ${esc(err.message)}</div>`; return; }
    panel.innerHTML = top + '<div style="color:var(--muted);font-size:12px;margin-top:8px;">Chargement de l\'historique…</div>';
    try {
      const audit = await deps.loadAudit(uid);
      panel.innerHTML = top + (audit.length ? `<div class="stats-detail-title" style="border-top:1px solid var(--border);padding-top:10px;">Historique des actions</div>${audit.map(a =>
        `<div class="stats-audit-row"><span>${esc(fmtTime(a.ts))}</span><span>${esc(a.label)}</span><span>${esc(a.target || '')}</span></div>`).join('')}` : '');
    } catch (err) {
      panel.innerHTML = top + `<div style="color:var(--danger);font-size:12px;">Historique indisponible : ${esc(err.message)}</div>`;
    }
  };
}
