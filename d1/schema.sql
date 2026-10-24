-- Schéma D1 « veilleurs » — étape 1 : stats et tracking.
-- Appliquer : npx wrangler d1 execute veilleurs --remote --file=d1/schema.sql

-- Documents de tracking (page_views, user_visits, item_views, search_logs).
-- `data` est le JSON du document tel que Firestore le stockait : les clés pointées
-- (« sections.compendium », « items.arc_courbe_p1 »…) restent des clés plates.
CREATE TABLE IF NOT EXISTS track_docs (
  col        TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT    NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (col, id)
);

-- Journal des connexions Discord (admins exclus), affiché dans « Connexions récentes ».
CREATE TABLE IF NOT EXISTS login_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  uid    TEXT    NOT NULL,
  pseudo TEXT    NOT NULL DEFAULT '',
  ts     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_log_ts ON login_log (ts DESC);

-- ── Étape 2 : contenu public (copie de Firestore, alimentée par le worker) ──
-- updated_at = numéro de révision globale (meta.rev), pas une date : les clients demandent « tout ce qui a rev > N ».
CREATE TABLE IF NOT EXISTS docs (
  col        TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  gen        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (col, id)
);
CREATE INDEX IF NOT EXISTS idx_docs_col_rev ON docs (col, updated_at);

-- Compteurs et curseurs de synchro (rev, epoch, gen, cur:<col>, curname:<col>, full:<col>, tomb, tombname, lastrefresh)
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v);
INSERT OR IGNORE INTO meta (k, v) VALUES ('rev', 0), ('epoch', -1), ('gen', 1), ('lastrefresh', 0);
