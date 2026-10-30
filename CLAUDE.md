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
