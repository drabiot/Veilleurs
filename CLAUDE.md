# Conventions du dépôt

## Nouvelle page HTML
Toute nouvelle page (publique, outil, page admin…) doit charger l'outil de recharge de cache dans son `<head>` :

```html
<script src="../sw-register.js" defer></script>   <!-- chemin relatif à la racine : "sw-register.js" à la racine, "../sw-register.js" dans un dossier -->
```

`sw-register.js` compare `version.json` à la dernière version vue : si le site a été mis à jour, il vide les caches et recharge la page (ou affiche le bandeau « Nouvelle version du site disponible » sur un onglet déjà ouvert). Sans lui, les visiteurs gardent une page périmée.

Pages concernées à ce jour : toutes, sauf `capture-sprites.html`, `card-generator.html` et `tools/render-models.html` (outils internes).

## Textes
Le site est écrit en français ; l'anglais passe par `i18n.js` + `i18n/en.json` (voir l'en-tête de `i18n.js`). Une nouvelle page publique charge `i18n.js` (via `auth-widget.js` ou directement) et ses textes se traduisent avec `node tools/i18n-check.js --coverage`.

## Traductions : propositions → modération
- `i18n/review.html` et `i18n/compare.html` : le bouton « 📨 Send to the admins » écrit des documents dans `translation_proposals` (`i18n/send.js`). Droits dans `worker-store.js` (rôle « traducteur » ou permission `tool_translate` pour créer, admin pour lire tout / valider). **Le worker n'est pas déployé par la CI : `npx wrangler deploy` après toute modif de `worker-store.js`.**
- Onglet **🌐 Traduction** de la modération (`moderation-translations.js`) : FR / version actuelle / proposition, valider ou refuser. Valider écrit dans `config/i18n_en` ; `i18n.js` charge ce document avant `i18n/en.json`, donc c'est visible tout de suite.
- Pour reporter les validations dans le dépôt : « ⬇ Reporter dans en.json » (onglet), `node tools/i18n-apply.js fichier.json`, `node tools/i18n-check.js`, commit, puis « 🧹 Nettoyer la base ».

## Rôles personnalisés et droits spéciaux (« Gestionnaire »)
- Un rôle perso (`config/customRoles`) a un `baseTier` (palier) et, en option, une liste `caps` : `moderation` (approuver/rejeter les soumissions), `wiki` (panoplies, évènements, réglages de contenu), `trash` (Corbeille, sans suppression définitive), `tickets`. Cases à cocher dans modération → 🔑 Permissions → ✏️ Éditer (rôles perso seulement ; palier contributeur minimum, sinon ignorés).
- **Le serveur fait foi** : `worker-store.js` (`CAPS`, `WIKI_CONFIG_DOCS`, `WIKI_CAP_COLS`) → déployer avec `npx wrangler deploy`. Côté interface : `moderation.js` ramène un rôle perso à son palier de base (`ctx.role`) et expose `ctx.hasCap()` ; les boutons `data-min-role="admin"` restent visibles avec `data-cap="…"`.
- **Jamais attribuable** : Membres/rôles/permissions (+ `config/customRoles|permissions|discordRoles`), `secrets` (jeton GitHub = écriture dans le dépôt, secret du worker = actions Discord destructrices), Discord (bot, routes, webhooks), statistiques, journal d'audit (lecture/suppression), classement, traductions (`config/i18n_en`), suppression de l'historique des soumissions. Pour ajouter une clé `config/*` éditable par le droit `wiki`, l'ajouter à `WIKI_CONFIG_DOCS`.
- Assigner le rôle : Membres → liste déroulante (le compte est alors `roleLocked`, sinon la synchro Discord le remplacerait) ; ou associer un rôle Discord dans « Rôles Discord ». Création du rôle d'origine : `Save/d1-role-gestionnaire.sql`.
