"""
╔══════════════════════════════════════════════════════════════╗
║         JourneyMap Tile Assembler — Carte PNG Géante         ║
║         Version : JourneyMap 1.20+  |  Vue : Day            ║
║         Mode multi-dossiers supporté                        ║
╚══════════════════════════════════════════════════════════════╝

PRÉREQUIS
---------
  pip install Pillow tqdm

UTILISATION — MODE DOSSIER PARENT (recommandé)
-----------------------------------------------
  Renseigne PARENT_DIR avec le chemin du dossier overworld/
  Le script parcourt automatiquement tous les sous-dossiers
  et génère un PNG par sous-dossier (ex: -2.png, 0.png, 3.png…)

UTILISATION — MODE DOSSIERS INDIVIDUELS
-----------------------------------------
  Renseigne TILES_DIRS avec une liste de chemins explicites.
  Laisse PARENT_DIR vide si tu utilises ce mode.

UTILISATION — MODE CHEMIN UNIQUE (compatibilité)
-------------------------------------------------
  Renseigne uniquement TILES_DIR (comportement original).
"""

import os
import re
import sys
from pathlib import Path

# ─────────────────────────────────────────────────────────────
# ① CONFIGURATION
# ─────────────────────────────────────────────────────────────

# ── Option A : dossier parent contenant plusieurs sous-dossiers ──
# Le script génère un PNG par sous-dossier trouvé.
# Ex : r"C:\...\overworld"  →  traitera -2/, 0/, 3/, etc.
PARENT_DIR = r""

# ── Option B : liste de dossiers explicites ──
# Laisse vide [] si tu utilises PARENT_DIR ou TILES_DIR.
TILES_DIRS = []

# ── Option C : dossier unique (compatibilité avec l'ancien script) ──
# Laisse vide "" si tu utilises PARENT_DIR ou TILES_DIRS.
TILES_DIR = ""

# Dossier de sortie pour les PNG générés (vide = même dossier que le script)
OUTPUT_DIR = ""

# Zoom utilisé (0 = qualité maximale, 1 pixel par bloc)
ZOOM_LEVEL = 0

# Limite mémoire de sécurité en Go
MAX_RAM_GB = 4

# ─────────────────────────────────────────────────────────────
# ② DÉTECTION AUTOMATIQUE DU DOSSIER (mode solo)
# ─────────────────────────────────────────────────────────────

def detect_tiles_dir() -> Path:
    appdata = Path(os.environ.get("APPDATA", ""))
    base = appdata / ".minecraft" / "journeymap" / "data" / "mp"
    if not base.exists():
        return None
    servers = [p for p in base.iterdir() if p.is_dir()]
    if not servers:
        return None
    candidates = []
    for server in servers:
        zoom_dir = server / "tiles" / "day" / str(ZOOM_LEVEL)
        if zoom_dir.exists():
            tile_count = len(list(zoom_dir.glob("*.png")))
            candidates.append((tile_count, zoom_dir, server.name))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    best_count, best_path, best_server = candidates[0]
    print(f"[✓] Serveur détecté : {best_server}  ({best_count} tuiles)")
    return best_path


# ─────────────────────────────────────────────────────────────
# ③ PARSING DES COORDONNÉES
# ─────────────────────────────────────────────────────────────

def parse_tile_coords(path: Path):
    name = path.stem
    m = re.fullmatch(r"(-?\d+),(-?\d+)", name)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.fullmatch(r"(-?\d+)_(-?\d+)", name)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.fullmatch(r"\[(-?\d+),(-?\d+)\]", name)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None


# ─────────────────────────────────────────────────────────────
# ④ ASSEMBLAGE D'UN SEUL DOSSIER
# ─────────────────────────────────────────────────────────────

def assemble(tiles_dir: Path, output_file: Path):
    from PIL import Image
    try:
        from tqdm import tqdm
        use_tqdm = True
    except ImportError:
        use_tqdm = False
        print("[!] tqdm absent — pas de barre de progression")

    print(f"\n[→] Dossier source : {tiles_dir}")

    tile_files = list(tiles_dir.glob("*.png"))
    if not tile_files:
        print("[✗] Aucun fichier .png trouvé — dossier ignoré.")
        return False

    coords_map = {}
    skipped = 0
    for f in tile_files:
        c = parse_tile_coords(f)
        if c is None:
            skipped += 1
        else:
            coords_map[c] = f

    print(f"[✓] {len(coords_map)} tuiles valides  (ignorées : {skipped})")

    if not coords_map:
        print("[✗] Aucune tuile avec des coordonnées lisibles — dossier ignoré.")
        return False

    sample_img = Image.open(next(iter(coords_map.values())))
    TILE_W, TILE_H = sample_img.size
    sample_img.close()
    print(f"[✓] Taille d'une tuile : {TILE_W}×{TILE_H} px")

    xs = [c[0] for c in coords_map]
    zs = [c[1] for c in coords_map]
    x_min, x_max = min(xs), max(xs)
    z_min, z_max = min(zs), max(zs)

    grid_w = x_max - x_min + 1
    grid_h = z_max - z_min + 1
    img_w  = grid_w * TILE_W
    img_h  = grid_h * TILE_H

    print(f"[✓] Grille : {grid_w}×{grid_h} tuiles  →  image {img_w}×{img_h} px")

    ram_needed_gb = (img_w * img_h * 3) / (1024**3)
    print(f"[→] RAM estimée : ~{ram_needed_gb:.2f} Go")
    if ram_needed_gb > MAX_RAM_GB:
        print(f"[⚠] Dépasse la limite RAM ({MAX_RAM_GB} Go). Dossier ignoré.")
        print("    Augmente MAX_RAM_GB si tu veux forcer la génération.")
        return False

    print("[→] Création de l'image…")
    canvas = Image.new("RGB", (img_w, img_h), color=(0, 0, 0))

    iterator = coords_map.items()
    if use_tqdm:
        iterator = tqdm(iterator, total=len(coords_map), unit="tuile",
                        desc=f"  {tiles_dir.name}", ncols=70)

    errors = 0
    for (tx, tz), fpath in iterator:
        px = (tx - x_min) * TILE_W
        py = (tz - z_min) * TILE_H
        try:
            tile = Image.open(fpath).convert("RGB")
            canvas.paste(tile, (px, py))
            tile.close()
        except Exception as e:
            errors += 1
            if not use_tqdm:
                print(f"  [!] Erreur sur {fpath.name} : {e}")

    if errors:
        print(f"[!] {errors} tuile(s) non lisibles.")

    print(f"[→] Sauvegarde → {output_file}")
    canvas.save(output_file, "PNG", optimize=False)
    size_mb = output_file.stat().st_size / (1024**2)
    print(f"[✓] Terminé !  {img_w}×{img_h} px  |  {size_mb:.1f} Mo  →  {output_file.name}")
    return True


# ─────────────────────────────────────────────────────────────
# ⑤ RÉSOLUTION DE LA LISTE DE DOSSIERS À TRAITER
# ─────────────────────────────────────────────────────────────

def resolve_dirs() -> list[tuple[Path, str]]:
    """
    Retourne une liste de (chemin_du_dossier, nom_de_sortie_sans_extension).
    """
    entries = []  # (Path, label)

    # — Mode A : dossier parent —
    if PARENT_DIR:
        parent = Path(PARENT_DIR)
        if not parent.exists():
            print(f"[✗] PARENT_DIR introuvable : {parent}")
            sys.exit(1)
        subdirs = sorted([p for p in parent.iterdir() if p.is_dir()])
        if not subdirs:
            print(f"[✗] Aucun sous-dossier dans {parent}")
            sys.exit(1)
        print(f"[✓] {len(subdirs)} sous-dossier(s) détecté(s) dans {parent.name}/")
        for sub in subdirs:
            entries.append((sub, sub.name))
        return entries

    # — Mode B : liste explicite —
    if TILES_DIRS:
        for raw in TILES_DIRS:
            p = Path(raw)
            if not p.exists():
                print(f"[⚠] Chemin introuvable (ignoré) : {p}")
                continue
            entries.append((p, p.name))
        if not entries:
            print("[✗] Aucun chemin valide dans TILES_DIRS.")
            sys.exit(1)
        return entries

    # — Mode C : dossier unique —
    if TILES_DIR:
        p = Path(TILES_DIR)
        if not p.exists():
            print(f"[✗] TILES_DIR introuvable : {p}")
            sys.exit(1)
        entries.append((p, p.name))
        return entries

    # — Détection automatique —
    print("[→] Détection automatique du dossier JourneyMap…")
    p = detect_tiles_dir()
    if p is None:
        print("[✗] Impossible de détecter automatiquement le dossier.")
        print("    Renseigne PARENT_DIR, TILES_DIRS ou TILES_DIR dans le script.")
        sys.exit(1)
    entries.append((p, p.name))
    return entries


# ─────────────────────────────────────────────────────────────
# ⑥ POINT D'ENTRÉE
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        from PIL import Image
    except ImportError:
        print("[✗] Pillow n'est pas installé. Lance :  pip install Pillow tqdm")
        sys.exit(1)

    print("=" * 62)
    print("  JourneyMap Tile Assembler  |  JM 1.20+  |  Multi-dossiers")
    print("=" * 62)

    out_dir = Path(OUTPUT_DIR).resolve() if OUTPUT_DIR else Path(__file__).parent.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    dirs = resolve_dirs()

    print(f"\n[→] {len(dirs)} dossier(s) à traiter — sortie dans : {out_dir}\n")
    print("─" * 62)

    success, failed = 0, 0
    for tiles_path, label in dirs:
        print(f"\n{'─'*62}")
        print(f"  ▶  {label}")
        print(f"{'─'*62}")
        output_file = out_dir / f"{label}.png"
        ok = assemble(tiles_path, output_file)
        if ok:
            success += 1
        else:
            failed += 1

    print(f"\n{'='*62}")
    print(f"  Résumé : {success} PNG générés, {failed} dossier(s) ignorés")
    print(f"  Dossier de sortie : {out_dir}")
    print(f"{'='*62}")