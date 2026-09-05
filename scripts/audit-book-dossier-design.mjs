import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
export { bookDossierFixture } from './scripts/lib/book-dossier-fixtures';
export * from './src/books/bookDossierWorkflow';
export { compileBookDossierReviewVariantBank } from './src/books/bookDossierDelivery';
export { bookDossierVariantId } from './src/books/bookDossierDesign';
export { measureBookDossierDesign } from './apps/admin/app/(dashboard)/library/dossiers/measureDesign';
` }, bundle: true, write: false, format: "iife", globalName: "DesignProbe", platform: "browser", target: "es2020", plugins: [{ name: "existing-local-font-bindings", setup(plugin) {
  plugin.onResolve({ filter: /^@\/components\/EditorialPreviewFonts$/ }, () => ({ path: "local-fonts", namespace: "font-proof" }));
  plugin.onLoad({ filter: /.*/, namespace: "font-proof" }, () => ({ contents: `export const editorialPreviewFontFamilies={serif:'"Source Serif 4 Local"',sans:'"Source Sans 3 Local"'};`, loader: "js" }));
} }] });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
  await page.goto(process.argv[2] || "http://127.0.0.1:4185/", { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const api = globalThis.DesignProbe;
    const actor = { id: "11111111-1111-4111-8111-111111111111", role: "owner" };
    const context = record => ({ actor, now: Date.now(), expectedRevision: record?.revision || 0 });
    const input = api.bookDossierFixture();
    input.sections = input.sections.map(section => ({ ...section, title: "Test" }));
    input.blocks = input.blocks.map(block => ({ ...block, title: "Test", paragraphs: block.paragraphs.length ? ["One synthetic sentence."] : [],
      items: block.items.map(item => ({ ...item, label: "Label", value: "Value" })) }));
    input.sources = input.sources.map(source => ({ ...source, provider: "Test", title: "Test source", attribution: "Test" }));
    let response = await api.saveBookDossierDraft(input, null, context(null));
    if (response.issues.length) throw new Error(JSON.stringify(response.issues));
    let record = response.record;
    for (const stage of ["facts", "rights", "editorial"]) {
      response = await api.reviewBookDossier(record, stage, "APPROVED", true, context(record));
      if (response.issues.length) throw new Error(JSON.stringify(response.issues));
      record = response.record;
    }
    const result = await api.compileBookDossierReviewVariantBank(record, { now: Date.now() });
    if (!result.bank) throw new Error(JSON.stringify(result.issues));
    const variants = result.bank.variants.map(variant => ({ id: api.bookDossierVariantId(variant.mode, variant.revealSpoilers, variant.reachedItemIds), document: variant.document }));
    const measured = await api.measureBookDossierDesign(record, variants);
    if (!measured.proof) throw new Error(JSON.stringify(measured.issues));
    const bad = structuredClone(variants);
    bad[0].document.pages[1].paragraphs = ["x".repeat(200)];
    const rejected = await api.measureBookDossierDesign(record, bad);
    if (rejected.proof || !rejected.issues.length) throw new Error("Unbreakable overflow was not rejected");
    return { variantCount: measured.proof.variantPages.length, pages: measured.proof.variantPages.map(variant => variant.pageCount),
      fontVersion: measured.proof.fontVersion, layoutVersion: measured.proof.layoutVersion, overflowRejected: true,
      proofBoundToContent: measured.proof.contentChecksum === record.contentChecksum };
  });
  const report = { scope: "Actual CMS measureBookDossierDesign function in Chrome with synthetic private dossier/review fixture. Local Source WOFF2 faces use their public aliases; Next bundles the same bytes under its own aliases. This verifies measurement/layout, not deployed CMS authentication or a real editorial approval.", ...result, generatedAt: new Date().toISOString() };
  const out = path.resolve("reports/bookshelf-owner-evidence/dossier-browser-design.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally { await browser.close(); }
