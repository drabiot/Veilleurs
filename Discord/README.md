# Onboarding des serveurs Discord tiers

Page publique `Discord/discord.html` : un chef de serveur configure lui-même le bot du wiki.

## Architecture
- **Connexion** : `POST /discord/start {mode:'guilds'}` → OAuth2 `identify guilds` (même `/discord/callback` que la connexion du site, aucune URL à déclarer en plus). Le callback garde les serveurs où la personne a *Gérer le serveur* / *Administrateur* / est propriétaire, les met dans KV `WIKI_CACHE` (`gs:<session>`, 2 h) et redirige vers la page avec `#vcl-guild=<session>`. Le jeton OAuth Discord n'est pas conservé.
- **Réglages** : document D1 `discord_guilds/<guildId>` (table `docs`). Écrits uniquement par le worker (`guild-onboarding.js`) après avoir revérifié que la session gère ce serveur ; jamais d'`ADMIN_SECRET` côté navigateur. `COL_DEFAULTS` : lecture/écriture `admin` (la modération les lit/valide via `/db/*`).
- **Statut** : `status` = `pending` → `approved` | `refused` | `suspended` (modération) ; `removing` (désinstallation demandée) ; `paused` = pause du chef de serveur. Envoi seulement si `approved` et non en pause.
- **Création des salons** : par le worker, par paquets de 12 (limite de sous-requêtes d'un Worker), la page boucle. Accès : lecture seule pour tous / certains rôles / admins ; le bot garde ses droits via un overwrite (id = `DISCORD_CLIENT_ID`).
- **Envoi** : GitHub Actions (`.github/workflows/discord-bot.yml`, toutes les 10 min, sans PC allumé) lance `bot/discord-watch.js --once` : serveur principal puis serveurs inscrits (`bot/discord-guilds.js`). Secrets GitHub à créer : `BOT_TOKEN`, `ADMIN_SECRET`. Lit tous les serveurs via `POST /guild/bot`, dessine les cartes côté Node (masquage des forgerons secrets), poste / remplace (suppression de l'ancien post puis repost), poste sans notification (flag `SUPPRESS_NOTIFICATIONS`), respecte les limites de débit (400 posts / serveur / passage, 0,3 s entre deux posts, 6 salons en parallèle, 429 gérés par discord.js, arrêt propre après 12 min). **État** (posts faits, items vus) : D1, `docs` col `bot_state` (clés `main` et `guild_<id>`), non lisible via `/db/*`.
- **Désinstallation** : le worker passe le statut à `removing` ; le bot supprime ce qui est demandé (salons créés, posts), quitte le serveur et efface la fiche.
- **Modération** : onglet 📣 Discord → « Serveurs inscrits » : valider / refuser / suspendre / retirer.

## Limites
- Au-delà de **100 serveurs**, Discord exige la vérification du bot (et l'intent éventuel). Prévoir la demande avant.
- Le worker n'est pas déployé par la CI : `npx wrangler deploy` à lancer à la main depuis `repo/`.
- Les forums demandent le mode Communauté sur le serveur (la page propose les salons texte sinon).

## Sécurité (garde-fous)
- **Qui peut piloter le bot sur un serveur** : propriétaire, Administrateur, ou « Gérer le serveur » **et** « Gérer les salons » (sinon le bot, qui a « Gérer les salons », ferait pour lui ce qu'il ne peut pas faire lui-même). Chaque action revérifie que la session gère bien le serveur visé ; le navigateur n'a jamais ADMIN_SECRET.
- **Ce que le bot peut supprimer** : uniquement des salons / catégories **qu'il a créés** (drapeau `created` / `createdCategories`, posés par le worker et jamais par le navigateur), les posts qu'il a lui-même envoyés (suivis dans son état), et lui-même (il quitte le serveur). Un salon existant peut seulement être retiré du plan. Une catégorie existante n'est jamais renommée sur Discord. Les identifiants sont validés (numériques) avant tout appel de suppression.
- **Jamais de ping** : tous les messages du bot envoient `allowed_mentions: { parse: [] }` (un nom d'item « @everyone » ne notifie personne).
- **Limite de débit** : création, suppression, renvoi, vidage… limités par serveur et par heure (KV) pour ne pas saturer l'API Discord partagée par tous les serveurs.
- **Admin** : `ADMIN_SECRET` protège `/guild/bot` (état du bot, sessions « 🛠 Gérer ») ; les collections `discord_guilds`, `bot_state`, `discord_posts` ne sont pas lisibles / inscriptibles via `/db/*` par le public.
