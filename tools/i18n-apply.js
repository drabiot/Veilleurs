#!/usr/bin/env node
/**
 * i18n-apply.js — intègre un fichier téléchargé depuis i18n/review.html (bouton « Download my changes »)
 *
 *   node tools/i18n-apply.js <fichier.json> [--dry]
 *
 * • edits  : remplace la valeur anglaise de la clé dans i18n/en.json (ligne modifiée, le reste du fichier est intact)
 * • added  : nouvelles entrées, ajoutées en fin de fichier (section « reviewer »)
 * • status : ok / doubt / auto → i18n/review.json (qui a relu, quand)
 * • notes  : remarques du relecteur → review.json (champ « reviewerNote »)
 * Vérifier ensuite : node tools/i18n-check.js
 */
const fs = require('fs');
const path = require('path');

const [, , file, flag] = process.argv;
if (!file) { console.error('usage : node tools/i18n-apply.js <fichier.json> [--dry]'); process.exit(1); }
const dry = flag === '--dry';
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
if (d.format !== 'vcl-i18n-review/1') { console.error('✗ format inconnu'); process.exit(1); }

const I18N = path.join(__dirname, '..', 'i18n');
const enPath = path.join(I18N, 'en.json'), rvPath = path.join(I18N, 'review.json');
let raw = fs.readFileSync(enPath, 'utf8');
const crlf = raw.includes('\r\n'); raw = raw.replace(/\r\n/g, '\n');
const dict = JSON.parse(raw);
const review = fs.existsSync(rvPath) ? JSON.parse(fs.readFileSync(rvPath, 'utf8')) : { entries: {} };
review.entries ||= {};
const squash = s => String(s).replace(/\s+/g, ' ').trim();
const q = JSON.stringify;

let changed = 0, added = 0;
const lines = raw.split('\n');
for (const [k, v] of Object.entries(d.edits || {})) {
  if (!(k in dict)) { console.log('  ? clé absente de en.json, ignorée :', k); continue; }
  const head = q(k) + ':';
  const i = lines.findIndex(l => l.trimStart().startsWith(head));
  if (i < 0) { console.log('  ? ligne introuvable :', k); continue; }
  const comma = /,\s*$/.test(lines[i]) ? ',' : '';
  lines[i] = lines[i].slice(0, lines[i].indexOf(head)) + head + ' ' + q(v) + comma;
  changed++;
}
let out = lines.join('\n');
const fresh = (d.added || []).filter(a => a.fr && a.en && !(a.fr in dict));
if (fresh.length) {
  out = out.replace(/\s*\}\s*$/, '') + ',\n\n  ' + q('_section_reviewer_' + (d.date || '').slice(0, 10)) + ': ' + q('Entrées ajoutées par ' + (d.reviewer || 'le relecteur')) + ',\n'
    + fresh.map(a => `  ${q(a.fr)}: ${q(a.en)}`).join(',\n') + '\n}\n';
  added = fresh.length;
}
JSON.parse(out);   // doit rester valide

const at = (d.date || new Date().toISOString()).slice(0, 10);
for (const [k, st] of Object.entries(d.status || {})) {
  const e = review.entries[squash(k)] ||= { page: 'general' };
  e.status = st; if (st === 'ok') { e.by = d.reviewer || undefined; e.at = at; delete e.note; }
}
for (const a of fresh) review.entries[squash(a.fr)] ||= { page: 'reviewer', status: 'ok', by: d.reviewer || undefined, at };
for (const [k, n] of Object.entries(d.notes || {})) (review.entries[squash(k)] ||= { page: 'general', status: 'auto' }).reviewerNote = n;

console.log(`${changed} traduction(s) modifiée(s) · ${added} ajoutée(s) · ${Object.keys(d.status || {}).length} statut(s) · ${Object.keys(d.notes || {}).length} note(s)`);
if (dry) { console.log('(--dry : rien écrit)'); process.exit(0); }
fs.writeFileSync(enPath, crlf ? out.replace(/\n/g, '\r\n') : out);
fs.writeFileSync(rvPath, JSON.stringify(review, null, 2) + '\n');
console.log('✓ écrit. Lance : node tools/i18n-check.js');
