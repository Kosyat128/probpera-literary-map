import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';

// Read-only audit of fixed drafts; this command never authors or refreshes
// declarations and never imports the React/renderer/artwork UI graph.
if (process.argv.length !== 2) throw Error('Usage: node scripts/mobile/verify-booky-navigation-drafts.mjs');
const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'ts', contents: `
  export { BOOKY_NAVIGATION_DRAFTS, BOOKY_NAVIGATION_DRAFT_INVENTORY } from './src/host/bookyNavigationDrafts';
  export { BOOKY_DIALOGUE_DRAFTS } from './src/host/bookyDialogueDrafts';
  export { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum } from './src/host/bookyDialogueRegistry';
  export { PLANET_MASCOT_ROUTES } from './src/host/planetMascotRoutes';
` }, bundle: true, write: false, metafile: true, format: 'esm', platform: 'node', target: 'node24', logLevel: 'silent' });
const api = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'));
const { BOOKY_NAVIGATION_DRAFTS: records, BOOKY_NAVIGATION_DRAFT_INVENTORY: inventory } = api;
const findings = [];
const check = (ok, code, record = null) => { if (!ok) findings.push({ code, ...(record ? { record } : {}) }); };
// Fixed per-source identities; this validator never authors a new binding.
const expectedSources = {
  "src/host/planetMascotRoutes.ts": {
    "sourceCommit": "798c072e61176cc191ceaacff0e18f1b6622dbd2",
    "sourceVersion": 2,
    "sourceSha256": "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360"
  },
  "src/host/PlanetMascotControls.tsx": {
    "sourceCommit": "e23e58109dbe81f181f6440725ad71157b387e69",
    "sourceVersion": 4,
    "sourceSha256": "4c2de3c256f178f7ed308d3a30a78be6a2e547af7f6b1b58a4c717f3ffcffe0d"
  }
};
const expectedPaths = ['src/host/planetMascotRoutes.ts', 'src/host/PlanetMascotControls.tsx'];
const expectedRoutes = [
  { id: 'overview', version: 1, stepIds: ['search', 'country', 'collection', 'appearance'] },
  { id: 'country-to-book', version: 1, stepIds: ['choose-country', 'choose-writer', 'open-books'] },
];
const expectedContexts = ['globe', 'country', 'writer', 'collection'];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(inventory.schemaVersion === 1 && inventory.recordCount === 22 && records.length === 22
  && inventory.navigationRecordCount === 14 && inventory.contextualRecordCount === 8, 'INVENTORY_SIZE');
check(inventory.status === 'draft' && inventory.humanReviewed === false && inventory.childApproved === false
  && inventory.narrationApproved === false && inventory.releaseReady === false, 'NO_APPROVAL');
check(equal(inventory.routes, expectedRoutes) && equal(inventory.contexts, expectedContexts), 'DECLARED_CONTEXTS');
check(equal(Object.entries(api.PLANET_MASCOT_ROUTES).map(([id, route]) => ({ id, version: route.version,
  stepIds: route.steps.map(step => step.id) })), expectedRoutes), 'CURRENT_ROUTE_VERSION_OR_STEPS_CHANGED');
check(equal(inventory.sources.map(source => source.sourcePath), expectedPaths), 'SOURCE_PATHS');
const sourceFiles = [], sourceText = new Map();
for (const sourcePath of expectedPaths) {
  const bytes = await fs.readFile(path.join(root, sourcePath));
  const text = bytes.toString('utf8'), normalizedSha256 = sha256(text.replaceAll('\r\n', '\n'));
  const declared = inventory.sources.find(source => source.sourcePath === sourcePath);
  const expectedSource = expectedSources[sourcePath];
  check(!!declared && declared.sourceCommit === expectedSource.sourceCommit
    && declared.sourceVersion === expectedSource.sourceVersion && declared.sourceSha256 === expectedSource.sourceSha256, 'SOURCE_PROVENANCE', sourcePath);
  check(declared?.sourceSha256 === normalizedSha256 && normalizedSha256 === expectedSource.sourceSha256, 'SOURCE_BYTES_CHANGED', sourcePath);
  check(declared?.sourceHashEncoding === 'sha256:utf8:lf'
    && declared?.copyHashEncoding === 'sha256:utf8:JSON.stringify({title,body})', 'CHECKSUM_ENCODING', sourcePath);
  sourceFiles.push({ path: sourcePath, sha256: sha256(bytes), normalizedSha256 });
  sourceText.set(sourcePath, text);
}

// Only accept the current literal bilingual declarations. Ambiguous, computed
// or differently shaped source copy fails closed instead of being evaluated.
function contextualCopy(text) {
  const tree = ts.createSourceFile(expectedPaths[1], text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (tree.parseDiagnostics.length) throw Error('Source parse error');
  const declaration = name => {
    const found = [];
    const visit = node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    if (found.length !== 1 || !found[0].initializer) throw Error('Ambiguous declaration');
    return found[0].initializer;
  };
  const bilingual = expression => {
    if (!ts.isConditionalExpression(expression) || !ts.isIdentifier(expression.condition) || expression.condition.text !== 'ru'
      || !ts.isStringLiteral(expression.whenTrue) || !ts.isStringLiteral(expression.whenFalse)) throw Error('Nonliteral copy');
    return { ru: expression.whenTrue.text, en: expression.whenFalse.text };
  };
  const title = bilingual(declaration('name')), helpTip = declaration('helpTip');
  if (!ts.isElementAccessExpression(helpTip) || !ts.isObjectLiteralExpression(helpTip.expression)
    || !helpTip.argumentExpression || !ts.isIdentifier(helpTip.argumentExpression) || helpTip.argumentExpression.text !== 'tipKind') {
    throw Error('Changed contextual shape');
  }
  const tips = helpTip.expression.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) throw Error('Nonliteral context');
    return { context: property.name.text, body: bilingual(property.initializer) };
  });
  if (!equal(tips.map(tip => tip.context), expectedContexts)) throw Error('Changed contextual inventory');
  return { title, tips };
}
let contextual = null;
try { contextual = contextualCopy(sourceText.get(expectedPaths[1])); }
catch { check(false, 'CONTEXTUAL_SOURCE_SHAPE_CHANGED'); }
const expected = new Map();
for (const [routeId, route] of Object.entries(api.PLANET_MASCOT_ROUTES)) for (const step of route.steps) {
  const id = `navigation.${routeId}.${step.id}`;
  expected.set(id, { id, version: expectedSources[expectedPaths[0]].sourceVersion, context: `tour:${routeId}:${step.id}`,
    // Copy is visible before its target is reached. requiredScreen gates the
    // existing controller's advancement; it does not gate instruction display.
    screens: ['globe', 'collection'], requiredScreen: step.requiredScreen,
    title: step.title, body: step.body, sourcePath: expectedPaths[0],
    sourceSelector: `PLANET_MASCOT_ROUTES.${routeId}.steps.${step.id}` });
}
if (contextual) for (const { context, body } of contextual.tips) {
  const id = 'guidance.' + context;
  expected.set(id, { id, version: expectedSources[expectedPaths[1]].sourceVersion, context: 'help:' + context,
    screens: [context === 'collection' ? 'collection' : 'globe'], requiredScreen: null,
    title: contextual.title, body, sourcePath: expectedPaths[1],
    sourceSelector: 'PlanetMascotControls.name+helpTip.' + context });
}
const combined = [...api.BOOKY_DIALOGUE_DRAFTS, ...records];
const registry = api.createBookyDialogueRegistry(combined, { canonicalEntityIds: [], approvedReviews: [] });
check(combined.length === 34 && registry.size === 34 && registry.rejections.length === 0, 'COMBINED_REGISTRY_STRUCTURE');
const request = payload => ({ id: payload.id, locale: payload.locale, audience: 'adult', age: 30, readingLevel: payload.readingLevel,
  intent: payload.intent, screen: payload.screens[0], context: payload.context, entityIds: [], now: '2026-09-20T00:00:00.000Z' });
const adultAvailable = record => record.payload.screens.some(screen => registry.resolve({ ...request(record.payload), screen }) !== null);
const childAvailable = record => record.payload.screens.some(screen => registry.resolve({ ...request(record.payload), screen, audience: 'child', age: 10 }) !== null);
const audited = [];
for (const record of records) {
  const { payload, review } = record, key = payload.id + ':' + payload.locale;
  const existing = expected.get(payload.id), source = inventory.sources.find(value => value.sourcePath === existing?.sourcePath);
  const runtimeTextMatches = !!existing && payload.copy.title === existing.title[payload.locale]
    && payload.copy.body === existing.body[payload.locale];
  const copySha256 = sha256(JSON.stringify({ title: payload.copy.title, body: payload.copy.body }));
  const contentChecksumMatches = api.getBookyDialogueContentChecksum(payload) === review.contentChecksum;
  const recordChecksumMatches = api.getBookyDialogueChecksum({ payload, review }) === record.checksum;
  check(runtimeTextMatches, 'RUNTIME_TEXT_CHANGED', key);
  check(payload.copy.caption === payload.copy.title && payload.copy.reduced === payload.copy.title, 'EXTRA_COPY_CHANGED', key);
  check(!!existing && payload.version === existing.version && payload.context === existing.context
    && equal(payload.screens, existing.screens), 'CONTEXT_SCOPE', key);
  check(payload.audience === 'adult' && payload.ageRange.min === 18 && payload.ageRange.max === 120
    && payload.readingLevel === 'plain' && payload.intent === 'navigation' && payload.claimKind === 'interface-guidance', 'DRAFT_SCOPE', key);
  check(payload.entityIds.length === 0 && payload.factualSources.length === 0 && payload.prohibitedTags.length === 0
    && payload.narration === null, 'UNAPPROVED_CONTENT', key);
  check(review.status === 'draft' && review.reviewer === null && review.reviewedAt === null, 'DRAFT_REVIEW_STATE', key);
  check(!!source && payload.provenance.kind === 'existing-interface-copy' && payload.provenance.sourcePath === source.sourcePath
    && payload.provenance.sourceVersion === source.sourceVersion && payload.version === expectedSources[source.sourcePath].sourceVersion
    && payload.provenance.sourceSha256 === source.sourceSha256
    && payload.provenance.sourceRef === `${expectedSources[source.sourcePath].sourceCommit}:${existing.sourceSelector}:${payload.locale}`, 'RECORD_PROVENANCE', key);
  check(payload.provenance.copySha256 === copySha256, 'COPY_CHECKSUM', key);
  check(contentChecksumMatches, 'PAYLOAD_CHECKSUM', key); check(recordChecksumMatches, 'RECORD_CHECKSUM', key);
  const reviewedDialogueAvailable = adultAvailable(record), childDialogueAvailable = childAvailable(record);
  check(!reviewedDialogueAvailable, 'DRAFT_RESOLVED', key); check(!childDialogueAvailable, 'CHILD_DIALOGUE_RESOLVED', key);
  audited.push({ id: payload.id, locale: payload.locale, version: payload.version, status: review.status,
    context: payload.context, displayScreens: payload.screens, targetRequiredScreen: existing?.requiredScreen ?? null,
    sourceCommit: source?.sourceCommit ?? null, sourceVersion: payload.provenance.sourceVersion,
    sourceSha256: payload.provenance.sourceSha256, copySha256, contentChecksumMatches, recordChecksumMatches,
    runtimeTextMatches, reviewedDialogueAvailable, childDialogueAvailable });
}
for (const id of expected.keys()) check(equal(records.filter(record => record.payload.id === id)
  .map(record => record.payload.locale).sort(), ['en', 'ru']), 'LOCALE_PARITY', id);
check(expected.size === 11 && new Set(records.map(record => record.payload.id + ':' + record.payload.locale)).size === 22, 'UNIQUE_CONTEXT_COUNT');
check(combined.every(record => record.review.status === 'draft' && record.review.reviewer === null && record.review.reviewedAt === null), 'COMBINED_NO_APPROVAL');
const availableAdultCount = combined.filter(adultAvailable).length, availableChildCount = combined.filter(childAvailable).length;
check(availableAdultCount === 0 && availableChildCount === 0, 'COMBINED_DIALOGUE_UNAVAILABLE');
const parserPath = path.relative(root, fileURLToPath(import.meta.resolve('typescript')));
const sourcePaths = [...new Set([...Object.keys(built.metafile.inputs).filter(file => !file.startsWith('<')),
  ...expectedPaths, 'scripts/mobile/verify-booky-navigation-drafts.mjs', parserPath])].sort();
const sourceInputs = await Promise.all(sourcePaths.map(async file => ({ path: file.replaceAll('\\', '/'),
  sha256: sha256(await fs.readFile(path.resolve(root, file))) })));
const result = { schemaVersion: 1, kind: 'booky-navigation-draft-inventory', pass: findings.length === 0,
  recordCount: records.length, navigationRecordCount: records.filter(record => record.payload.id.startsWith('navigation.')).length,
  contextualRecordCount: records.filter(record => record.payload.id.startsWith('guidance.')).length,
  combinedRecordCount: combined.length, stateCount: expected.size, locales: ['ru', 'en'],
  draftCount: records.filter(record => record.review.status === 'draft').length,
  notReviewedCount: records.filter(record => record.review.status === 'draft').length,
  combinedDraftCount: combined.filter(record => record.review.status === 'draft').length,
  approvedCount: combined.filter(record => record.review.status === 'approved').length,
  availableAdultCount, availableChildCount, sources: inventory.sources, sourceFiles, sourceInputs, records: audited, errors: findings,
  changesExistingHelp: false, narrationEnabled: false, childApproved: false, humanReviewed: false,
  factualEditorialEvidenceClaimed: false, stageAccepted: false, releaseReady: false };
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!result.pass) process.exitCode = 1;
