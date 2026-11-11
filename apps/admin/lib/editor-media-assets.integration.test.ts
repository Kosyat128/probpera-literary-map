import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { encodeEditorMediaCursor, parseEditorMediaAssetsPage, parseEditorMediaCursor } from "./editor-media-assets-contract";

const require = createRequire(import.meta.url);
const { createMediaRouteRuntime, seedRows } = require("./fixtures/editor-media-dialog-runtime.cjs");
const dependencyRoot = resolve(process.cwd());
const runtime = (options = {}) => createMediaRouteRuntime({ dependencyRoot, ...options });
const request = (query = "") => new Request(`http://127.0.0.1/api/media/assets${query}`);

describe("actual editor media GET through installed SDK", () => {
  it("returns 60 visible assets with one bounded lookahead and an exact last-visible cursor", async () => {
    const view = runtime();
    const response = await view.handle(request());
    const page = await response.json();
    expect(response.status).toBe(200);
    expect(parseEditorMediaAssetsPage(page)).not.toBeNull();
    expect(page.assets).toHaveLength(60);
    expect(parseEditorMediaCursor(page.nextCursor)).toEqual({ createdAt: view.rows[59].created_at, id: view.rows[59].id });
    expect(view.wire[0].responseIds).toHaveLength(61);
    expect(new URLSearchParams(view.wire[0].query).get("limit")).toBe("61");
    expect(new URLSearchParams(view.wire[0].query).get("order")).toBe("created_at.desc,id.desc");
    expect(view.protocolErrors).toEqual([]);
  });

  it("reaches every one of 137 permitted assets without duplicates or an unbounded read", async () => {
    const view = runtime(), ids: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await view.handle(request(cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
      const page = parseEditorMediaAssetsPage(await response.json());
      expect(response.status).toBe(200);
      expect(page).not.toBeNull();
      ids.push(...page!.assets.map((asset) => asset.id));
      cursor = page!.nextCursor;
    } while (cursor);
    expect(ids).toEqual(view.rows.map((row: { id: string }) => row.id));
    expect(new Set(ids).size).toBe(137);
    expect(view.wire).toHaveLength(3);
    expect(view.wire.every((row: { responseIds: string[] }) => row.responseIds.length <= 61)).toBe(true);
    expect(view.protocolErrors).toEqual([]);
  });

  it("uses UUID as the exact tie breaker and retains timestamp microseconds", async () => {
    const rows = seedRows().map((row: object) => ({ ...row, created_at: "2026-10-30T12:34:56.123456+00:00" }));
    const view = runtime({ rows });
    const first = await (await view.handle(request())).json();
    const cursor = parseEditorMediaCursor(first.nextCursor)!;
    expect(cursor.createdAt).toBe("2026-10-30T12:34:56.123456+00:00");
    expect(cursor.id).toBe(first.assets[59].id);
    const second = await (await view.handle(request(`?cursor=${encodeURIComponent(first.nextCursor)}`))).json();
    expect(second.assets[0].id < cursor.id).toBe(true);
    expect(new Set([...first.assets, ...second.assets].map((asset: { id: string }) => asset.id)).size).toBe(120);
  });

  it.each([
    ["filename-needle-137", 137], ["Asset 137", 137], ["caption-needle-136", 136], ["collection-needle-135", 135], ["literal %_\\ item", 134],
  ])("searches the actual four-field grammar for %s", async (term, index) => {
    const view = runtime();
    const page = await (await view.handle(request(`?q=${encodeURIComponent(term)}`))).json();
    expect(page.assets.map((asset: { id: string }) => asset.id)).toEqual([view.rows[Number(index) - 1].id]);
    expect(view.wire[0].query.filter(([name]: string[]) => name === "or")).toHaveLength(1);
    expect(view.protocolErrors).toEqual([]);
  });

  it("keeps quotes, commas, parentheses, percent, underscore and backslash literal alongside a cursor", async () => {
    const term = 'literal " comma, (or) %_\\ item';
    const rows = seedRows().map((row: object) => ({ ...row, original_name: term }));
    const view = runtime({ rows });
    const first = await (await view.handle(request(`?q=${encodeURIComponent(term)}`))).json();
    const second = await (await view.handle(request(`?q=${encodeURIComponent(term)}&cursor=${encodeURIComponent(first.nextCursor)}`))).json();
    expect(first.assets).toHaveLength(60);
    expect(second.assets).toHaveLength(60);
    expect(new Set([...first.assets, ...second.assets].map((asset: { id: string }) => asset.id)).size).toBe(120);
    expect(view.wire.every((row: { query: string[][] }) => row.query.filter(([name]) => name === "or").length === 1)).toBe(true);
    expect(view.protocolErrors).toEqual([]);
  });

  it("distinguishes confirmed empty from failed, null or malformed successful dependencies", async () => {
    const empty = await runtime({ empty: true }).handle(request());
    expect(await empty.json()).toEqual({ ok: true, assets: [], nextCursor: null });
    for (const options of [{ readError: true }, { nullData: true }, { rows: [{ ...seedRows()[0], alt_text: { bad: true } }] }]) {
      const response = await runtime(options).handle(request());
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "Не удалось загрузить список изображений." });
    }
  });

  it("refuses invalid cursors before any assets request", async () => {
    for (const cursor of ["", "{}", '["2026-02-31T00:00:00Z","00000000-0000-4000-8000-000000000001"]', '["now","unsafe,id"]']) {
      const view = runtime();
      expect((await view.handle(request(`?cursor=${encodeURIComponent(cursor)}`))).status).toBe(400);
      expect(view.wire).toEqual([]);
    }
  });

  it("retains staff access and excludes deleted objects", async () => {
    const denied = runtime({ staff: false });
    expect((await denied.handle(request())).status).toBe(401);
    expect(denied.wire).toEqual([]);
    expect((await runtime({ noClient: true }).handle(request())).status).toBe(503);
    const rows = seedRows(); rows[136].deleted_at = "2026-10-30T00:00:00Z";
    const view = runtime({ rows });
    const page = await (await view.handle(request("?q=filename-needle-137"))).json();
    expect(page.assets).toEqual([]);
  });
});

describe("strict client media envelope", () => {
  const asset = { id: "00000000-0000-4000-8000-000000000001", src: "https://media.invalid/one", alt: "Authored \u2014 text", caption: "", creator: "", sourceUrl: "", licenseName: "", licenseUrl: "", collectionName: "", width: 0, height: 0 };
  it("preserves all authored metadata and valid zero dimensions", () => {
    const page = { ok: true, assets: [asset], nextCursor: null };
    expect(parseEditorMediaAssetsPage(page)).toEqual(page);
    expect(parseEditorMediaAssetsPage({ ok: true, assets: [], nextCursor: null })).toEqual({ ok: true, assets: [], nextCursor: null });
  });
  it.each([
    {}, { ok: true }, { ok: true, assets: [] }, { ok: true, assets: null, nextCursor: null },
    { ok: true, assets: [{ ...asset, alt: { bad: true } }], nextCursor: null },
    { ok: true, assets: [{ ...asset, src: "javascript:bad" }], nextCursor: null },
    { ok: true, assets: [{ ...asset, width: "800" }], nextCursor: null },
    { ok: true, assets: [asset, asset], nextCursor: null },
    { ok: true, assets: [asset], nextCursor: "{}" },
    { ok: true, assets: [asset], nextCursor: null, error: "untrusted" },
    { ok: true, assets: [], nextCursor: encodeEditorMediaCursor({ createdAt: "2026-10-30T00:00:00Z", id: asset.id }) },
  ])("rejects malformed HTTP200 data rather than inventing an empty list: %#", (value) => {
    expect(parseEditorMediaAssetsPage(value)).toBeNull();
  });
});
