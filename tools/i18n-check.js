#!/usr/bin/env node
/**
 * i18n-check.js — contrôle qualité du dictionnaire i18n/en.json
 *
 *   node tools/i18n-check.js              erreurs + avertissements
 *   node tools/i18n-check.js --coverage   + textes français du HTML statique absents du dictionnaire
 *
 * Erreurs (code de sortie 1) : JSON invalide, clé en double, valeur vide, variables {x} différentes entre clé et valeur,
 *                              terme du glossaire non respecté.
 * Avertissements : valeur identique à la clé, reste de français dans la valeur.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'i18n', 'en.json');
const raw = fs.readFileSync(FILE, 'utf8');
let dict;
try { dict = JSON.parse(raw); } catch (e) { console.error('✗ en.json invalide :', e.message); process.exit(1); }
const glossaryFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'glossary.json'), 'utf8'));
const glossary = glossaryFile.terms || {};
const caseSensitive = new Set(glossaryFile.caseSensitive || []);   // termes ambigus en minuscule (ex. « carte » = card, « Carte » = Map)

const errors = [], warns = [];
const keep = new Set((dict._keep || []).map(s => s.replace(/\s+/g, ' ').trim()));
const noGloss = new Set((dict._noglossary || []).map(s => s.replace(/\s+/g, ' ').trim()));   // clés exemptées du glossaire (nom réel d'un salon, exemple…)
const vars = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const squash = s => s.replace(/\s+/g, ' ').trim();

// clés en double (JSON.parse garde la dernière sans prévenir)
const seen = new Map();
for (const m of raw.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
  const k = JSON.parse('"' + m[1] + '"');
  seen.set(k, (seen.get(k) || 0) + 1);
}
for (const [k, n] of seen) if (n > 1 && !k.startsWith('_')) errors.push(`clé en double (${n}×) : "${k}"`);

const wordRe = (w, cs) => new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', cs ? 'u' : 'iu');
const FR_STOP = /(^|\s)(le|la|les|des|du|une|et|pour|avec|dans|sur|est|sont|vous|nous)(\s|$)/i;
const FR_ACCENT = /[àâçéèêëîïôûùüœ]/i;

let count = 0;
for (const [k, v] of Object.entries(dict)) {
  if (k.startsWith('_')) continue;
  count++;
  if (typeof v !== 'string' || !v.trim()) { errors.push(`valeur vide : "${k}"`); continue; }
  if (vars(k) !== vars(v)) errors.push(`variables différentes : "${k}" → "${v}"`);
  if (squash(k) === squash(v) && !keep.has(squash(k)) && !/\{\w+\}/.test(k)) warns.push(`identique (ajouter à _keep ?) : "${k}"`);
  if (FR_STOP.test(v) || FR_ACCENT.test(v)) warns.push(`reste de français ? : "${k}" → "${v}"`);
  // le nom de la guilde est un nom propre : on l'enlève avant de tester le glossaire
  const kClean = k.replace(/veilleurs au clair de lune/gi, '');
  for (const [fr, en] of Object.entries(glossary)) {
    if (noGloss.has(squash(k))) break;
    if (wordRe(fr, caseSensitive.has(fr)).test(kClean) && !wordRe(en).test(v) && !new RegExp(en, 'i').test(v)) errors.push(`glossaire « ${fr} » → « ${en} » non respecté : "${k}" → "${v}"`);
  }
}

// couverture du HTML statique (optionnel)
if (process.argv.includes('--coverage')) {
  const pages = ['index.html', 'Compendium/compendium.html', 'Bestiaire/bestiaire.html', 'Quetes/quetes.html', 'Map/map.html', 'Builds/builds.html', 'Atelier/atelier.html', 'Patchnotes/patchnotes.html'];
  const known = new Set(Object.keys(dict).map(squash)); keep.forEach(k => known.add(k));
  const missing = new Map();
  for (const p of pages) {
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of html.matchAll(/>([^<>]+)</g)) {
      const t = squash(m[1].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));
      if (!/[A-Za-zÀ-ÿ]{3,}/.test(t) || known.has(t) || /^[\d\s.,:;/|+\-–—×x%()#@*•·→←↑↓]+$/.test(t) || /\$\{|\{\{/.test(t)) continue;
      (missing.get(t) || missing.set(t, new Set()).get(t)).add(p.split('/')[0]);
    }
    for (const m of html.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]{3,})"/g)) {
      const t = squash(m[1]);
      if (!known.has(t) && /[A-Za-zÀ-ÿ]{3,}/.test(t) && !/\$\{/.test(t)) (missing.get(t) || missing.set(t, new Set()).get(t)).add(p.split('/')[0]);
    }
  }
  console.log(`\nCouverture HTML statique : ${missing.size} texte(s) non traduit(s)`);
  for (const [t, pg] of [...missing].slice(0, 200)) console.log(`  [${[...pg].join(',')}] ${t}`);
}

console.log(`\n${count} entrées · ${errors.length} erreur(s) · ${warns.length} avertissement(s)`);
errors.forEach(e => console.log('  ✗ ' + e));
warns.forEach(w => console.log('  ⚠ ' + w));
process.exit(errors.length ? 1 : 0);
