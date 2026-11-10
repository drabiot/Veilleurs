/* Enregistre la commande /claude sur le serveur Discord (instantané). À relancer seulement si cette définition change.
   Lit BOT_TOKEN, CLIENT_ID, GUILD_ID dans l'environnement ou dans le fichier .env indiqué par ENV_FILE (défaut : ../../bot/.env, le dossier du bot). */
const fs = require('fs');
const path = require('path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', 'bot', '.env');
try { for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) { console.error('BOT_TOKEN, CLIENT_ID et GUILD_ID requis (voir ' + envFile + ')'); process.exit(1); }

const command = {
  name: 'claude',
  description: 'Claude lit ce fil et affine la demande (réservé à l\'équipe)',
  type: 1,
  contexts: [0], integration_types: [0],
  options: [{ type: 3, name: 'message', description: 'Précision ou question pour Claude (facultatif)', required: false, max_length: 1500 }],
};
fetch(`https://discord.com/api/v10/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands`, {
  method: 'POST', headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command),
}).then(async r => { console.log(r.status, r.ok ? 'OK : /claude enregistrée' : await r.text()); process.exit(r.ok ? 0 : 1); });
