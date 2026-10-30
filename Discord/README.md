# Onboarding des serveurs Discord tiers

Page publique `Discord/discord.html` : un chef de serveur configure lui-même le bot du wiki.

## Architecture
- **Connexion** : `POST /discord/start {mode:'guilds'}` → OAuth2 `identify guilds` (même `/discord/callback` que la connexion du site, aucune URL à déclarer en plus). Le callback garde les serveurs où la personne a *Gérer le serveur* / *Administrateur* / est propriétaire, les met dans KV `WIKI_CACHE` (`gs:<session>`, 2 h) et redirige vers la page avec `#vcl-guild=<session>`. Le jeton OAuth Discord n'est pas conservé.
- **Réglages** : document D1 `discord_guilds/<guildId>` (table `docs`). Écrits uniquement par le worker (`guild-onboarding.js`) après avoir revérifié que la session gère ce serveur ; jamais d'`ADMIN_SECRET` côté navigateur. `COL_DEFAULTS` : lecture/écriture `admin` (la modération les lit/valide via `/db/*`).
- **Statut** : `status` = `pending` → `approved` | `refused` | `suspended` (modération) ; `removing` (désinstallation demandée) ; `paused` = pause du chef de serveur. Envoi seulement si `approved` et non en pause.
- **Création des salons** : par le worker, par paquets de 12 (limite de sous-requêtes d'un Worker), la page boucle. Accès : lecture seule pour tous / certains rôles / admins ; le bot garde ses droits via un overwrite (id = `DISCORD_CLIENT_ID`).
- **Envoi** : GitHub Actions (`.github/workflows/discord-bot.yml`, toutes les 10 min, sans PC allumé) lance `bot/discord-watch.js --once` : serveur principal puis serveurs inscrits (`bot/discord-guilds.js`). Secrets GitHub à créer : `BOT_TOKEN`, `ADMIN_SECRET`. Lit tous les serveurs via `POST /guild/bot`, dessine les cartes côté Node (masquage des forgerons secrets), poste / remplace (suppression de l'ancien post puis repost), masque le salon au-delà de `hideThreshold`, respecte les limites de débit (40 posts / serveur / passage, 1,5 s entre deux posts, 429 gérés par discord.js, arrêt propre après 12 min). **État** (posts faits, items vus, droits masqués) : D1, `docs` col `bot_state` (clés `main` et `guild_<id>`), non lisible via `/db/*`.
- **Désinstallation** : le worker passe le statut à `removing` ; le bot supprime ce qui est demandé (salons créés, posts), quitte le serveur et efface la fiche.
- **Modération** : onglet 📣 Discord → « Serveurs inscrits » : valider / refuser / suspendre / retirer.

## Limites
- Au-delà de **100 serveurs**, Discord exige la vérification du bot (et l'intent éventuel). Prévoir la demande avant.
- Le worker n'est pas déployé par la CI : `npx wrangler deploy` à lancer à la main depuis `repo/`.
- Les forums demandent le mode Communauté sur le serveur (la page propose les salons texte sinon).
