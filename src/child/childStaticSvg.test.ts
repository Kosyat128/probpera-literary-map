import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CHILD_SVG_MAX_BYTES, createChildStaticSvgRasterBytes, preflightChildStaticSvg } from "./childStaticSvg";
import { childMediaContainerMatches } from "./childMedia";
import { createWebChildMediaCodec, preflightChildMedia } from "./childMediaDecode";

// Existing canonical flag bytes and generated geometry exercise only resource
// validation. No fixture grants reviewed child content, native or rights access.
const bytes = (source: string) => new TextEncoder().encode(source);
const wrap = (body: string, attributes = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" ${attributes}>${body}</svg>`;
const hash = (input: Uint8Array) => createHash("sha256").update(input).digest("hex");
const flag = (code: string) => new Uint8Array(readFileSync(new URL(`../../public/assets/country-flags/${code}.svg`, import.meta.url)));
describe("strict owned static SVG child image boundary", () => {
  it.each(["ru", "gb", "us"])("accepts unchanged canonical %s geometry without inventing child approval", code => {
    const original = flag(code), originalHash = hash(original);
    expect(preflightChildStaticSvg(original)).toEqual({ kind: "image", width: 512, height: 512 });
    expect(preflightChildMedia(original, "image/svg+xml")).toEqual({ kind: "image", width: 512, height: 512 });
    expect(childMediaContainerMatches(original, "image/svg+xml")).toBe(true);
    const raster = createChildStaticSvgRasterBytes(original)!; expect(raster).toBeInstanceOf(Uint8Array);
    try {
      const source = new TextDecoder().decode(original), output = new TextDecoder().decode(raster);
      expect(output).toContain('width="512" height="512"'); expect(output.slice(output.indexOf(">") + 1)).toBe(source.slice(source.indexOf(">") + 1));
      expect(hash(original)).toBe(originalHash);
    } finally { raster.fill(0); original.fill(0); }
  });
  it("supports bounded local definitions/clipping/reference transforms and valid arc flags", () => {
    const source = wrap('<defs><clipPath id="clip"><rect width="20" height="10"/></clipPath><g id="shape"><path d="M0 0A4 3 0 0 1 5 5L10 0z"/></g></defs><use href="#shape" width="100%" height="100%" transform="translate(2) rotate(10 5 5) scale(0.5)" clip-path="url(#clip)" fill="#fff"/>');
    expect(preflightChildStaticSvg(bytes(source))).toEqual({ kind: "image", width: 20, height: 10 });
  });
  it.each([
    '<script>alert(1)</script>', '<path onload="alert(1)" d="M0 0L1 1"/>', '<foreignObject/>', '<image href="https://remote.test/a.png"/>',
    '<style>path{fill:url(https://remote.test)}</style>', '<path style="fill:red" d="M0 0L1 1"/>', '<animate attributeName="fill"/>', '<text>Hidden language</text>',
    '<path filter="url(#f)" d="M0 0L1 1"/>', '<use href="https://remote.test/f.svg#id"/>', '<path fill="url(data:image/svg+xml,...)" d="M0 0L1 1"/>',
    '<path clip-path="url(https://remote.test/#clip)" d="M0 0L1 1"/>', '<svg xmlns="http://www.w3.org/1999/xhtml"/>', '<path class="ambient-css" d="M0 0L1 1"/>'
  ])("denies active/external/ambient construct before native codec: %s", async body => {
    const input = bytes(wrap(body)), native = vi.fn(); vi.stubGlobal("createImageBitmap", native);
    try { expect(preflightChildStaticSvg(input)).toBeNull(); await expect(createWebChildMediaCodec().decode(input, "image/svg+xml", { kind: "image", width: 20, height: 10 }, new AbortController().signal)).rejects.toThrow(); expect(native).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); input.fill(0); }
  });
  it.each([
    '<!DOCTYPE svg [<!ENTITY x "expanded">]>', '<?xml version="1.0"?>', '<!-- ambiguous parser comment -->', '&lt;',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" viewBox="0 0 2 2"/>',
    wrap('<g id="same"/><path id="same" d="M0 0L1 1"/>'), wrap('<use href="#missing"/>'),
    wrap('<g id="a"><use href="#a"/></g>'), wrap('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g>'),
    wrap('<use xlink:href="#shape"/><path id="shape" d="M0 0L1 1"/>'), wrap('<g><path d="M0 0L1 1"/></path>'),
    wrap('<path d="M0 0A2 2 0 2 0 5 5"/>'), wrap('<path d="M0 0C1 2 3"/>'), wrap('<path d="M0 0R1 1"/>'),
    wrap('<path transform="scale(32768) scale(32768)" d="M0 0L1 1"/>'), wrap('<path d="M0 0L1e100 1"/>')
  ])("rejects structural/namespace/reference/geometry ambiguity: %s", source => {
    expect(preflightChildStaticSvg(bytes(source))).toBeNull(); expect(createChildStaticSvgRasterBytes(bytes(source))).toBeNull();
  });
  it("denies physical node/depth/path/attribute and UTF8 allocation budgets", () => {
    const excessiveNodes = wrap('<path d="M0 0L1 1"/>'.repeat(4096));
    const excessiveDepth = wrap("<g>".repeat(64) + "</g>".repeat(64));
    const excessivePath = wrap('<path d="M0 0' + 'L0 0'.repeat(32769) + '"/>');
    const excessiveAttributes = wrap('<path ' + Array.from({ length: 33 }, (_, index) => `unknown${index}="0"`).join(" ") + '/>');
    for (const source of [excessiveNodes, excessiveDepth, excessivePath, excessiveAttributes, wrap('<rect width="-1"/>'), wrap("", 'width="2049"')]) expect(preflightChildStaticSvg(bytes(source))).toBeNull();
    expect(preflightChildStaticSvg(new Uint8Array(CHILD_SVG_MAX_BYTES + 1))).toBeNull();
    expect(preflightChildStaticSvg(new Uint8Array([0xc0, 0xaf]))).toBeNull();
    expect(preflightChildStaticSvg(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(wrap(""))]))).toBeNull();
  });
  it("bounds exponential local use expansion despite a small acyclic input", () => {
    let definitions = '<g id="s0"><path d="M0 0L1 1"/></g>';
    for (let index = 1; index <= 13; index++) definitions += `<g id="s${index}"><use href="#s${index - 1}"/><use href="#s${index - 1}"/></g>`;
    const input = bytes(wrap(`<defs>${definitions}</defs><use href="#s13"/>`)); expect(input.length).toBeLessThan(2048);
    expect(preflightChildStaticSvg(input)).toBeNull();
  });
  it("does not let a memoized referenced subtree bypass the effective depth limit", () => {
    let definitions = '<g id="s0"><path d="M0 0L1 1"/></g>';
    for (let index = 1; index <= 64; index++) definitions += `<g id="s${index}"><use href="#s${index - 1}"/></g>`;
    expect(preflightChildStaticSvg(bytes(wrap(`<defs>${definitions}</defs><use href="#s64"/>`)))).toBeNull();
  });
  it("caps effective affine mapping through containment, use positioning and root viewport scaling", () => {
    for (const source of [
      wrap('<g transform="scale(32768)"><g transform="scale(32768)"><path d="M0 0L1 1"/></g></g>'),
      wrap('<defs><g id="a" transform="scale(32768)"><path d="M0 0L1 1"/></g></defs><use href="#a" transform="scale(2)"/>'),
      wrap('<defs><path id="a" d="M0 0L1 1"/></defs><g transform="scale(2)"><use href="#a" x="32768"/></g>'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1e-300 1e-300" width="512" height="512"><path d="M0 0L1 1"/></svg>',
      wrap('<path d="M0 0L1 1"/>', 'transform="scale(2)"')
    ]) expect(preflightChildStaticSvg(bytes(source))).toBeNull();
  });
  it("retains the exact canonical US marker inventory and original geometry", () => {
    const original = flag("us"), raster = createChildStaticSvgRasterBytes(original);
    try {
      expect(hash(original)).toBe("43a00def4fa058cc317d79aba935eaf1622f2d215442bb35a6f8fbc6a01a4d5f");
      expect(preflightChildStaticSvg(original)).toEqual({ kind: "image", width: 512, height: 512 });
      expect(new TextDecoder().decode(original)).toContain('<marker id="us-a" markerHeight="30" markerWidth="30">');
      expect(raster).not.toBeNull();
      const source = new TextDecoder().decode(original), output = new TextDecoder().decode(raster!);
      expect(output.slice(output.indexOf(">") + 1)).toBe(source.slice(source.indexOf(">") + 1));
    } finally { raster?.fill(0); original.fill(0); }
  });
  it("accepts zero-oriented local markers on bounded linear geometry and use clones", () => {
    const marker = '<defs><marker id="m" markerWidth="3" markerHeight="3" refX="1" refY="1" orient="0"><path d="M0 0L2 0L1 2z"/></marker><path id="p" d="m1 1 2 0h2v2z" marker-mid="url(#m)"/></defs>';
    const body = '<g stroke-width="2"><use href="#p" x="1"/><line x1="1" y1="1" x2="5" y2="1" marker-start="url(#m)" marker-end="url(#m)"/><polyline points="1 1 3 1 3 3" marker-mid="url(#m)"/><polygon points="1 1 3 1 3 3" marker-end="url(#m)"/></g>';
    expect(preflightChildStaticSvg(bytes(wrap(marker + body)))).toEqual({ kind: "image", width: 20, height: 10 });
  });
  it("uses definition style inheritance independently of the referring marker stroke scale", () => {
    const body = '<marker id="outer" markerUnits="userSpaceOnUse" markerWidth="4" markerHeight="4"><path d="M0 0L1 1" marker-end="url(#inner)"/></marker><marker id="inner"><path d="M0 0L1 1"/></marker><path stroke-width="2000" d="M1 1L2 2" marker-end="url(#outer)"/>';
    expect(preflightChildStaticSvg(bytes(wrap(body)))).toEqual({ kind: "image", width: 20, height: 10 });
  });
  it.each([
    '<path d="M0 0L1 1" marker-end="url(#missing)"/>',
    '<path id="m" d="M0 0L1 1"/><path d="M0 0L1 1" marker-end="url(#m)"/>',
    '<clipPath id="m"><path d="M0 0L1 1"/></clipPath><path d="M0 0L1 1" marker-end="url(#m)"/>',
    '<marker id="m"><path d="M0 0L1 1"/></marker><use href="#m"/>',
    '<marker id="m"><path d="M0 0L1 1" marker-end="url(#m)"/></marker>',
    '<marker id="a"><path d="M0 0L1 1" marker-end="url(#b)"/></marker><marker id="b"><path d="M0 0L1 1" marker-end="url(#a)"/></marker>',
    '<marker id="m" viewBox="0 0 1 1"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" orient="auto"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" orient="auto-start-reverse"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" orient="90"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" transform="scale(2)"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" markerUnits="objectBoundingBox"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" markerWidth="0"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" markerWidth="1.5"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" markerHeight="2049"><path d="M0 0L1 1"/></marker>',
    '<marker id="m" refX="center"><path d="M0 0L1 1"/></marker>',
    '<g><marker id="m"><path d="M0 0L1 1"/></marker></g>',
    '<marker id="m"><path d="M0 0L1 1"/></marker><g marker-end="url(#m)"/>',
    '<marker id="m"><path d="M0 0L1 1"/></marker><path d="M0 0C1 1 2 2 3 3" marker-end="url(#m)"/>',
    '<marker id="m"><path d="M0 0L1 1"/></marker><path d="M0 0L1 1" marker-end="url(https://remote.test/#m)"/>'
  ])("denies unsupported marker grammar, target types and cyclic expansion: %s", body => {
    const input = bytes(wrap(body)); expect(preflightChildStaticSvg(input)).toBeNull(); expect(createChildStaticSvgRasterBytes(input)).toBeNull();
  });
  it("charges every marker vertex and repeated closure against node and number expansion limits", () => {
    const manyNodes = '<marker id="m">' + '<rect width="1" height="1"/>'.repeat(100) + '</marker><path marker-mid="url(#m)" d="M0 0' + 'h1'.repeat(200) + '"/>';
    const manyNumbers = '<marker id="m"><path d="M0 0' + 'L1 1'.repeat(2000) + '"/></marker><path marker-mid="url(#m)" d="M0 0' + 'h1'.repeat(40) + '"/>';
    const manyClosures = '<marker id="m"><path d="M0 0L1 1"/></marker><path marker-mid="url(#m)" d="M0 0' + 'z'.repeat(16384) + '"/>';
    for (const source of [manyNodes, manyNumbers, manyClosures]) expect(preflightChildStaticSvg(bytes(wrap(source)))).toBeNull();
  });
  it("bounds accumulated marker vertices, inherited stroke scale, offsets and viewport corners", () => {
    const marker = '<marker id="m" markerWidth="30" markerHeight="30"><path d="M0 0L1 1"/></marker>';
    for (const source of [
      wrap(marker + '<path marker-end="url(#m)" d="m32760 0h10"/>'),
      wrap(marker + '<g stroke-width="2000" transform="scale(2)"><path marker-end="url(#m)" d="M0 0L1 1"/></g>'),
      wrap(marker + '<defs><path id="p" marker-end="url(#m)" d="M0 0L1 1"/></defs><use href="#p" stroke-width="2000" transform="scale(2)"/>'),
      wrap('<marker id="m" refX="32768"><path d="M0 0L1 1"/></marker><g stroke-width="2"><path marker-end="url(#m)" d="M0 0L1 1"/></g>'),
      wrap('<marker id="m" refY="32768"><path d="M0 0L1 1"/></marker><g stroke-width="2"><path marker-end="url(#m)" d="M0 0L1 1"/></g>'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="512" height="512">' + marker + '<path marker-end="url(#m)" d="M60 0L64 0"/></svg>',
      wrap(marker + '<path marker-end="url(#m)" d="M32760 0L32767 0"/>')
    ]) expect(preflightChildStaticSvg(bytes(source))).toBeNull();
  });
  it("caps aggregate marker viewport pixels through vertex fanout and effective scaling", () => {
    const fanout = '<marker id="m" markerWidth="1024" markerHeight="1024"><path d="M0 0L1 1"/></marker><path d="M0 0L1 1L2 2L3 3" marker-mid="url(#m)"/>';
    const scaled = '<marker id="m"><path d="M0 0L1 1"/></marker><g transform="scale(1000)"><path d="M0 0L1 1" marker-end="url(#m)"/></g>';
    for (const source of [fanout, scaled]) expect(preflightChildStaticSvg(bytes(wrap(source)))).toBeNull();
  });
  it("bypasses caller byte accessors and rejects borrowed shared or derived buffers", () => {
    const input = bytes(wrap('<rect width="20" height="10"/>')), accessor = vi.fn();
    Object.defineProperty(input, "byteLength", { get: accessor }); Object.defineProperty(input, "buffer", { get: accessor });
    expect(preflightChildStaticSvg(input)).toEqual({ kind: "image", width: 20, height: 10 }); expect(accessor).not.toHaveBeenCalled();
    class Derived extends Uint8Array {} expect(preflightChildStaticSvg(new Derived(input))).toBeNull();
    if (typeof SharedArrayBuffer === "function") expect(preflightChildStaticSvg(new Uint8Array(new SharedArrayBuffer(20)))).toBeNull();
  });
});
