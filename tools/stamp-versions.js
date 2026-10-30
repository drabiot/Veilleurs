// Remplace chaque « fichier.js?v=… » / « fichier.css?v=… » (HTML et imports JS) par un hash du contenu du fichier visé :
// l'URL ne change que si le fichier change, donc plus de ?v= à incrémenter à la main ni de cache périmé.
// Usage : node tools/stamp-versions.js [--check]   (--check : n'écrit rien, sort en erreur s'il reste des versions périmées)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'data', 'img', 'testing']);
const check = process.argv.includes('--check');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
// fins de ligne normalisées : même hash sous Windows (CRLF) et sur le serveur (LF)
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(f, 'utf8').split('\r\n').join('\n')).digest('hex').slice(0, 8);
const RE = /((?:\.{0,2}\/)?[\w./-]+\.(?:js|css|mjs))\?v=([\w-]+)/g;

const files = walk(ROOT);
let stale = 0;
for (let pass = 0; pass < 6; pass++) {            // plusieurs passes : le hash d'un JS change quand ses propres références changent
  let changed = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const out = src.replace(RE, (m, ref, v) => {
      if (/^https?:|^\/\//.test(ref)) return m;
      const target = path.resolve(path.dirname(f), ref);
      if (!fs.existsSync(target)) return m;
      const h = hash(target);
      return h === v ? m : `${ref}?v=${h}`;
    });
    if (out !== src) { changed++; if (!check) fs.writeFileSync(f, out); }
  }
  stale = changed;
  if (!changed || check) break;
}
// version.json : identifiant de la version en ligne (hash de tous les HTML/JS), lu par sw-register.js pour renouveler le cache des visiteurs
if (!check && !stale) {
  const NL = String.fromCharCode(10);
  const id = crypto.createHash('sha1').update(files.map(f => path.relative(ROOT, f).split(path.sep).join('/') + ':' + hash(f)).sort().join(NL)).digest('hex').slice(0, 10);
  const vf = path.join(ROOT, 'version.json');
  let cur = ''; try { cur = JSON.parse(fs.readFileSync(vf, 'utf8')).v; } catch { /* absent */ }
  if (cur !== id) fs.writeFileSync(vf, JSON.stringify({ v: id }) + NL);
}
if (check && stale) { console.error('Versions ?v= périmées : lance node tools/stamp-versions.js'); process.exit(1); }
console.log(stale && !check ? 'Versions non stabilisées' : 'Versions à jour');
