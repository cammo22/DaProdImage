from pathlib import Path
from collections import Counter
import hashlib, json, os, sys
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
assets_dir = root / 'resources' / 'gui'
manifest = json.loads((assets_dir / 'manifest.json').read_text(encoding='utf-8'))
entries = manifest['asset']
files = sorted(p for p in assets_dir.rglob('*.webp') if p.name != 'prova-tavola.webp')
errors = []
if len(entries) != 111:
    errors.append(f'manifest count {len(entries)} != 111')
if len(files) != len(entries):
    errors.append(f'webp count {len(files)} != manifest count {len(entries)}')
seen = set()
alpha_counts = Counter()
total_bytes = 0
max_file = (0, '')
for asset_id, e in entries.items():
    path = assets_dir / e['file']
    if not path.is_file():
        errors.append(f'missing {asset_id}: {path}')
        continue
    if path in seen:
        errors.append(f'duplicate manifest file: {e["file"]}')
    seen.add(path)
    raw = path.read_bytes()
    total_bytes += len(raw)
    if len(raw) > max_file[0]:
        max_file = (len(raw), e['file'])
    if e.get('byte') != len(raw):
        errors.append(f'byte mismatch {asset_id}: manifest={e.get("byte")} actual={len(raw)}')
    digest = hashlib.sha256(raw).hexdigest()[:16]
    if e.get('sha256_16') != digest:
        errors.append(f'hash mismatch {asset_id}: manifest={e.get("sha256_16")} actual={digest}')
    try:
        with Image.open(path) as im:
            im.load()
            if im.format != 'WEBP':
                errors.append(f'not WEBP: {asset_id} format={im.format}')
            if list(im.size) != e['misura']:
                errors.append(f'dimension mismatch {asset_id}: manifest={e["misura"]} actual={im.size}')
            alpha = e.get('alpha')
            alpha_counts[str(alpha or 'none')] += 1
            if alpha and 'A' not in im.getbands():
                errors.append(f'alpha requested but missing channel: {asset_id}')
            if alpha and im.getchannel('A').getextrema()[0] == 255:
                errors.append(f'alpha is fully opaque: {asset_id}')
            if e.get('da_rifare_con_birefnet') != (alpha == 'chiave'):
                errors.append(f'BiRefNet flag mismatch: {asset_id}')
    except Exception as ex:
        errors.append(f'decode failed {asset_id}: {ex}')

from genera_klein import PER_ID
expected = set(PER_ID)
if set(entries) != expected:
    errors.append(f'catalogo e manifest diversi: mancanti={sorted(expected-set(entries))}, extra={sorted(set(entries)-expected)}')
if set(files) != {assets_dir / e['file'] for e in entries.values()}:
    errors.append('file WebP non presenti nel manifest o mancanti')
if sum(e['byte'] for e in entries.values()) >= 6000000:
    errors.append('superato budget totale 6 MB')
for e in entries.values():
    if e['gruppo'] == 'sfondi' and e['byte'] > 350000:
        errors.append(f'sfondo sopra 350 kB: {e["file"]}')
readme = (assets_dir / 'README.md').read_text(encoding='utf-8')
if '| Modello (UNET) |' not in readme or '| BiRefNet |' not in readme:
    errors.append('README missing per-asset model or BiRefNet columns')
if readme.count(' | sì | ') != sum(1 for e in entries.values() if e.get('da_rifare_con_birefnet')):
    errors.append('README BiRefNet yes count differs from manifest')

# Tavola leggera del set di prova già approvato, per allegarla al task.
items = [
    ('Icona · Persone', 'tessera/persone.webp'),
    ('Icona · Estrai', 'tessera/estrai.webp'),
    ('Sfondo · Nebulosa', 'sfondi/nebulosa.webp'),
    ('Stile · Anime film', 'stili/anime-film.webp'),
    ('Stile · Vetro', 'stili/vetro.webp'),
    ('Ricetta · Foglio', 'ricette/foglio.webp'),
]
W, H = 900, 560
cell_w, cell_h, header_h = 300, 280, 26
sheet = Image.new('RGB', (W, H), '#10172e')
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default()
for i, (label, rel) in enumerate(items):
    x, y = (i % 3) * cell_w, (i // 3) * cell_h
    draw.rectangle((x, y, x + cell_w - 1, y + header_h - 1), fill='#1b2444')
    draw.text((x + 8, y + 7), label, fill='white', font=font)
    im = Image.open(assets_dir / rel).convert('RGBA')
    im.thumbnail((cell_w - 16, cell_h - header_h - 14), Image.Resampling.LANCZOS)
    # sfondi scuri per anteprima coerente con la GUI; alpha compositato sul navy.
    bg = Image.new('RGBA', im.size, '#10172e')
    bg.alpha_composite(im)
    dx = x + (cell_w - im.width) // 2
    dy = y + header_h + (cell_h - header_h - im.height) // 2
    sheet.paste(bg.convert('RGB'), (dx, dy))

scratch = Path(os.environ.get('TMPDIR') or os.environ.get('TEMP') or root)
out = scratch / 'gui-v2' / 'prova-tavola.webp'
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out, 'WEBP', quality=48, method=6)

print(json.dumps({
    'asset_count': len(entries), 'webp_count': len(files), 'total_bytes': total_bytes,
    'max_file': {'bytes': max_file[0], 'file': max_file[1]}, 'alpha_counts': dict(alpha_counts),
    'birefnet_revisit_count': sum(1 for e in entries.values() if e.get('da_rifare_con_birefnet')),
    'contact_sheet': str(out), 'contact_sheet_bytes': out.stat().st_size, 'errors': errors,
}, ensure_ascii=False, indent=2))
if errors:
    sys.exit(1)
