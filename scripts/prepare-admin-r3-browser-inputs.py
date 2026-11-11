#!/usr/bin/env python3
"""Capture current R3 browser inputs as metadata/copies, without running JS.

Usage (from any working directory):
  python scripts/prepare-admin-r3-browser-inputs.py --kind creator --output ../work/creator-inputs
  python scripts/prepare-admin-r3-browser-inputs.py --kind pending --output ../work/pending-inputs

Outputs must be new directories under the checkout's sibling work directory.
No application import, compilation, browser, service, database or provider runs.
Old BEFORE snapshots are never rewritten or relabelled as current validation.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


REFERENCE_4DF = '4dfef15fce331db39acc97da710c1a814b30554434b72754239f95111e4edb78'
IMPORT = re.compile(r'''(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["'])([^"']+)\1''')
SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json',
            '/index.ts', '/index.tsx', '/index.js']
BOUNDARIES = {
    'browser': {
        'apps/admin/app/(dashboard)/pages/actions.ts',
        'apps/admin/app/(dashboard)/editor-links/actions.ts',
        'apps/admin/app/(dashboard)/editor-autosave/actions.ts',
    },
    'server': {
        'apps/admin/lib/auth.ts',
        'apps/admin/lib/supabase/server.ts',
        'apps/admin/lib/env.ts',
        'apps/admin/lib/auto-translate-published-article-premium.ts',
    },
}
KINDS = {
    'creator': {
        'browser': [
            'apps/admin/tests/browser/fixtures/page-creator-entry.jsx',
            'apps/admin/components/PageEditorLoader.tsx',
            'apps/admin/lib/page-load-validation.ts',
            'apps/admin/app/(dashboard)/pages/CreatePageForm.tsx',
        ],
        'fixtures': [
            'apps/admin/tests/browser/page-creator-browser.mjs',
            'apps/admin/tests/browser/fixtures/page-creator-entry.jsx',
            'apps/admin/lib/fixtures/page-creator-cases.mjs',
            'apps/admin/lib/fixtures/page-creator-runtime.cjs',
            'apps/admin/lib/fixtures/page-creator-original-oracle.cjs',
        ],
        'references': ['apps/admin/app/(dashboard)/pages/page.tsx'],
    },
    'pending': {
        'browser': [
            'apps/admin/components/PageEditor.tsx',
            'apps/admin/tests/browser/fixtures/page-pending-entry.jsx',
        ],
        'fixtures': [
            'apps/admin/tests/browser/page-pending-browser.mjs',
            'apps/admin/tests/browser/fixtures/page-pending-entry.jsx',
            'apps/admin/tests/browser/fixtures/page-pending-action-runtime.cjs',
            'apps/admin/tests/browser/fixtures/page-pending-submitter-cases.mjs',
        ],
        'references': [],
    },
}
BASE_PACKAGES = {
    'next', 'react', 'react-dom', 'typescript', 'esbuild', 'playwright',
    '@supabase/supabase-js', 'zod', '@tiptap/core', '@tiptap/react',
    '@tiptap/starter-kit', 'sanitize-html',
}
VIRTUAL_IMPORTS = {'page-creator-current-field-children'}
GUARD_QUALIFIER = (
    'The actual canEditPageBundle/read-validation and PageEditorLoader remain in '
    'the creator path. Guarded unavailability or payload incoherence does not '
    'establish native persistence loss. Form controls use the actual component '
    'and unchanged JSX children extracted from the captured server page; this '
    'is not a full Next Page/Auth execution.'
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inside(path, root):
    return path == root or root in path.parents


def source_path(repo, name):
    """Read only checkout files, rejecting lexical escapes and symlink escapes."""
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError(f'Unsafe source path: {name}')
    path = repo / relative
    resolved = path.resolve(strict=True)
    if not inside(resolved, repo) or not resolved.is_file():
        raise ValueError(f'Source escapes checkout or is not a file: {name}')
    return path


def local_import(repo, request, parent):
    if request.startswith('@/'):
        target = repo / 'apps/admin' / request[2:]
    elif request.startswith('.'):
        target = (repo / parent).parent / request
    elif request.startswith('/') or re.match(r'^[A-Za-z]:', request):
        raise ValueError(f'Absolute source import refused: {request} from {parent}')
    else:
        return None
    for suffix in SUFFIXES:
        candidate = Path(str(target) + suffix)
        if not candidate.is_file():
            continue
        actual = candidate.resolve(strict=True)
        if not inside(actual, repo):
            raise ValueError(f'Local import symlink/path escapes checkout: {request} from {parent}')
        # Keep the logical in-checkout import path; do not rewrite source aliases.
        logical = Path(os.path.abspath(candidate))
        if not inside(logical, repo):
            raise ValueError(f'Local import path escapes checkout: {request} from {parent}')
        return logical.relative_to(repo).as_posix()
    raise ValueError(f'Unresolved static local import: {request} from {parent}')


def package_name(request):
    if request.startswith('node:') or request in VIRTUAL_IMPORTS:
        return None
    if request.startswith('@'):
        return '/'.join(request.split('/')[:2])
    return request.split('/')[0]


def output_path(repo, requested):
    work = repo.parent / 'work'
    if work.is_symlink() or (work.exists() and work.resolve(strict=True) != work):
        raise ValueError('Sibling work directory must not be a symlink/reparse escape')
    output = Path(os.path.abspath(requested))
    if output == work or not inside(output, work):
        raise ValueError('Output must be a new directory inside repo.parent/work')
    current = output
    while current != work:
        if os.path.lexists(current):
            if current == output or current.is_symlink() or current.resolve(strict=True) != current:
                raise ValueError('Output exists or its parent contains a symlink/reparse escape')
        current = current.parent
    return output


def read_reference(path):
    if path is None:
        return None, {}
    actual = path.resolve(strict=True)
    data = actual.read_bytes()
    snapshot = json.loads(data.decode('utf-8-sig'))
    if snapshot.get('validationSourceSha256') != REFERENCE_4DF:
        raise ValueError('--reference-4df is not the preserved 4df reference snapshot')
    rows = snapshot.get('files')
    if not isinstance(rows, list):
        raise ValueError('Historical reference has no files array')
    mapping = {}
    for row in rows:
        if row['path'] in mapping:
            raise ValueError('Duplicate historical reference path')
        mapping[row['path']] = row
    return {'file': str(actual), 'bytes': len(data), 'sha256': sha(data),
            'fingerprint': REFERENCE_4DF, 'role': 'historical-reference-only'}, mapping


def prepare(args):
    repo = args.repo.resolve(strict=True)
    if not repo.is_dir() or not (repo / 'apps/admin/package.json').is_file():
        raise ValueError('--repo must identify the project checkout')
    output = output_path(repo, args.output)
    reference, historical = read_reference(args.reference_4df)
    spec = KINDS[args.kind]
    roles, edges, external, source_bytes = {}, [], set(), {}

    def read(name):
        data = source_path(repo, name).read_bytes()
        previous = source_bytes.setdefault(name, data)
        if previous != data:
            raise ValueError(f'Source changed while reading: {name}')
        return data

    for scope, roots in [('browser', spec['browser']),
                         ('server', ['apps/admin/app/(dashboard)/pages/actions.ts'])]:
        pending, seen = list(roots), set()
        while pending:
            name = pending.pop()
            if name in seen:
                continue
            seen.add(name)
            boundary = name in BOUNDARIES[scope]
            roles.setdefault(name, set()).add(scope + ('-boundary-reference' if boundary else '-static-candidate'))
            data = read(name)
            if boundary:
                continue
            for match in IMPORT.finditer(data.decode('utf-8-sig')):
                request = match[2]
                target = local_import(repo, request, name)
                if target:
                    edges.append({'scope': scope, 'from': name, 'request': request, 'to': target})
                    pending.append(target)
                else:
                    external.add(request)

    for name in spec['fixtures']:
        roles.setdefault(name, set()).add('fixture')
        read(name)
    for name in spec['references']:
        roles.setdefault(name, set()).add('creator-field-children-reference-not-full-page-execution')
        read(name)
    # The capturer is provenance, not an application/runtime source candidate.
    capturer = Path(__file__).resolve(strict=True)
    if not inside(capturer, repo):
        raise ValueError('Capturer itself must run from this checkout')
    capture_tool = capturer.relative_to(repo).as_posix()
    roles.setdefault(capture_tool, set()).add('metadata-capture-tool-not-executed-in-browser')
    read(capture_tool)

    packages, package_bytes = [], {}

    def add_package(name, package=None):
        data = source_path(repo, name).read_bytes()
        if name in package_bytes:
            return
        package_bytes[name] = data
        row = {'file': name, 'bytes': len(data), 'sha256': sha(data)}
        if package:
            parsed = json.loads(data.decode('utf-8-sig'))
            row.update(name=parsed.get('name'), version=parsed.get('version'))
        packages.append(row)

    for name in ['package.json', 'apps/admin/package.json', 'package-lock.json', 'pnpm-lock.yaml']:
        if (repo / name).is_file():
            add_package(name)
    names = BASE_PACKAGES | {name for request in external if (name := package_name(request))}
    for name in sorted(names):
        candidates = [f'node_modules/{name}/package.json', f'apps/admin/node_modules/{name}/package.json']
        found = False
        for file in candidates:
            if (repo / file).is_file():
                add_package(file, name)
                found = True
        if not found:
            raise ValueError(f'Installed package manifest unavailable: {name}; restore dependencies first')
    packages.sort(key=lambda row: row['file'])

    rows = []
    for name in sorted(roles):
        data = source_bytes[name]
        row = {'file': name, 'bytes': len(data), 'sha256': sha(data), 'roles': sorted(roles[name])}
        if reference:
            previous = historical.get(name)
            row['referenceFrozen4dfMatch'] = bool(previous and previous['size'] == len(data) and previous['sha256'] == row['sha256'])
            row['referenceFrozen4dfSha256'] = previous['sha256'] if previous else None
        rows.append(row)
    all_names = [row['file'] for row in rows]
    if len({name.casefold() for name in all_names}) != len(all_names):
        raise ValueError('Case-insensitive duplicate source path')
    source_age = {'current': 'ACTUAL_CURRENT_AFTER_M19_AND_M20_PRODUCTION_EDITS',
                  'globalSnapshotClaim': None, 'referenceFrozenFingerprintOnly': REFERENCE_4DF if reference else None}
    if reference:
        source_age['changedOrNewFromReference'] = [row['file'] for row in rows if not row['referenceFrozen4dfMatch']]
    manifest = {
        'classification': 'PORTABLE_CURRENT_AFTER_INPUT_CAPTURE_NOT_TEST_OR_BROWSER_EXECUTION',
        'kind': args.kind, 'preparedAt': datetime.now(timezone.utc).isoformat(),
        'repo': str(repo), 'captureRoot': str(output / 'captured-current'),
        'validationSourceSha256': None, 'sourceFingerprint': None, 'sourceAge': source_age,
        'historicalReference': reference, 'sourceCount': len(rows), 'sources': rows,
        'staticEdges': sorted(edges, key=lambda row: (row['scope'], row['from'], row['request'])),
        'externalImportNames': sorted(external), 'packages': packages,
        'installedPackageIdentityScope': 'All required harness packages plus literal-import package manifests at both checkout resolution locations; transitive bundle input bytes are recorded by the future authorized producer, not claimed captured here.',
        'capturedInputsSha256': sha(json.dumps({'sources': rows, 'packages': packages}, sort_keys=True, separators=(',', ':')).encode()),
        'staticCoverageQualification': 'Conservative literal-import closure including type-only imports. Boundary/reference files are not claimed executed. Computed fixture paths are explicitly enumerated. No current-source fallback is added.',
        'guardQualifier': GUARD_QUALIFIER,
        'execution': {'applicationImport': 'NOT_RUN', 'compile': 'NOT_RUN', 'bundle': 'NOT_RUN',
                      'browser': 'NOT_RUN', 'server': 'NOT_STARTED', 'database': 'NOT_STARTED', 'tests': 'NOT_RUN'},
        'proofLevels': ['Metadata preparation only. No native DB/Auth/RLS, full Next transport or full module acceptance.',
                        'The original BEFORE and its failures remain separate and immutable. Fresh checkout line endings are captured as actual current bytes.'],
    }
    if args.kind == 'creator':
        manifest['creatorAdapterProvenance'] = {
            'genuineBeforeProducerSha256': '56929315bb77691dc1978352bb77068b635799743cdde527d1342286251cdcf2',
            'initialUnrunAfterAdapterSha256': '2837dc7edc7956333a40cb305896d2e11002c3700032f2fbf4acc5f3c3c77e9e',
            'currentProducer': next(row for row in rows if row['file'] == spec['fixtures'][0]),
            'metadataCorrection': 'Three report/receipt CONTROLLED_BEFORE labels changed to AFTER; no original oracle/case/control changed. Historical browser-adapter-preservation receipt is not rewritten.',
        }

    # No output is created until all source, package and optional reference reads succeed.
    output.mkdir(parents=True, exist_ok=False)
    capture = output / 'captured-current'
    for name, data in source_bytes.items():
        target = capture / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as handle:
            handle.write(data)
        if target.read_bytes() != data or source_path(repo, name).read_bytes() != data:
            raise ValueError(f'Capture/live source drift: {name}; partial output retained, use a new directory')
    for name, data in package_bytes.items():
        if source_path(repo, name).read_bytes() != data:
            raise ValueError(f'Installed package drift: {name}; partial output retained, use a new directory')
    data = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
    with (output / 'inputs.freeze.json').open('xb') as handle:
        handle.write(data)
    return {'classification': manifest['classification'], 'kind': args.kind,
            'manifest': str(output / 'inputs.freeze.json'), 'manifestSha256': sha(data),
            'sources': len(rows), 'packageIdentities': len(packages),
            'capturedInputsSha256': manifest['capturedInputsSha256'], 'applicationExecutions': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--kind', choices=KINDS, required=True)
    parser.add_argument('--output', type=Path, required=True, help='New directory under repo.parent/work')
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--reference-4df', type=Path, help='Optional restored historical source-before.json; reference only')
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args), ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError, UnicodeError) as error:
        print(f'Capture refused: {error}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
