// Lance le linter de données (data-linter.html) sans navigateur : même code, mêmes règles.
// Les items sont lus en direct depuis le worker (comme le compendium), donc il faut un accès réseau.
// Usage : node tools/lint-data.js   → affiche le résumé, sort en erreur (1) s'il y a des erreurs bloquantes.
// Les avertissements (obtain/lore vides, img manquante…) sont listés mais ne bloquent pas.
// Erreurs déjà connues : tools/lint-baseline.json (nombre par règle). On ne bloque que si une règle empire ;
// `node tools/lint-data.js --update-baseline` fige l'état actuel (à faire après avoir corrigé des données).
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'data-linter.html'), 'utf8');

const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
if (!srcs.length || !inline) { console.error('Structure de data-linter.html inattendue'); process.exit(2); }

// Faux DOM minimal : le linter y écrit son rendu, on n'en a pas besoin
const el = () => new Proxy(function () {}, {
  get: (_, k) => (k === 'classList' ? { add() {}, toggle() {}, contains: () => false }
    : k === 'style' ? {} : k === Symbol.toPrimitive ? () => '' : el()),
  set: () => true,
  apply: () => el(),
});
const doc = new Proxy({ querySelectorAll: () => [] }, { get: (t, k) => (k in t ? t[k] : () => el()) });
const sandbox = { console, fetch, document: doc, addEventListener() {}, removeEventListener() {},
  localStorage: { getItem: () => null, setItem() {} }, navigator: { userAgent: 'node' }, location: { search: '', hash: '' } };
sandbox.window = sandbox;
vm.createContext(sandbox);

const strip = s => String(s).replace(/<[^>]+>/g, '');

const BASE = path.join(__dirname, 'lint-baseline.json');
function report(res) {
  let errors = 0, warns = 0;
  const counts = {};
  for (const [key, sec] of Object.entries(res.issues)) {
    if (sec.sev === 'error') counts[key] = sec.items.length;
    if (!sec.items.length) continue;
    const isErr = sec.sev === 'error';
    if (isErr) errors += sec.items.length; else warns += sec.items.length;
    console.log(`\n${isErr ? '❌' : '⚠️ '} ${sec.label} (${sec.items.length})`);
    for (const i of sec.items.slice(0, 15)) console.log(`   - ${i.id} : ${strip(i.msg)}`);
    if (sec.items.length > 15) console.log(`   … et ${sec.items.length - 15} autres`);
  }
  console.log(`\n${res.count} items analysés — ${errors} erreur(s), ${warns} avertissement(s)`);
  if (!res.count) { console.error('Aucun item chargé : analyse invalide'); process.exit(2); }
  if (process.argv.includes('--update-baseline')) { fs.writeFileSync(BASE, JSON.stringify(counts, null, 2)); console.log('Baseline mise à jour'); process.exit(0); }
  const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
  const worse = Object.entries(counts).filter(([k, n]) => n > (base[k] || 0));
  for (const [k, n] of worse) console.log(`🚫 « ${res.issues[k].label} » : ${n} (baseline ${base[k] || 0})`);
  if (!worse.length && errors) console.log('Erreurs connues (baseline) : pas de nouvelle régression.');
  process.exit(worse.length ? 1 : 0);
}

(async () => {
  let res;
  try {
    // Scripts de données : portée globale partagée, comme dans le navigateur
    for (const s of srcs) vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s });
    vm.runInContext(inline, sandbox, { filename: 'data-linter.html' });
    res = await sandbox.__lint;   // le linter charge les items depuis le worker puis renvoie { issues, count }
  } catch (e) {
    console.error('Le linter a planté :', e.message); process.exit(2);
  }
  report(res);
})();
