from pathlib import Path

workflow = Path(".github/workflows/apply-admin-catalog-assets.yml")
source = workflow.read_text(encoding="utf-8")
start_marker = "          python <<'PY'\n"
end_marker = "\n          PY\n"

if source.count(start_marker) != 1:
    raise SystemExit("catalog patch workflow does not contain one Python block")

block = source.split(start_marker, 1)[1].split(end_marker, 1)[0]
lines = []
for line in block.splitlines():
    if line.startswith("          "):
        lines.append(line[10:])
    elif not line:
        lines.append("")
    else:
        raise SystemExit(f"unexpected catalog patch indentation: {line[:80]}")

program = "\n".join(lines) + "\n"
exec(compile(program, str(workflow), "exec"), {"__name__": "__main__"})
