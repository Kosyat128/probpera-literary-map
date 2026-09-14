import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  createPublicLocaleReviewSnapshot,
  evaluatePublicLocaleReview,
  publicLocaleReviewDigest,
} from "./public-locale-review.mjs";

// Every review and body below is synthetic test data. These identities, pins
// and dates are not approvals for the actual site's text or release artifacts.
const builtHtml = '<html><body><div id="root">Synthetic input</div></body></html>';
const file = (path, text) => ({
  path, bytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex"),
});
function fixture() {
  const snapshot = createPublicLocaleReviewSnapshot({
    builtHtml,
    assets: [file("assets/main.js", "synthetic runtime"), file("assets/main.css", "synthetic CSS")],
    content: [file("catalog/условный-текст.json", "synthetic content")],
    copy: [file("review-inputs/generator-copy.json", "synthetic fixed metadata copy")],
  });
  const identity = role => ({
    status: "approved", identity: `Synthetic ${role}; not a real approval`,
    reviewedAt: "2026-09-08", evidenceRef: `synthetic-fixture/${role}`,
  });
  const review = {
    schemaVersion: 1, contract: "public-locale-review-v1", inputs: structuredClone(snapshot),
    inputsSha256: publicLocaleReviewDigest(snapshot), ownerReview: identity("owner"),
    locales: {
      ru: {
        editorialReview: identity("ru-editor"),
        body: { heading: "Условная литературная страница", paragraphs: ["Синтетический текст для проверки структуры."],
          navigationLabel: "Условная навигация", links: [{ path: "/ru/#atlas", label: "Условный глобус" }] },
      },
      en: {
        editorialReview: identity("en-editor"),
        body: { heading: "Synthetic literary page", paragraphs: ["Synthetic text for a structural contract test."],
          navigationLabel: "Synthetic navigation", links: [{ path: "/en/#atlas", label: "Synthetic globe" }] },
      },
    },
  };
  return { snapshot, review, provisionedReviewSha256: publicLocaleReviewDigest(review) };
}

function rejectedReview(mutate) {
  const input = fixture();
  mutate(input.review);
  // Re-pinning synthetic data exercises structural rejection independently of
  // the trust boundary. Real tooling must never automatically mint this pin.
  input.provisionedReviewSha256 = publicLocaleReviewDigest(input.review);
  return evaluatePublicLocaleReview(input);
}

describe("source-bound public locale review consumption", () => {
  it("accepts explicitly provisioned complete synthetic review only for these exact public pages", () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = evaluatePublicLocaleReview(input);
    expect(result).toMatchObject({
      scope: "public-localized-homepages-only", indexingAllowed: true, robots: "index,follow",
      reviewerAuthentication: "not-performed", provision: "independent-review-digest-pin",
      inputsSha256: input.review.inputsSha256, reviewSha256: input.provisionedReviewSha256,
      diagnostics: [], bodies: { ru: input.review.locales.ru.body, en: input.review.locales.en.body },
    });
    expect(result).not.toHaveProperty("releaseReady");
    expect(input).toEqual(before);
    result.bodies.en.paragraphs.push("Caller-owned output cannot alter reviewed input.");
    expect(input).toEqual(before);
  });

  it("defaults to noindex with diagnostic output instead of throwing the build", () => {
    const { snapshot } = fixture();
    expect(evaluatePublicLocaleReview({ snapshot })).toMatchObject({
      indexingAllowed: false, robots: "noindex,follow", bodies: null, diagnostics: ["review-missing"],
    });
    expect(evaluatePublicLocaleReview()).toMatchObject({ indexingAllowed: false, bodies: null });
  });

  it.each([undefined, true, "true", "", "f".repeat(64)])("rejects absent, boolean or mismatching provision %j", provisionedReviewSha256 => {
    const input = fixture();
    const result = evaluatePublicLocaleReview({ ...input, provisionedReviewSha256 });
    expect(result.indexingAllowed).toBe(false);
    expect(result.bodies).toBeNull();
    expect(result.robots).toBe("noindex,follow");
  });

  it("does not accept a review's own approval flag or expected digest as authorization", () => {
    const input = fixture();
    input.review.approved = true;
    input.review.provisionedReviewSha256 = input.provisionedReviewSha256;
    expect(evaluatePublicLocaleReview({ snapshot: input.snapshot, review: input.review }).diagnostics)
      .toEqual(["independent-review-pin-missing"]);
  });

  it("invalidates any reviewed body correction until an independent updated pin is supplied", () => {
    const input = fixture();
    input.review.locales.en.body.paragraphs[0] = "Changed synthetic prose.";
    expect(evaluatePublicLocaleReview(input)).toMatchObject({
      indexingAllowed: false, bodies: null, diagnostics: ["review-pin-mismatch"],
    });
  });

  it.each(["builtHtml", "assets", "content", "copy"])("rejects stale %s bytes even though the original review remains pinned", group => {
    const input = fixture();
    const entry = group === "builtHtml" ? input.snapshot.builtHtml : input.snapshot[group][0];
    entry.sha256 = "a".repeat(64);
    entry.bytes += 1;
    expect(evaluatePublicLocaleReview(input)).toMatchObject({
      indexingAllowed: false, bodies: null, diagnostics: ["review-inputs-stale"],
    });
  });

  it("hashes exact UTF-8 HTML bytes and all independently named files", () => {
    const input = fixture();
    const withWhitespace = createPublicLocaleReviewSnapshot({ ...input.snapshot, builtHtml: `${builtHtml}\n` });
    expect(withWhitespace.builtHtml.sha256).not.toBe(input.snapshot.builtHtml.sha256);
    expect(withWhitespace.builtHtml.bytes).toBe(input.snapshot.builtHtml.bytes + 1);
    const extra = structuredClone(input.snapshot);
    extra.content.push(file("catalog/new.json", "new synthetic catalog bytes"));
    expect(evaluatePublicLocaleReview({ ...input, snapshot: extra }).diagnostics).toEqual(["review-inputs-stale"]);
  });

  it("canonicalizes object key and inventory input order without weakening exact path/content binding", () => {
    const input = fixture();
    const reversed = Object.fromEntries(Object.entries(input.review).reverse());
    expect(publicLocaleReviewDigest(reversed)).toBe(input.provisionedReviewSha256);
    const snapshot = createPublicLocaleReviewSnapshot({ ...input.snapshot, builtHtml, assets: [...input.snapshot.assets].reverse() });
    expect(snapshot).toEqual(input.snapshot);
    const renamed = structuredClone(input.snapshot);
    renamed.content[0].path = "catalog/другой-текст.json";
    expect(evaluatePublicLocaleReview({ ...input, snapshot: renamed }).diagnostics).toEqual(["review-inputs-stale"]);
  });

  it.each([
    ["owner rejected", review => { review.ownerReview.status = "rejected"; }],
    ["English pending", review => { review.locales.en.editorialReview.status = "pending"; }],
    ["missing Russian", review => { delete review.locales.ru; }],
    ["missing owner identity", review => { review.ownerReview.identity = ""; }],
    ["missing English evidence", review => { review.locales.en.editorialReview.evidenceRef = ""; }],
    ["impossible date", review => { review.ownerReview.reviewedAt = "2026-02-30"; }],
    ["unknown review schema", review => { review.schemaVersion = 2; }],
    ["self-authentication claim", review => { review.authenticated = true; }],
    ["mismatching recorded input digest", review => { review.inputsSha256 = "b".repeat(64); }],
  ])("fails closed for %s even with a separately supplied synthetic pin", (_reason, mutate) => {
    const result = rejectedReview(mutate);
    expect(result).toMatchObject({ indexingAllowed: false, robots: "noindex,follow", bodies: null });
    expect(result.diagnostics).toHaveLength(1);
  });

  it.each(["2026-09-08T10:20:30Z", "2026-09-08T10:20:30.123Z"])("accepts a precise UTC review date %s", reviewedAt => {
    const input = fixture();
    input.review.ownerReview.reviewedAt = reviewedAt;
    input.provisionedReviewSha256 = publicLocaleReviewDigest(input.review);
    expect(evaluatePublicLocaleReview(input).indexingAllowed).toBe(true);
  });

  it.each([
    ["arbitrary HTML", review => { review.locales.en.body.paragraphs = ["<script>unsafe()</script>"]; }],
    ["external link", review => { review.locales.en.body.links[0].path = "https://elsewhere.invalid/"; }],
    ["cross-locale link", review => { review.locales.en.body.links[0].path = "/ru/#atlas"; }],
    ["unapproved canonical route", review => { review.locales.en.body.links[0].path = "/en/store/"; }],
    ["URL traversal", review => { review.locales.en.body.links[0].path = "/en/../ru/"; }],
    ["event-handler field", review => { review.locales.en.body.links[0].onclick = "unsafe()"; }],
    ["mixed critical English text", review => { review.locales.en.body.heading = "Synthetic страница"; }],
    ["empty Russian body", review => { review.locales.ru.body.paragraphs = []; }],
    ["unbounded body", review => { review.locales.en.body.paragraphs = ["a".repeat(2001)]; }],
    ["duplicate navigation target", review => { review.locales.en.body.links.push({ ...review.locales.en.body.links[0] }); }],
  ])("rejects %s as body input without returning a partially accepted locale", (_reason, mutate) => {
    expect(rejectedReview(mutate)).toMatchObject({ indexingAllowed: false, bodies: null, robots: "noindex,follow" });
  });

  it.each(["../outside.json", "C:/outside.json", "/outside.json", "assets\\main.js", "assets/%2e%2e/x.js", "assets/CON.js", "assets/file."])("rejects unsafe artifact path %s", path => {
    const input = fixture();
    input.snapshot.assets[0].path = path;
    expect(evaluatePublicLocaleReview(input).indexingAllowed).toBe(false);
  });

  it("rejects duplicate Windows paths and an incomplete actual input inventory", () => {
    const input = fixture();
    input.snapshot.content.push({ ...input.snapshot.assets[0], path: input.snapshot.assets[0].path.toUpperCase() });
    expect(evaluatePublicLocaleReview(input).diagnostics).toEqual(["duplicate-input-path"]);
    input.snapshot.content = [];
    expect(evaluatePublicLocaleReview(input).diagnostics).toEqual(["invalid-content-inventory"]);
  });

  it("fails closed for bounded malformed JSON and never invokes getters in review input", () => {
    const input = fixture();
    const getHeading = vi.fn(() => "Synthetic heading");
    Object.defineProperty(input.review.locales.en.body, "heading", { enumerable: true, get: getHeading });
    expect(evaluatePublicLocaleReview(input).diagnostics).toEqual(["invalid-review-accessor"]);
    expect(getHeading).not.toHaveBeenCalled();
    const sparse = Array(2);
    expect(evaluatePublicLocaleReview({ ...fixture(), review: sparse }).indexingAllowed).toBe(false);
    const cycle = {}; cycle.self = cycle;
    expect(evaluatePublicLocaleReview({ ...fixture(), review: cycle }).diagnostics).toEqual(["review-structure-limit"]);
  });
});
