import os
import re
import sys
from pathlib import Path
from typing import List, Tuple
import io

# Fix encodage console (Python 3.7 Windows)
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
except Exception:
    pass

# ─────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────

PARENT_DIR = "/home/tchartie/Downloads/hnttkw7"
TILES_DIRS = []
TILES_DIR = ""
OUTPUT_DIR = ""
ZOOM_LEVEL = 0
MAX_RAM_GB = 4


# ─────────────────────────────────────────────────────────────
# DETECTION AUTO
# ─────────────────────────────────────────────────────────────

def detect_tiles_dir():
    appdata = Path(os.environ.get("APPDATA", ""))
    base = appdata / ".minecraft" / "journeymap" / "data" / "mp"
    if not base.exists():
        return None

    servers = [p for p in base.iterdir() if p.is_dir()]
    candidates = []

    for server in servers:
        zoom_dir = server / "tiles" / "day" / str(ZOOM_LEVEL)
        if zoom_dir.exists():
            count = len(list(zoom_dir.glob("*.png")))
            candidates.append((count, zoom_dir, server.name))

    if not candidates:
        return None

    candidates.sort(reverse=True)
    best = candidates[0]
    print("[OK] Serveur detecte :", best[2], "(", best[0], "tuiles )")
    return best[1]


# ─────────────────────────────────────────────────────────────
# PARSE COORDS
# ─────────────────────────────────────────────────────────────

def parse_tile_coords(path):
    name = path.stem

    patterns = [
        r"(-?\d+),(-?\d+)",
        r"(-?\d+)_(-?\d+)",
        r"\[(-?\d+),(-?\d+)\]"
    ]

    for p in patterns:
        m = re.fullmatch(p, name)
        if m:
            return int(m.group(1)), int(m.group(2))

    return None


# ─────────────────────────────────────────────────────────────
# ASSEMBLE
# ─────────────────────────────────────────────────────────────

def assemble(tiles_dir, output_file):
    from PIL import Image

    try:
        from tqdm import tqdm
        use_tqdm = True
    except:
        use_tqdm = False
        print("[WARN] tqdm absent")

    print("\n[->] Dossier :", tiles_dir)

    tile_files = list(tiles_dir.glob("*.png"))
    if not tile_files:
        print("[ERR] Aucun PNG")
        return False

    coords_map = {}
    skipped = 0

    for f in tile_files:
        c = parse_tile_coords(f)
        if c is None:
            skipped += 1
        else:
            coords_map[c] = f

    print("[OK]", len(coords_map), "tuiles (ignorees :", skipped, ")")

    if not coords_map:
        return False

    img = Image.open(next(iter(coords_map.values())))
    TILE_W, TILE_H = img.size
    img.close()

    xs = [c[0] for c in coords_map]
    zs = [c[1] for c in coords_map]

    x_min, x_max = min(xs), max(xs)
    z_min, z_max = min(zs), max(zs)

    grid_w = x_max - x_min + 1
    grid_h = z_max - z_min + 1

    img_w = grid_w * TILE_W
    img_h = grid_h * TILE_H

    print("[OK] Image :", img_w, "x", img_h)

    ram_needed = (img_w * img_h * 3) / (1024 ** 3)
    print("[->] RAM ~ %.2f Go" % ram_needed)

    if ram_needed > MAX_RAM_GB:
        print("[WARN] Trop de RAM, ignore")
        return False

    canvas = Image.new("RGB", (img_w, img_h))

    iterator = coords_map.items()
    if use_tqdm:
        iterator = tqdm(iterator, total=len(coords_map))

    errors = 0

    for (tx, tz), fpath in iterator:
        px = (tx - x_min) * TILE_W
        py = (tz - z_min) * TILE_H

        try:
            tile = Image.open(fpath).convert("RGB")
            canvas.paste(tile, (px, py))
            tile.close()
        except:
            errors += 1

    if errors:
        print("[WARN]", errors, "erreurs")

    print("[->] Sauvegarde :", output_file)
    canvas.save(output_file, "PNG")

    return True


# ─────────────────────────────────────────────────────────────
# RESOLVE DIRS
# ─────────────────────────────────────────────────────────────

def resolve_dirs() -> List[Tuple[Path, str]]:
    entries = []

    if PARENT_DIR:
        parent = Path(PARENT_DIR)

        if not parent.exists():
            print("[ERR] PARENT_DIR introuvable")
            sys.exit(1)

        subdirs = [p for p in parent.iterdir() if p.is_dir()]

        print("[OK]", len(subdirs), "sous-dossiers detectes")

        for sub in subdirs:
            entries.append((sub, sub.name))

        return entries

    if TILES_DIRS:
        for raw in TILES_DIRS:
            p = Path(raw)
            if p.exists():
                entries.append((p, p.name))

        return entries

    if TILES_DIR:
        p = Path(TILES_DIR)
        if p.exists():
            entries.append((p, p.name))
        return entries

    print("[->] Detection auto")
    p = detect_tiles_dir()

    if p:
        entries.append((p, p.name))
        return entries

    print("[ERR] Aucun dossier trouve")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        from PIL import Image
    except:
        print("[ERR] Installe Pillow : pip install Pillow tqdm")
        sys.exit(1)

    print("=" * 50)
    print("JourneyMap Assembler (Python 3.7 compatible)")
    print("=" * 50)

    out_dir = Path(OUTPUT_DIR) if OUTPUT_DIR else Path(__file__).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    dirs = resolve_dirs()

    success = 0
    failed = 0

    for tiles_path, label in dirs:
        print("\n---", label, "---")

        output_file = out_dir / (label + ".png")

        if assemble(tiles_path, output_file):
            success += 1
        else:
            failed += 1

    print("\nRESULTAT :", success, "OK /", failed, "fails")