"""Rifiniture CPU e tavola di controllo: non usa la GPU né avvia generazioni."""
import hashlib
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2]
base = root / 'resources/gui'
manifest_path = base / 'manifest.json'
m = json.loads(manifest_path.read_text(encoding='utf-8'))
items = [(key, e) for key, e in m['asset'].items() if e['gruppo'] in ('stili', 'ricette') or key in ('sfondi/nebulosa', 'sfondi/nebulosa-calda')]
cols, w, h = 6, 180, 200
sheet = Image.new('RGB', (cols*w, ((len(items)+cols-1)//cols)*h), '#10172e')
draw = ImageDraw.Draw(sheet)
for i, (key, entry) in enumerate(items):
    x, y = (i % cols)*w, (i // cols)*h
    with Image.open(base / entry['file']) as im:
        im = im.convert('RGBA')
        im.thumbnail((w-8, h-25))
        sheet.paste(im, (x+(w-im.width)//2, y+23), im)
    draw.text((x+4, y+4), key, fill='white')
out = Path(os.environ['TMPDIR']) / 'gui-v2/controllo-stili-ricette.webp'
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out, 'WEBP', quality=82)
print(json.dumps({'tavola': str(out), 'immagini': len(items)}, ensure_ascii=False))
