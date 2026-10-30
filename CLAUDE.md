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
