# -*- coding: utf-8 -*-
"""Deterministic full-text hygiene audit for user-facing runtime content.

Runtime findings are kept separate from test/fixture examples and from the two
generated ledgers that intentionally preserve rejected or remediated values.
Excluded findings remain in the report for traceability; they do not affect the
runtime release summary.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPORT_PATH = ROOT / "reports" / "full-text-audit.json"
MAX_SAMPLES = 200

TEXT_DIRS = (
    Path("src/data"),
    Path("public/cms"),
    Path("apps/admin/components"),
    Path("apps/admin/lib"),
    Path("apps/admin/app/(dashboard)"),
    Path("apps/admin/app/(auth)"),
)

SKIP_PARTS = {".git", "node_modules", ".pnpm-store", "dist", ".codex-runtime", "reports"}
TEXT_EXTS = {".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx", ".html", ".css"}
TEST_OR_FIXTURE_PARTS = {"__tests__", "fixtures", "fixture", "mocks", "test-support"}
HISTORICAL_NEGATIVE_FILES = {
    "src/data/countries/generated/writerIdentityRemediations.generated.json",
    "src/data/countries/generated/writerPortraitRejections.json",
}
AUDIT_SOURCE_SNAPSHOT_FILES = {
    "src/data/countries/generated/writerFacts.wikidata.json",
}

PLACEHOLDER_WORD = re.compile(r"\b(?:TODO|TBD|FIXME|XXX)\b")
FILLER_TEXT = re.compile(r"\b(?:lorem|ipsum)\b", re.IGNORECASE)
MULTI_SPACE = re.compile(r" {2,}")
STRUCTURED_DATE_FIELD = re.compile(
    r"\b(?:birthDate|deathDate|checkedAt)\b['\"]?\s*:\s*['\"]([^'\"]+)['\"]"
)
VALID_PARTIAL_DATE = re.compile(
    r"\+?-?\d{1,16}(?:-\d{2})?(?:-\d{2})?(?:\s*до\s+н\.\s*э\.?)?",
    re.IGNORECASE,
)
NUMERIC_HYPHEN = re.compile(r"\d\s*[-\u2013\u2014]\s*\d")


def relative_name(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def audit_scope(path: Path) -> str:
    relative = relative_name(path)
    if relative in HISTORICAL_NEGATIVE_FILES:
        return "historical-negative-evidence"
    if relative in AUDIT_SOURCE_SNAPSHOT_FILES:
        return "audit-source-snapshot"

    lowered_parts = {part.lower() for part in Path(relative).parts}
    lowered_name = path.name.lower()
    if (
        lowered_parts.intersection(TEST_OR_FIXTURE_PARTS)
        or ".test." in lowered_name
        or ".spec." in lowered_name
    ):
        return "test-or-fixture"

    return "runtime"


def is_text_file(path: Path) -> bool:
    if path.suffix.lower() not in TEXT_EXTS:
        return False
    return not set(path.parts).intersection(SKIP_PARTS)


def cyrillic_count(value: str) -> int:
    return sum(1 for character in value if "\u0400" <= character <= "\u04ff")


def try_fix_encoding(line: str) -> str | None:
    try:
        return line.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return None


def is_mojibake_candidate(line: str) -> bool:
    if "\ufffd" in line:
        return True

    if not any(ord(character) > 127 for character in line):
        return False

    fixed = try_fix_encoding(line)
    if fixed is None or fixed == line or "\ufffd" in fixed:
        return False

    return cyrillic_count(fixed) > cyrillic_count(line)


def has_suspicious_date_like(line: str) -> bool:
    match = STRUCTURED_DATE_FIELD.search(line)
    if not match:
        return False
    value = match.group(1).strip()
    if VALID_PARTIAL_DATE.fullmatch(value):
        return False
    return bool(NUMERIC_HYPHEN.search(value))


def finding_categories(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped:
        return []

    categories: list[str] = []
    if PLACEHOLDER_WORD.search(stripped) or FILLER_TEXT.search(stripped):
        categories.append("placeholders")

    # Leading indentation is syntax/layout, not a user-facing double space.
    if (
        MULTI_SPACE.search(stripped)
        and not stripped.startswith(("//", "*"))
        and "contentHtml" not in stripped
        and not any(character in stripped for character in "\u2502\u251c\u2514\u2500")
    ):
        categories.append("double_space")

    if has_suspicious_date_like(stripped):
        categories.append("suspicious_date_like")

    if is_mojibake_candidate(stripped):
        categories.append("encoding_mojibake")

    return categories


def audit() -> dict[str, object]:
    runtime_results: defaultdict[str, list[dict[str, object]]] = defaultdict(list)
    excluded_results: defaultdict[str, list[dict[str, object]]] = defaultdict(list)
    scanned_paths: set[Path] = set()
    scope_file_counts: defaultdict[str, int] = defaultdict(int)

    for relative_directory in TEXT_DIRS:
        directory = ROOT / relative_directory
        if not directory.exists():
            continue

        for path in sorted(directory.rglob("*")):
            resolved = path.resolve()
            if not path.is_file() or not is_text_file(path) or resolved in scanned_paths:
                continue
            scanned_paths.add(resolved)

            scope = audit_scope(path)
            scope_file_counts[scope] += 1
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue

            for line_number, line in enumerate(text.splitlines(), start=1):
                categories = finding_categories(line)
                if not categories:
                    continue

                fixed = try_fix_encoding(line) if "encoding_mojibake" in categories else None
                for category in categories:
                    finding: dict[str, object] = {
                        "path": relative_name(path),
                        "line": line_number,
                        "text": line.strip()[:220],
                    }
                    if category == "encoding_mojibake" and fixed is not None:
                        finding["suggestedText"] = fixed.strip()[:220]

                    if scope == "runtime":
                        runtime_results[category].append(finding)
                    else:
                        finding["scope"] = scope
                        excluded_results[category].append(finding)

    ordered_runtime = {key: runtime_results[key] for key in sorted(runtime_results)}
    ordered_excluded = {key: excluded_results[key] for key in sorted(excluded_results)}
    runtime_summary = {key: len(value) for key, value in ordered_runtime.items()}
    excluded_summary = {key: len(value) for key, value in ordered_excluded.items()}

    return {
        "meta": {
            "schemaVersion": 2,
            "root": ".",
            "filesScanned": len(scanned_paths),
            "filesByScope": {
                scope: scope_file_counts[scope]
                for scope in (
                    "runtime",
                    "test-or-fixture",
                    "historical-negative-evidence",
                    "audit-source-snapshot",
                )
            },
            "runtimeIssueCount": sum(runtime_summary.values()),
            "excludedIssueCount": sum(excluded_summary.values()),
            "exclusionPolicy": (
                "Test/fixture, historical-negative-evidence and audit-source-snapshot "
                "findings are retained below for traceability, but are not "
                "release-blocking runtime findings."
            ),
        },
        "summary": runtime_summary,
        "items": ordered_runtime,
        "excluded": {
            "summary": excluded_summary,
            "items": ordered_excluded,
        },
    }


def serialize(report: dict[str, object]) -> str:
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    return rendered.replace("\u2013", "-").replace("\u2014", "-") + "\n"


def console_text(value: object) -> str:
    rendered = str(value)
    encoding = sys.stdout.encoding or "utf-8"
    return rendered.encode(encoding, errors="backslashreplace").decode(encoding)


def print_summary(report: dict[str, object]) -> None:
    meta = report["meta"]
    print("Scanned:", meta["filesScanned"])
    print("Files by scope:", json.dumps(meta["filesByScope"], ensure_ascii=False))
    print("Runtime issues:", meta["runtimeIssueCount"])
    for category, count in report["summary"].items():
        print(category, count)
        for finding in report["items"][category][:MAX_SAMPLES]:
            print(
                " ",
                finding["path"],
                finding["line"],
                console_text(finding["text"]),
            )
        if count > MAX_SAMPLES:
            print(f"   ... +{count - MAX_SAMPLES}")
    print("Excluded issues:", meta["excludedIssueCount"])
    for category, count in report["excluded"]["summary"].items():
        print(" excluded", category, count)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when the committed report is not byte-for-byte current.",
    )
    args = parser.parse_args(argv)

    report = audit()
    rendered = serialize(report)
    print_summary(report)

    if args.check:
        if not REPORT_PATH.exists() or REPORT_PATH.read_text(encoding="utf-8") != rendered:
            print(f"Stale report: {relative_name(REPORT_PATH)}", file=sys.stderr)
            return 1
        print(f"Current report: {relative_name(REPORT_PATH)}")
        return 0

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(rendered, encoding="utf-8")
    print(f"Wrote: {relative_name(REPORT_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
