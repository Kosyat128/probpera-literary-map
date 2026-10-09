#!/usr/bin/env python3
"""Read-only validation of a specification package; never runs application tests.
Usage: python tools/validate_package.py
Requires only Python standard library. Writes JSON to stdout and exits nonzero on errors.
"""
from __future__ import annotations
import hashlib
import json
import re
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
checks: dict[str, object] = {}

def check(name: str, condition: bool, detail: object = None) -> None:
    checks[name] = {'ok': bool(condition), 'detail': detail}
    if not condition:
        errors.append(name)

def load(path: str) -> dict:
    try:
        return json.loads((ROOT / path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        raise RuntimeError(f'{path}: {exc}') from exc

def canonical(record: dict) -> bytes:
    keys = ['id', 'module', 'conditions', 'expected', 'required_level']
    return json.dumps({k: record[k] for k in keys}, sort_keys=True,
                      ensure_ascii=False, separators=(',', ':')).encode()

def main() -> int:
    task = load('TASKS.json')
    tests = task['tests']
    modules = task['modules']
    mids = [m['id'] for m in modules]
    tids = [t['id'] for t in tests]
    check('unique_modules', len(mids) == len(set(mids)))
    check('module_inventory', mids == [f'M{i:02d}' for i in range(26)], len(mids))
    check('unique_test_ids', len(tids) == len(set(tids)))
    check('declared_counts', task['module_count'] == len(modules) and task['acceptance_count'] == len(tests), len(tests))
    check('all_application_tests_not_run', all(t['status'] == 'NOT_RUN' and t.get('evidence') is None for t in tests))
    check('no_implementation_claim', task['implementation_started'] is False)
    check('test_ids_valid', all(re.fullmatch(r'M\d{2}-T\d{2}', t) for t in tids))
    by_module = {m: {t['id'] for t in tests if t['module'] == m} for m in mids}
    for m in modules:
        mid = m['id']
        check(f'{mid}.mapped', set(m['test_ids']) == by_module[mid])
        path = ROOT / m['specification']
        check(f'{mid}.file', path.is_file())
        if path.is_file():
            found = re.findall(r'^\| (M\d{2}-T\d{2}) \|', path.read_text(), flags=re.M)
            check(f'{mid}.table', len(found) == len(set(found)) and set(found) == by_module[mid])
        check(f'{mid}.dependencies_exist', set(m['depends_on']) <= set(mids))
    visiting: set[str] = set()
    done: set[str] = set()
    graph = {m['id']: m['depends_on'] for m in modules}
    def visit(mid: str) -> None:
        if mid in visiting:
            raise ValueError('dependency cycle: ' + mid)
        if mid in done:
            return
        visiting.add(mid)
        for dep in graph[mid]:
            visit(dep)
        visiting.remove(mid)
        done.add(mid)
    try:
        for mid in mids:
            visit(mid)
        check('dependency_graph_acyclic', True)
    except (KeyError, ValueError) as exc:
        check('dependency_graph_acyclic', False, str(exc))
    inherited = load('INHERITANCE.json')
    current = {t['id']: hashlib.sha256(canonical(t)).hexdigest() for t in tests}
    check('r2_201_definitions_retained', len(inherited['test_fingerprints']) == 201 and
          all(current.get(k) == v for k, v in inherited['test_fingerprints'].items()))
    check('added_count', sum(t.get('origin') == 'R3_ADDED' for t in tests) == task['added_acceptance_count'])
    acc = (ROOT / 'ACCEPTANCE.md').read_text()
    acc_ids = re.findall(r'^\| (M\d{2}-T\d{2}) \|', acc, re.M)
    check('acceptance_projection', Counter(acc_ids) == Counter(tids))
    full = (ROOT / 'FULL_PROMPT.txt').read_text()
    for name in ['START_CODEX.txt', 'ADMIN_SPEC.md', 'ACCEPTANCE.md', 'EVIDENCE.md']:
        check('standalone_contains_' + name, (ROOT / name).read_text().strip() in full)
    template = load('ACCEPTANCE_RESULTS_TEMPLATE.json')
    check('results_template_complete', [r['test_id'] for r in template['results']] == tids)
    check('results_template_not_run', all(r['status'] == 'NOT_RUN' and r['evidence_path'] is None for r in template['results']))
    source = load('SOURCE_REVIEW_R3.json')
    known_sources = {x['id'] for x in source['source_files'] + source['official_sources']}
    observation_ids = {f['id'] for f in source['observations']}
    check('new_sources_resolve', all(set(f['sources']) <= known_sources for f in source['observations']))
    check('new_sources_count', len(source['source_files']) == 14)
    all_module_text = '\n'.join((ROOT / m['specification']).read_text() for m in modules)
    mentioned = set(re.findall(r'R3E\d{2}', all_module_text))
    check('new_evidence_refs_resolve', mentioned <= observation_ids, sorted(mentioned))
    # Explicit versioned package references elsewhere may describe history. They are not file dependencies.
    check('exclusions_retained', 'hyphen/dash changes' in task['exclusions'] and 'Дефисы и тире полностью исключены' in (ROOT/'START_CODEX.txt').read_text())
    manifest = load('MANIFEST.json')
    listed = manifest['files']
    actual = {str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name != 'MANIFEST.json' and '__pycache__' not in p.parts}
    check('manifest_inventory', actual == set(listed), {'listed': len(listed), 'actual': len(actual)})
    corrupt = []
    for rel, info in listed.items():
        p = ROOT/rel
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() != info['sha256'] or p.stat().st_size != info['bytes']:
            corrupt.append(rel)
    check('file_hashes', not corrupt, corrupt)
    result = dict(scope='PACKAGE_VALIDATION_ONLY', applicationTestsRun=False,
                  applicationState='NOT_RUN', package=task['package'], modules=len(modules),
                  acceptanceCriteria=len(tests), inheritedCriteria=201,
                  addedCriteria=task['added_acceptance_count'], checks=checks,
                  errors=errors, ok=not errors)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({'scope':'PACKAGE_VALIDATION_ONLY','ok':False,'error':str(exc)},ensure_ascii=False,indent=2))
        sys.exit(2)
