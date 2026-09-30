import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Read-only inventory audit. Declared checksums live in the authored inventory;
// this command compares actual bytes and never updates those declarations.
if (process.argv.length !== 2) throw Error('Usage: node scripts/mobile/verify-booky-dialogue-drafts.mjs');
const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'ts', contents: `
  export { BOOKY_DIALOGUE_DRAFTS, BOOKY_DIALOGUE_DRAFT_INVENTORY } from './src/host/bookyDialogueDrafts';
  export { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum } from './src/host/bookyDialogueRegistry';
  export { getBookySupport, BOOKY_SUPPORT_COPY_METADATA } from './src/host/bookySupport';
` }, bundle: true, write: false, metafile: true, format: 'esm', platform: 'node', target: 'node24', logLevel: 'silent' });
const api = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'));
const { BOOKY_DIALOGUE_DRAFTS: records, BOOKY_DIALOGUE_DRAFT_INVENTORY: inventory } = api;
const findings = [];
const check = (ok, code, record = null) => { if (!ok) findings.push({ code, ...(record ? { record } : {}) }); };
const expectedStates = ['books-error', 'books-error-restart', 'books-loading', 'countries-error', 'countries-loading', 'network-unknown', 'offline'];
const ready = { connectivity: 'online', screen: 'globe', countryStatus: 'ready', booksStatus: 'ready' };
const contexts = {
  'countries-error': { countryStatus: 'error' }, 'books-error': { screen: 'collection', booksStatus: 'error' },
  'books-error-restart': { screen: 'collection', booksStatus: 'error', booksReloadRequired: true },
  'countries-loading': { countryStatus: 'loading' }, 'books-loading': { screen: 'collection', booksStatus: 'loading' },
  offline: { connectivity: 'offline' }, 'network-unknown': { connectivity: 'unknown' },
};
const sourceBytes = await fs.readFile(path.join(root, inventory.source.sourcePath));
const source = sourceBytes.toString('utf8');
const actualSourceSha256 = sha256(source.replaceAll('\r\n', '\n'));
check(inventory.schemaVersion === 1 && inventory.recordCount === 14 && records.length === 14, 'INVENTORY_SIZE');
check(inventory.status === 'draft' && inventory.humanReviewed === false && inventory.childApproved === false
  && inventory.narrationApproved === false && inventory.releaseReady === false, 'NO_APPROVAL');
check(api.BOOKY_SUPPORT_COPY_METADATA.status === 'draft' && api.BOOKY_SUPPORT_COPY_METADATA.releaseReady === false, 'EXISTING_HELP_REMAINS_DRAFT');
check(actualSourceSha256 === inventory.source.sourceSha256, 'SOURCE_BYTES_CHANGED');
check(inventory.source.sourcePath === 'src/host/bookySupport.ts' && inventory.source.sourceVersion === 2
  && inventory.source.sourceCommit === 'aba461a774c125f9c38ea4c10aac9b3cc8024d2d', 'SOURCE_PROVENANCE');
check(inventory.source.sourceHashEncoding === 'sha256:utf8:lf'
  && inventory.source.copyHashEncoding === 'sha256:utf8:JSON.stringify({title,body})', 'CHECKSUM_ENCODING');
const registry = api.createBookyDialogueRegistry(records, { canonicalEntityIds: [], approvedReviews: [] });
check(registry.size === 14 && registry.rejections.length === 0, 'REGISTRY_STRUCTURE');
const audited = [];
for (const record of records) {
  const { payload, review } = record, key = payload.id + ':' + payload.locale;
  const existing = Object.hasOwn(contexts, payload.context) ? api.getBookySupport({ ...ready, ...contexts[payload.context] }) : null;
  const runtimeContext = payload.context === 'books-error-restart' ? 'books-error' : payload.context;
  const runtimeTextMatches = !!existing && existing.id === runtimeContext
    && payload.copy.title === existing.title[payload.locale] && payload.copy.body === existing.body[payload.locale];
  const copySha256 = sha256(JSON.stringify({ title: payload.copy.title, body: payload.copy.body }));
  const contentChecksumMatches = api.getBookyDialogueContentChecksum(payload) === review.contentChecksum;
  const recordChecksumMatches = api.getBookyDialogueChecksum({ payload, review }) === record.checksum;
  check(runtimeTextMatches, 'RUNTIME_TEXT_CHANGED', key);
  check(payload.context !== 'books-error-restart' || existing?.restart === 'books' && existing.retry === null, 'RESTART_SCOPE', key);
  check(payload.copy.caption === payload.copy.title && payload.copy.reduced === payload.copy.title, 'EXTRA_COPY_CHANGED', key);
  check(payload.id === 'support.' + payload.context && expectedStates.includes(payload.context), 'UNKNOWN_CONTEXT', key);
  check(payload.version === 1 && payload.audience === 'adult' && payload.ageRange.min === 18 && payload.ageRange.max === 120
    && payload.readingLevel === 'plain' && payload.claimKind === 'interface-guidance', 'DRAFT_SCOPE', key);
  check(payload.intent === (payload.context === 'books-error-restart' || payload.context.endsWith('-error') ? 'load-error' : payload.context.endsWith('-loading') ? 'loading-help' : 'offline-help')
    && JSON.stringify(payload.screens) === JSON.stringify(payload.context.startsWith('books-') ? ['collection'] : ['globe', 'collection']), 'CONTEXT_SCOPE', key);
  check(payload.entityIds.length === 0 && payload.factualSources.length === 0 && payload.prohibitedTags.length === 0
    && payload.narration === null, 'UNAPPROVED_CONTENT', key);
  check(review.status === 'draft' && review.reviewer === null && review.reviewedAt === null, 'DRAFT_REVIEW_STATE', key);
  check(payload.provenance.kind === 'existing-interface-copy' && payload.provenance.sourcePath === inventory.source.sourcePath
    && payload.provenance.sourceVersion === inventory.source.sourceVersion
    && payload.provenance.sourceRef === inventory.source.sourceCommit + ':' + payload.context + ':' + payload.locale
    && payload.provenance.sourceSha256 === inventory.source.sourceSha256, 'RECORD_PROVENANCE', key);
  check(payload.provenance.copySha256 === copySha256, 'COPY_CHECKSUM', key);
  check(contentChecksumMatches, 'PAYLOAD_CHECKSUM', key); check(recordChecksumMatches, 'RECORD_CHECKSUM', key);
  const request = { id: payload.id, locale: payload.locale, audience: 'adult', age: 30, readingLevel: 'plain', intent: payload.intent,
    screen: payload.screens[0], context: payload.context, entityIds: [], now: '2026-09-20T00:00:00.000Z' };
  const reviewedDialogueAvailable = registry.resolve(request) !== null;
  check(!reviewedDialogueAvailable, 'DRAFT_RESOLVED', key);
  const childDialogueAvailable = registry.resolve({ ...request, audience: 'child', age: 10 }) !== null;
  check(!childDialogueAvailable, 'CHILD_DIALOGUE_RESOLVED', key);
  audited.push({ id: payload.id, locale: payload.locale, version: payload.version, status: review.status,
    sourceSha256: payload.provenance.sourceSha256, copySha256, contentChecksumMatches, recordChecksumMatches,
    runtimeTextMatches, reviewedDialogueAvailable, childDialogueAvailable });
}
for (const context of expectedStates) {
  const locales = records.filter(record => record.payload.context === context).map(record => record.payload.locale).sort();
  check(JSON.stringify(locales) === JSON.stringify(['en', 'ru']), 'LOCALE_PARITY', context);
}
check(new Set(records.map(record => record.payload.id + ':' + record.payload.locale)).size === 14, 'DUPLICATE_LOCALE_RECORD');
const sourcePaths = [...new Set([...Object.keys(built.metafile.inputs).filter(file => !file.startsWith('<')),
  'scripts/mobile/verify-booky-dialogue-drafts.mjs'])].sort();
const sourceInputs = await Promise.all(sourcePaths.map(async file => ({ path: file.replaceAll('\\', '/'),
  sha256: sha256(await fs.readFile(path.resolve(root, file))) })));
const result = { schemaVersion: 1, kind: 'booky-dialogue-draft-inventory', pass: findings.length === 0,
  recordCount: records.length, stateCount: expectedStates.length, locales: ['ru', 'en'], draftCount: records.filter(record => record.review.status === 'draft').length,
  notReviewedCount: records.filter(record => record.review.status === 'draft').length,
  approvedCount: records.filter(record => record.review.status === 'approved').length,
  availableAdultCount: audited.filter(record => record.reviewedDialogueAvailable).length,
  availableChildCount: audited.filter(record => record.childDialogueAvailable).length,
  reviewedDialogueAvailable: audited.filter(record => record.reviewedDialogueAvailable).length,
  source: inventory.source, actualSourceSha256,
  sourceFile: { path: inventory.source.sourcePath, sha256: sha256(sourceBytes), normalizedSha256: actualSourceSha256 },
  sourceInputs, records: audited, errors: findings,
  changesExistingHelp: false, narrationEnabled: false, childApproved: false, humanReviewed: false,
  factualEditorialEvidenceClaimed: false, stageAccepted: false, releaseReady: false };
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!result.pass) process.exitCode = 1;
