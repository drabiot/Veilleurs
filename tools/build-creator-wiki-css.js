#!/usr/bin/env node
/* Génère creator-wiki.css : les règles du wiki (compendium + bestiaire) utiles à l'aperçu du Creator,
   préfixées par `.wiki` pour ne pas toucher au reste du Creator.
   Usage : node tools/build-creator-wiki-css.js   (à relancer si le CSS du compendium / bestiaire change) */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const SOURCES = [
  { file: 'Compendium/compendium.css', prefixes: ['.item-', '.imb-', '.stat-r', '.stat-req', '.craft-', '.effect', '.scroll-skill', '.miss-', '.evo-', '.set-'] },
  { file: 'Bestiaire/bestiaire.css',   prefixes: ['.mob-', '.mh-', '.loot-', '.attack', '.pnj-', '.sell-'] },
];

// Découpe grossière en règles de premier niveau (on ignore @media / @keyframes / @font-face…)
function topLevelRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const sel = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (!sel.startsWith('@')) out.push({ sel, body: body.trim() });
    i = j;
  }
  return out;
}

let result = '/* Généré par tools/build-creator-wiki-css.js — ne pas éditer à la main */\n';
for (const { file, prefixes } of SOURCES) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  result += `\n/* ── ${file} ── */\n`;
  for (const { sel, body } of topLevelRules(css)) {
    const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
    const keep = parts.filter(p => prefixes.some(pre => p.startsWith(pre)));
    if (!keep.length) continue;
    const clean = body.replace(/animation[^;]*;?/g, '');
    result += keep.map(p => '.wiki ' + p).join(',\n') + ' { ' + clean.replace(/\s+/g, ' ') + ' }\n';
  }
}
fs.writeFileSync(path.join(root, 'creator-wiki.css'), result);
console.log('creator-wiki.css :', result.split('\n').length, 'lignes');
