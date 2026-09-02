#!/usr/bin/env python3
"""
Generate neutral 16:9 placeholder tiles and a sample data/works.json.

  - assets/placeholders/tile-01..06.svg  — identical neutral 16:9 frames
  - data/works.json                      — TOTAL sample works

The first work is the real "Культура Дома" photo; every 5th work is a
video placeholder. Re-running this OVERWRITES data/works.json, so the
"Культура Дома" entry is re-applied here explicitly to survive a rebuild.
Add your own works by editing data/works.json directly.
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAMES      = ["Культура Дома", "ТатпромХолдинг", "Smart Open"]
CATEGORIES = ["Branding", "Website", "Motion", "Photography",
              "Illustration", "Poster", "Editorial", "Identity"]
YEARS      = ["2024", "2023", "2022", "2021"]
TOTAL      = 65
NUM_TILES  = 6
TILE_BG    = "#ffffff"
TILE_FG    = "#cbcac4"

def tile_svg():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">'
        f'<rect width="1600" height="900" fill="{TILE_BG}"/>'
        f'<text x="800" y="470" font-family="Arial, sans-serif" font-size="42" '
        f'letter-spacing="2" fill="{TILE_FG}" text-anchor="middle">16 : 9</text>'
        '</svg>'
    )

def main():
    ph_dir = os.path.join(ROOT, "assets", "placeholders")
    os.makedirs(ph_dir, exist_ok=True)
    for i in range(1, NUM_TILES + 1):
        with open(os.path.join(ph_dir, f"tile-{i:02d}.svg"), "w", encoding="utf-8") as f:
            f.write(tile_svg())

    works = []
    for i in range(TOTAL):
        is_video = (i % 5 == 4)
        item = {
            "type": "video" if is_video else "photo",
            "title": NAMES[i % len(NAMES)],
            "category": CATEGORIES[i % len(CATEGORIES)],
            "year": YEARS[i % len(YEARS)],
            "preview": f"assets/placeholders/tile-{(i % NUM_TILES) + 1:02d}.svg",
            "link": f"https://example.com/work-{i + 1:02d}",
        }
        if is_video:
            item["video"] = ""
        works.append(item)

    # Real first work — a photo tile with an actual preview image.
    works[0] = {
        "type": "photo",
        "title": "Культура Дома",
        "category": "Branding",
        "year": "2024",
        "preview": "assets/works/kultura-doma.jpg",
        "link": "https://example.com/kultura-doma",
    }

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "works.json"), "w", encoding="utf-8") as f:
        json.dump(works, f, ensure_ascii=False, indent=2)
    print(f"Wrote {NUM_TILES} tiles and {TOTAL} works.")

if __name__ == "__main__":
    main()
