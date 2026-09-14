import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

async function main() {
  const root = process.cwd();
  const target = path.resolve(root, '.tmp/s09-archive-header-20260914/cover-closure');
  if (!target.startsWith(root + path.sep) || fs.realpathSync(target) !== target) throw Error('Uncontained output');
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const json = value => JSON.stringify(value, null, 2) + '\n';
  const read = relative => {
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep) || fs.realpathSync(filename) !== filename) throw Error('Uncontained or linked input: ' + relative);
    return fs.readFileSync(filename);
  };
  const sourceCommit = execFileSync('git', ['-c', 'safe.directory=' + root.replaceAll('\\', '/'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const receipt = JSON.parse(read('.tmp/content-exports/s08-20260914-a1/result.json'));
  const oldPins = JSON.parse(read('.tmp/content-exports/s08-20260914-a1/source-inputs.json'));
  const dataPins = oldPins.filter(pin => pin.path.startsWith('src/data/') || pin.path === 'src/utils/countryFlag.ts' || pin.path === 'data/book-canon-source-registry.json');
  const sourcePins = dataPins.map(pin => ({ path: pin.path, sha256: sha(read(pin.path)) }));
  if (sourcePins.some((pin, index) => pin.sha256 !== dataPins[index].sha256)) throw Error('Current canonical inputs differ from existing projector');
  const projectorPath = '.tmp/content-export-tools/463a7f60-4a6b-487d-a083-4ce2d358e648/projector.mjs';
  const projectorBytes = read(projectorPath);
  if (sha(projectorBytes) !== receipt.toolBundleSha256) throw Error('Projector hash mismatch');
  let projector = projectorBytes.toString('utf8');
  for (const name of ['@noble/hashes/sha2', '@noble/hashes/utils']) projector = projector.replaceAll('"' + name + '"', JSON.stringify(import.meta.resolve(name)));
  projector += '\nexport {bookArchiveCountries,buildBookArchive,isPublicBook};';
  const module = await import('data:text/javascript;base64,' + Buffer.from(projector).toString('base64'));
  const manifestPath = 'scripts/mobile/native-base-assets.json';
  const manifestBytes = read(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const selection = new Map(manifest.files.map(pin => [pin.output, pin]));
  const reportPath = 'reports/cover-rights-audit.json';
  const report = JSON.parse(read(reportPath));
  const books = module.buildBookArchive(module.bookArchiveCountries).filter(module.isPublicBook);
  const keys = books.map(book => [book.countryId, book.writerId, book.id].join(':')).sort();
  if (keys.length !== 46 || sha(JSON.stringify(keys)) !== '6842ab32ebae32e8d718f259d453421821a020a5d5b9d9fd728f58fb2cc028cd') throw Error('Canonical public keyset changed');
  const uniquePins = new Map();
  const remote = [], noArtwork = [], records = [];
  const pinFile = output => {
    if (!/^brand\/book-covers\/(?:thumbs\/)?[a-z0-9._-]+\.webp$/u.test(output)) throw Error('Noncanonical cover path: ' + output);
    const bytes = read('public/' + output);
    const pin = { output, source: 'public/' + output, sourceSha256: sha(bytes), transformation: 'none' };
    const collisionKey = output.toLowerCase();
    if (uniquePins.has(collisionKey)) throw Error('Duplicate cover path or case variant: ' + output);
    uniquePins.set(collisionKey, pin);
    const previous = selection.get(output);
    if (previous && ['output', 'source', 'sourceSha256', 'transformation'].some(field => previous[field] !== pin[field])) throw Error('Existing selection pin mismatch: ' + output);
    return { pin, bytes: bytes.length };
  };
  for (const book of books) {
    const key = [book.countryId, book.writerId, book.id].join(':');
    if (!book.coverUrl) { noArtwork.push(key); continue; }
    if (/^https?:/u.test(book.coverUrl)) { remote.push({ key, coverUrl: book.coverUrl, coverRights: book.coverRights, localDownloadAuthorized: false }); continue; }
    // Deliberately narrower than the display gate: existing local editorial originals only.
    if (book.coverRights?.status !== 'editorial-original') throw Error('Local cover requires separate review: ' + key);
    const prior = report.covers.find(entry => entry.coverUrl === book.coverUrl && entry.status === book.coverRights.status && entry.displayAllowed && entry.issues.length === 0);
    if (!prior || !book.coverThumbnailUrl) throw Error('Missing existing rights audit or canonical thumbnail: ' + key);
    const full = pinFile(book.coverUrl), thumbnail = pinFile(book.coverThumbnailUrl);
    records.push({ key, coverRights: book.coverRights, existingReportRecord: prior, full: full.pin, thumbnail: thumbnail.pin, bytes: full.bytes + thumbnail.bytes });
  }
  records.sort((a, b) => a.key.localeCompare(b.key, 'en'));
  const files = [...uniquePins.values()].sort((a, b) => a.output.localeCompare(b.output, 'en'));
  const additions = files.filter(pin => !selection.has(pin.output));
  if (records.length !== 33 || files.length !== 66 || additions.length !== 54 || remote.length !== 0) throw Error('Expected cover closure changed');
  const proposed = { ...manifest, files: [...manifest.files, ...additions].sort((a, b) => a.output.localeCompare(b.output, 'en')) };
  if (new Set(proposed.files.map(pin => pin.output.toLowerCase())).size !== proposed.files.length) throw Error('Proposed manifest has duplicate paths');
  const support = [manifestPath, reportPath, 'docs/COVER_RIGHTS_POLICY.md', 'src/data/countries.ts', 'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-portrait-selection.mjs'];
  const pins = [...sourcePins, ...support.filter(p => !sourcePins.some(pin => pin.path === p)).map(p => ({ path: p, sha256: sha(read(p)) }))].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const proof = { schemaVersion: 1, sourceCommit, canonicalSourcePinsMatchExistingProjector: true, canonicalSourcePinCount: sourcePins.length, pins };
  const proofBytes = json(proof), proposedBytes = json(proposed);
  const closure = { schemaVersion: 1, scope: 'Derived exact current canonical public editorial cover pairs; not a factual database or rights approval.', sourceCommit, sourcePinsSha256: sha(proofBytes), publicBookKeys: keys, publicBookKeySetSha256: sha(JSON.stringify(keys)), records, files, remoteOrNonlocalCoverRecords: remote, noArtworkKeys: noArtwork.sort(), editorialApprovalCreated: false, legalApprovalCreated: false, releaseReady: false };
  const additionDoc = { schemaVersion: 1, baseManifestPath: manifestPath, baseManifestSha256: sha(manifestBytes), proposedManifestSha256: sha(proposedBytes), sourceCommit, sourcePinsSha256: sha(proofBytes), files: additions };
  const output = { 'source-pins.json': proofBytes, 'canonical-cover-closure.json': json(closure), 'native-base-assets.additions.json': json(additionDoc), 'native-base-assets.proposed.json': proposedBytes };
  const audit = {
    schemaVersion: 1, recordedAt: new Date().toISOString(), status: 'TEMP_SELECTION_READY_FOR_ROOT_REVIEW', sourceCommit,
    derivedFrom: { projector: projectorPath, sha256: sha(projectorBytes), sourceCommit: receipt.sourceCommit, currentCanonicalSourcePinsMatched: sourcePins.length, gate: 'buildBookArchive(bookArchiveCountries).filter(isPublicBook), then require local editorial-original artwork with an existing zero-issue cover-rights report' },
    baseSelection: { path: manifestPath, sha256: sha(manifestBytes), files: manifest.files.length }, proposedSelection: { path: 'native-base-assets.proposed.json', sha256: sha(proposedBytes), files: proposed.files.length },
    counts: { publicBooks: 46, localEditorialCovers: 33, fullAndThumbnailFiles: 66, alreadySelectedFiles: 12, missingFilesToAdd: 54, noArtworkBooks: noArtwork.length, remoteCovers: remote.length },
    sizes: { allCoverBytes: records.reduce((sum, record) => sum + record.bytes, 0), additionalBytes: additions.reduce((sum, pin) => sum + read(pin.source).length, 0) },
    rights: { basis: 'Existing canonical coverRights and existing cover-rights-audit records only.', status: 'editorial-original', existingReportGeneratedAt: report.generatedAt, allPriorReportRecordsDisplayAllowed: true, priorReportIssues: 0, requiredEditorialLabel: 'Preserve current RU/EN editorial-cover attribution; no claim of a publisher edition or ISBN.', newEditorialApproval: false, newLegalApproval: false, independentRightsResearchPerformed: false, existingMetadataAuthenticityNotNewlyCertified: true },
    pwa: { currentDynamicSelection: 'pwa-portrait-selection.mjs selects assets/writer-portraits only.', currentCoverSelection: 'build-pwa.mjs hardcodes six full/thumbnail pairs.', proposed: 'Reuse these exact manifest cover pins as essential offline assets. Copy unchanged bytes and verify source SHA256; never fetch external-preview or unverified artwork.' },
    limits: ['No tracked source, manifest, catalog, tests or state edited.', 'No source build or tests run; the existing exact-hash projector was evaluated after matching current canonical input hashes.', 'No missing-resource assertions suppressed or fallback substituted for existing eligible artwork.', 'No remote cover exists in this current public set. Future remote assets must not be downloaded automatically.', 'Existing cover metadata is not a new legal or editorial approval.'],
    artifacts: Object.entries(output).map(([filename, text]) => ({ path: filename, sha256: sha(text), bytes: Buffer.byteLength(text) })), releaseReady: false,
  };
  if (sha(read(manifestPath)) !== sha(manifestBytes)) throw Error('Base manifest changed during projection');
  for (const [filename, text] of Object.entries({ ...output, 'audit.json': json(audit) })) fs.writeFileSync(path.join(target, filename), text);
  console.log(JSON.stringify({ directory: target, sourceCommit, canonicalSourcePins: sourcePins.length, additions: additions.length, proposedManifestSha256: sha(proposedBytes), additionalBytes: audit.sizes.additionalBytes, allCoverBytes: audit.sizes.allCoverBytes, remote: remote.length }));
}
main().catch(error => { console.error(String(error?.message || error).replace(/data:text[^\s]+/gu, '[in-memory-module]').slice(0, 1000)); process.exitCode = 1; });
