#!/usr/bin/env python
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

TARGET_KEYS = {
    "about",
    "bio",
    "biography",
    "birthplace",
    "comment",
    "content",
    "contenthtml",
    "country",
    "deathplace",
    "description",
    "excerpt",
    "fullname",
    "genre",
    "heading",
    "historicalnote",
    "history",
    "intro",
    "label",
    "lead",
    "name",
    "notes",
    "ogdescription",
    "ogtitle",
    "province",
    "publication",
    "quote",
    "region",
    "review",
    "sodescription",
    "seodescription",
    "seotitle",
    "series",
    "shortdescription",
    "subheading",
    "subtitle",
    "summary",
    "text",
    "title",
    "years",
}

PLACEHOLDER_TOKENS = ["TODO", "TBD", "FIXME", "XXX", "lorem ipsum", "Lorem ipsum"]
PLACEHOLDER_RE = re.compile(
    "|".join(re.escape(token) for token in PLACEHOLDER_TOKENS), re.IGNORECASE
)


def normalize_text(value: str, key: str) -> str:
    if not isinstance(value, str):
        return value

    k = (key or "").lower()
    v = value.replace("\u00a0", " ").replace("\ufeff", "").replace("\u200b", "")
    v = v.replace("\r\n", "\n").replace("\r", "\n")

    if k in {"contenthtml", "content"}:
        v = v.strip()
        v = re.sub(r"[ \t]+\n", "\n", v)
        v = re.sub(r"\n+$", "", v).strip()
    else:
        v = "\n".join(line.strip() for line in v.split("\n"))
        v = re.sub(r" {2,}", " ", v)
        v = re.sub(r" {2,}", " ", v)
        v = re.sub(r"\n{3,}", "\n\n", v).strip()

    v = PLACEHOLDER_RE.sub("", v)

    if key == "title" and "\n" in v:
        lines = [line.strip() for line in v.split("\n") if line.strip()]
        if lines:
            v = lines[0]

    if key == "years" and v == "":
        v = "-"

    v = v.replace("  ", " ").strip()
    v = re.sub(r"\s{2,}", " ", v)
    v = re.sub(r"\s+([,:.;!?])", r"\1", v)
    v = re.sub(r"([,:.;!?])\s+", r"\1 ", v)
    return v


def walk(obj, changed, key_context=None):
    if isinstance(obj, dict):
        for key, value in list(obj.items()):
            k = str(key)
            lk = k.lower()
            if isinstance(value, str) and (
                lk in TARGET_KEYS or key_context in {"title", "years"} or (k == "title" and "\n" in value)
            ):
                new_value = normalize_text(value, k)
                if new_value != value:
                    changed.append((k, value, new_value))
                    obj[k] = new_value
            else:
                walk(value, changed, k)
    elif isinstance(obj, list):
        for item in obj:
            walk(item, changed, key_context)


def main():
    files = [
        *sorted((ROOT / "public" / "cms" / "articles").glob("*.json")),
        ROOT / "public" / "cms" / "published-articles.json",
        ROOT / "public" / "cms" / "published-content.json",
        ROOT / "src" / "data" / "countries" / "generated" / "writers.generated.json",
        ROOT / "src" / "data" / "countries" / "generated" / "books.generated.json",
    ]

    total_changed = 0
    for file_path in files:
        if not file_path.exists():
            continue
        data = json.loads(file_path.read_text(encoding="utf-8"))
        changed = []
        walk(data, changed)
        if changed:
            file_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            total_changed += len(changed)
            print(f"{file_path.relative_to(ROOT)}: {len(changed)}")

    print(f"Total changes: {total_changed}")


if __name__ == "__main__":
    main()
