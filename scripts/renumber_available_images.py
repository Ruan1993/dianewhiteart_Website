from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AVAILABLE_DIR = ROOT / 'images' / 'available'
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}


def split_prefix(name: str) -> tuple[int | None, str]:
    stem = Path(name).stem.strip()
    m = re.match(r'^(?:No\s*)?(\d+)\b[\s._-]*(.*)$', stem, re.IGNORECASE)
    if m:
        return int(m.group(1)), m.group(2).strip()
    return None, stem


def sort_key(path: Path):
    num, rest = split_prefix(path.name)
    return (
        1 if num is None else 0,
        num if num is not None else 10**9,
        path.parent.as_posix().lower(),
        rest.lower(),
        path.name.lower(),
    )


def build_new_name(path: Path, index: int) -> str:
    ext = path.suffix
    _, remainder = split_prefix(path.name)
    remainder = re.sub(r'^[A-Za-z]+\d+\b[\s._-]*', '', remainder)
    remainder = remainder or Path(path.name).stem
    remainder = re.sub(r'^[-_.\s]+', '', remainder)
    return f'No {index} {remainder}{ext}'


def main() -> None:
    files = [
        p for p in AVAILABLE_DIR.rglob('*')
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS and len(p.relative_to(AVAILABLE_DIR).parts) >= 3
    ]
    files.sort(key=sort_key)

    staged = [(path, path.with_name(build_new_name(path, i))) for i, path in enumerate(files, start=1)]

    temp_paths = []
    for idx, (src, dst) in enumerate(staged, start=1):
        temp = src.with_name(f'__renaming__{idx}{src.suffix}')
        src.rename(temp)
        temp_paths.append((temp, dst))

    for temp, dst in temp_paths:
        temp.rename(dst)
        print(f'{dst.relative_to(ROOT).as_posix()}')


if __name__ == '__main__':
    main()
