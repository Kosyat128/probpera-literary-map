import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(r"C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")

TARGET_FILES = []
TARGET_FILES += sorted((ROOT / "public/cms/articles").glob("cms-*.json"))
TARGET_FILES += [ROOT / "public/cms/published-articles.json", ROOT / "public/cms/published-content.json"]
TARGET_FILES += [
    ROOT / "src/data/articles/catalog.generated.ts",
    ROOT / "src/data/articles/cms.generated.ts",
]

MOJI_GLYPHS = re.compile(r"[À-ÿ]")


def has_suspected_mojibake(value: str) -> bool:
    if not value:
        return False

    total = len(value)
    if total == 0:
        return False

    suspicious = sum(1 for ch in value if "\u00c0" <= ch <= "\u00ff")
    cyrillic = sum(1 for ch in value if "\u0400" <= ch <= "\u04ff")
    latin = sum(1 for ch in value if "a" <= ch.lower() <= "z")

    return suspicious >= 3 and suspicious / total >= 0.05 and cyrillic <= latin


def can_fix_mojibake(value: str) -> str | None:
    if not any(ord(ch) > 127 for ch in value):
        return None

    if not MOJI_GLYPHS.search(value):
        return None

    # Reverse-transform: UTF-8 bytes that were decoded as CP1251 text.
    try:
        raw = bytes([ord(ch).encode("cp1251")[0] for ch in value])
        fixed = raw.decode("utf-8")
    except Exception:
        return None

    if fixed == value:
        return None

    if "\uFFFD" in fixed:
        return None

    if not fixed.strip():
        return None

    if not has_suspected_mojibake(value):
        return None

    # Ensure decoded text starts looking right (mostly Cyrillic letters preserved for Russian data).
    fixed_cyrillic = sum(1 for ch in fixed if "\u0400" <= ch <= "\u04ff")
    if fixed_cyrillic < 2:
        return None

    return fixed


def walk(obj: Any, path: str, fixes: list[tuple[str, str, str]]) -> Any:
    if isinstance(obj, dict):
        return {key: walk(val, f"{path}.{key}" if path else key, fixes) for key, val in obj.items()}

    if isinstance(obj, list):
        return [walk(item, f"{path}[{idx}]", fixes) for idx, item in enumerate(obj)]

    if isinstance(obj, str):
        fixed = can_fix_mojibake(obj)
        if fixed and fixed != obj:
            fixes.append((path, obj, fixed))
            return fixed
        return obj

    return obj


def process_text_file(path: Path, dry_run: bool) -> list[tuple[str, str, str]]:
    if not path.exists():
        return []

    text = path.read_text(encoding="utf-8")

    if path.suffix == ".ts":
        start = text.find("= ")
        if start == -1:
            return []

        data_start = text.find("[", start)
        if data_start == -1:
            return []

        data_end = text.rfind(";")
        if data_end == -1 or data_end <= data_start:
            return []

        payload = text[data_start:data_end].strip()
        try:
            data = json.loads(payload)
        except Exception:
            return []

        fixes: list[tuple[str, str, str]] = []
        fixed_data = walk(data, path.name, fixes)
        if not fixes:
            return []

        if not dry_run:
            new_payload = json.dumps(fixed_data, ensure_ascii=False, indent=2)
            new_text = text[:data_start] + new_payload + ";\n" + text[data_end + 1 :]
            path.write_text(new_text, encoding="utf-8")
        return fixes

    data = json.loads(text)
    fixes: list[tuple[str, str, str]] = []
    fixed_data = walk(data, path.name, fixes)

    if not fixes:
        return []

    if not dry_run:
        path.write_text(json.dumps(fixed_data, ensure_ascii=False, indent=2), encoding="utf-8")
    return fixes


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    all_fixes: list[tuple[str, str, str, str]] = []
    changed_files = 0

    for file in TARGET_FILES:
        fixes = process_text_file(file, dry_run=dry_run)
        if fixes:
            changed_files += 1
            for item in fixes:
                all_fixes.append((str(file),) + item)

    print(json.dumps({"changed_files": changed_files, "total_fixes": len(all_fixes), "dry_run": dry_run}, ensure_ascii=False))
    print(f"changed_files={changed_files}")
    print(f"total_fixes={len(all_fixes)}")
    for file, path_key, before, after in all_fixes[:60]:
        print(f"{file}:{path_key}")
        print("BEFORE:", before[:140])
        print("AFTER :", after[:140])
        print("---")


if __name__ == "__main__":
    import sys
    main()
