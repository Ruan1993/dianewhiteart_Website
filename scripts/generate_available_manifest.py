from __future__ import annotations

import json
import re
from pathlib import Path
from hashlib import md5

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
AVAILABLE_DIR = ROOT / 'images' / 'available'
OUTPUT = ROOT / 'data' / 'available-works.json'
JS_OUTPUT = ROOT / 'data' / 'available-works.js'

IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
TITLE_STOP_WORDS = (
    ' acrylic', ' inks', ' ink', ' watercolour', ' watercolours', ' on ', ' price ', ' r', ' can be done'
)


def extract_inventory_prefix(text: str) -> tuple[str, str, str]:
    original = normalize_text(text)
    # Special fix for Screenshot 2: Various Blocks 200 x 200mm
    # Move the size into brackets if it's right after "Various Blocks"
    original = re.sub(r'(Various Blocks)\s*(\d{3,4}\s*x\s*\d{3,4}mm)', r'\1 (\2)', original, flags=re.IGNORECASE)
    
    patterns = (
        re.compile(r'^(No)\s*([0-9]+)\s*(.*)$', re.IGNORECASE),
        re.compile(r'^([A-Za-z])\s*([0-9]+)\s*(.*)$', re.IGNORECASE),
    )
    for pattern in patterns:
        match = pattern.match(original)
        if match:
            prefix, number, remainder = match.groups()
            compact = f'{prefix.upper()}{number}' if prefix.lower() != 'no' else f'No {number}'
            return compact, number, remainder
    return '', '', original


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-')


def humanize_folder(name: str) -> str:
    mapping = {
        'acrylics & oil paintings': 'Acrylics & Oil Paintings',
        'flow art': 'Flow Art',
        'watercolours': 'Watercolours',
        'landscape': 'Landscapes',
        'florals': 'Florals',
        'animals': 'Animals',
    }
    return mapping.get(name.lower(), name.replace('-', ' ').replace('_', ' ').title())


def normalize_text(text: str) -> str:
    text = Path(text).stem.replace('_', ' ')
    text = text.replace('·', ' ')
    
    # User requested spelling and formatting fixes
    text = text.replace('Lmpact', 'Impact').replace('Fow Art', 'Flow Art')
    text = text.replace('predect', 'predict')
    text = text.replace("Colour's", "Colours")
    text = text.replace('lris', 'Iris').replace('Irris', 'Iris').replace('Lris', 'Iris')
    
    # Fix "Various Blocks 200 x 200" to "Various Blocks (200mm x 200mm)"
    text = re.sub(r'Various Blocks\s*(\d{3})\s*[xX]\s*(\d{3})(mm)?', r'Various Blocks (\1mm x \2mm)', text, flags=re.IGNORECASE)
    
    text = re.sub(r'\s+', ' ', text).strip(' .-_')
    return text


def extract_size(text: str) -> str:
    normalized = text.replace('l000', '1000').replace('x750', 'x 750')
    # If size is already in the title (like Various Blocks), don't duplicate it in size field if preferred
    match = re.search(r'(\d{3,4})\s*mm\s*x\s*(\d{3,4})\s*mm', normalized, re.IGNORECASE)
    if not match:
        return ''
    return f"{match.group(1)}mm × {match.group(2)}mm"


def extract_price(text: str) -> str:
    match = re.search(r'\bR\s?(\d[\d\s,.]*)\b', text, re.IGNORECASE)
    if not match:
        return ''
    amount = re.sub(r'[^\d]', '', match.group(1))
    return f'R{amount}' if amount else ''


def extract_medium_details(text: str, medium_label: str) -> str:
    medium_root = medium_label.rstrip('s')
    # Special cases for new names
    if 'Acrylics & Oil Paintings' in medium_label:
        medium_root = 'Acrylic' # Default root for these
    elif 'Flow Art' in medium_label:
        medium_root = 'Flow Art'

    normalized = text.replace('l000', '1000').replace('x750', 'x 750')
    pattern = re.compile(rf'({medium_root}\b.*)', re.IGNORECASE)
    match = pattern.search(normalized)
    if not match:
        return medium_root
    details = match.group(1)
    details = re.sub(r'\bprice\b.*$', '', details, flags=re.IGNORECASE).strip(' ,.-')
    details = re.sub(r'\bR\s?\d[\d\s,.]*\b', '', details, flags=re.IGNORECASE).strip(' ,.-')
    details = re.sub(r'(\d{3,4}\s*mm\s*x\s*\d{3,4}\s*mm)', '', details, flags=re.IGNORECASE).strip(' ,.-')
    details = re.sub(r'\s+', ' ', details)
    return details[:1].upper() + details[1:] if details else medium_root


def extract_title(text: str) -> tuple[str, str, str]:
    original = normalize_text(text)
    prefix_label, number, remainder = extract_inventory_prefix(original)

    lower = remainder.lower()
    cut_positions = []
    size_match = re.search(r'\d{3,4}\s*mm\s*x\s*\d{3,4}\s*mm', lower)
    if size_match:
        cut_positions.append(size_match.start())
    for marker in TITLE_STOP_WORDS:
        pos = lower.find(marker)
        if pos > 0:
            cut_positions.append(pos)
    if cut_positions:
        remainder = remainder[: min(cut_positions)]

    remainder = re.sub(r'\bprice\b.*$', '', remainder, flags=re.IGNORECASE)
    remainder = re.sub(r'\bR\s?\d[\d\s,.]*\b', '', remainder, flags=re.IGNORECASE)
    remainder = re.sub(r'\s+', ' ', remainder).strip(' ,.-')
    title = remainder.title() if remainder else original.title()
    display_title = f'{prefix_label} · {title}' if prefix_label else title
    return prefix_label, number, display_title


def get_image_dimensions(path: Path) -> tuple[int, int]:
    try:
        with Image.open(path) as image:
            return image.size
    except Exception:
        return 0, 0


def build_item(path: Path) -> dict[str, str | int]:
    rel = path.relative_to(ROOT).as_posix()
    medium_folder = path.parents[1].name
    subcategory_folder = path.parent.name
    
    # Handle files directly in a medium folder (like Flow Art/Small bowl...)
    if len(path.relative_to(AVAILABLE_DIR).parts) == 2:
        medium_folder = path.parent.name
        subcategory_folder = 'General'

    medium_label = humanize_folder(medium_folder)
    subcategory_label = humanize_folder(subcategory_folder)
    prefix_label, number, title = extract_title(path.name)
    raw_text = normalize_text(path.name)

    art_id = 'art-' + md5(rel.encode('utf-8')).hexdigest()[:10]
    image_width, image_height = get_image_dimensions(path)
    return {
        'id': art_id,
        'number': number,
        'inventoryLabel': prefix_label,
        'title': title,
        'image': rel,
        'full': rel,
        'imageWidth': image_width,
        'imageHeight': image_height,
        'medium': medium_label,
        'mediumDetails': extract_medium_details(raw_text, medium_label),
        'subcategory': subcategory_label,
        'size': extract_size(raw_text),
        'price': extract_price(raw_text),
        'status': 'Available',
        'mainFilter': {'Acrylics & Oil Paintings': 'acrylic', 'Flow Art': 'inks', 'Watercolours': 'watercolour'}.get(medium_label, slugify(medium_label.rstrip('s'))),
        'subFilter': {'Landscapes': 'landscapes', 'Florals': 'florals', 'Animals': 'animals'}.get(subcategory_label, slugify(subcategory_label)),
    }


def sort_key(path: Path) -> tuple[str, int, int, str]:
    prefix_label, number, _ = extract_title(path.name)
    prefix_root = re.sub(r'\d+$', '', prefix_label).lower() if prefix_label else 'zzz'
    number_value = int(number) if number.isdigit() else 10**9
    return prefix_root, number_value, len(path.relative_to(AVAILABLE_DIR).parts), path.relative_to(AVAILABLE_DIR).as_posix().lower()


def main() -> None:
    works = []
    available_main_filters = set()
    available_sub_filters = set()

    for medium_dir in AVAILABLE_DIR.iterdir():
        if not medium_dir.is_dir():
            continue
        medium_label = humanize_folder(medium_dir.name)
        main_key = {'Acrylics & Oil Paintings': 'acrylic', 'Flow Art': 'inks', 'Watercolours': 'watercolour'}.get(medium_label, slugify(medium_label.rstrip('s')) )
        available_main_filters.add(main_key)

        for sub_dir in medium_dir.iterdir():
            if not sub_dir.is_dir():
                continue
            sub_label = humanize_folder(sub_dir.name)
            sub_key = {'Landscapes': 'landscapes', 'Florals': 'florals', 'Animals': 'animals'}.get(sub_label, slugify(sub_label))
            available_sub_filters.add(sub_key)

    for path in AVAILABLE_DIR.rglob('*'):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTS:
            rel_parts = path.relative_to(AVAILABLE_DIR).parts
            if len(rel_parts) >= 2: # At least Medium/File or Medium/Sub/File
                works.append(build_item(path))
    
    works.sort(key=lambda p: sort_key(AVAILABLE_DIR / p['image']))

    filters = {
        'main': [
            {'key': 'all', 'label': 'All Works'},
            {'key': 'acrylic', 'label': 'Acrylics & Oil Paintings'},
            {'key': 'inks', 'label': 'Flow Art'},
            {'key': 'watercolour', 'label': 'Watercolours'},
        ],
        'sub': [
            {'key': 'landscapes', 'label': 'Landscapes'},
            {'key': 'florals', 'label': 'Florals'},
            {'key': 'animals', 'label': 'Animals'},
        ],
        'availableMainFilters': sorted(available_main_filters),
        'availableSubFilters': sorted(available_sub_filters),
    }

    payload = {
        'generatedFrom': AVAILABLE_DIR.relative_to(ROOT).as_posix(),
        'workCount': len(works),
        'works': works,
        'filters': filters,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, indent=2, ensure_ascii=False)
    OUTPUT.write_text(serialized, encoding='utf-8')
    JS_OUTPUT.write_text('window.DIANE_AVAILABLE_WORKS = ' + serialized + ';\n', encoding='utf-8')
    print(f'Wrote {OUTPUT.relative_to(ROOT)} and {JS_OUTPUT.relative_to(ROOT)} with {len(works)} works.')


if __name__ == '__main__':
    main()
