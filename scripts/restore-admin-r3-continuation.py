"""Verify or restore the committed R3 continuation material using only Python stdlib."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import zipfile


REPO = Path(__file__).resolve().parents[1]
EVIDENCE = REPO / "docs/admin-r3-continuation/2026-11-11"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    if not name or "\\" in name or ":" in name or "\x00" in name:
        raise ValueError("Unsafe archive path")
    path = PurePosixPath(name)
    if path.is_absolute() or path.as_posix() != name:
        raise ValueError("Noncanonical archive path")
    reserved = {"CON", "PRN", "AUX", "NUL"} | {f"{prefix}{i}" for prefix in ("COM", "LPT") for i in range(1, 10)}
    for part in path.parts:
        if part in ("", ".", "..") or part.endswith((" ", ".")) or part.split(".")[0].upper() in reserved:
            raise ValueError("Unsafe archive path component")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Verify archive and every payload without restoring files")
    parser.add_argument("--destination", type=Path, default=REPO.parent / "work", help="New work directory outside the repository")
    args = parser.parse_args()
    receipt = json.loads((EVIDENCE / "continuation-work.receipt.json").read_text(encoding="utf-8-sig"))
    byte_inputs = json.loads((EVIDENCE / "exact-byte-inputs.json").read_text(encoding="utf-8-sig"))
    for row in byte_inputs["files"]:
        relative = safe_name(row["path"])
        data = REPO.joinpath(*relative.parts).read_bytes()
        if len(data) != row["bytes"] or sha(data) != row["sha256"]:
            raise ValueError("Exact-byte source changed during checkout: " + row["path"])
    archive = EVIDENCE / "continuation-work.zip"
    if archive.stat().st_size != receipt["archive"]["bytes"] or sha(archive.read_bytes()) != receipt["archive"]["sha256"]:
        raise ValueError("Continuation archive does not match its committed receipt")
    destination = args.destination.resolve()
    if destination == REPO or REPO in destination.parents:
        raise ValueError("Restore only outside the repository")
    if not args.verify and destination.exists():
        raise FileExistsError("Destination already exists; choose a new directory. Existing work is never overwritten")

    with zipfile.ZipFile(archive) as source:
        infos = source.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(name.casefold() for name in names)):
            raise ValueError("Duplicate or case-colliding archive paths")
        for info in infos:
            safe_name(info.filename)
            file_type = stat.S_IFMT(info.external_attr >> 16)
            if info.is_dir() or file_type not in (0, stat.S_IFREG):
                raise ValueError("Only regular payload files are allowed")
        manifest_bytes = source.read("manifest.json")
        if sha(manifest_bytes) != receipt["manifestSha256"]:
            raise ValueError("Archive manifest hash mismatch")
        manifest = json.loads(manifest_bytes)
        rows = manifest["files"]
        if len(rows) != receipt["payloadCount"] or len(names) != len(rows) + 1:
            raise ValueError("Archive payload count mismatch")
        expected = {row["path"] for row in rows}
        if len(expected) != len(rows) or expected | {"manifest.json"} != set(names):
            raise ValueError("Archive payload inventory mismatch")
        for row in rows:
            safe_name(row["path"])
            data = source.read(row["path"])
            if len(data) != row["bytes"] or sha(data) != row["sha256"]:
                raise ValueError("Archive payload hash mismatch: " + row["path"])

        # All names, sizes and hashes are verified before the first filesystem write.
        if not args.verify:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.mkdir()
            for row in rows:
                target = destination.joinpath(*PurePosixPath(row["path"]).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as handle:
                    handle.write(source.read(row["path"]))
            restored = {
                "classification": "RESTORED_HISTORICAL_WORK_ONLY_NO_APP_TEST_OR_DATABASE_EXECUTION",
                "restoredAt": datetime.now(timezone.utc).isoformat(),
                "destination": str(destination),
                "archiveSha256": receipt["archive"]["sha256"],
                "payloadCount": len(rows),
                "pathPolicy": "Original absolute paths and old PID descriptors are historical only; prepare fresh captures and local environment",
            }
            (destination / "admin-r3-restore-receipt.json").write_text(json.dumps(restored, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "VERIFIED" if args.verify else "RESTORED", "payloadCount": len(rows), "destination": None if args.verify else str(destination)}))


if __name__ == "__main__":
    main()
