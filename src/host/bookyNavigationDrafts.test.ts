import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { BOOKY_NAVIGATION_DRAFTS, BOOKY_NAVIGATION_DRAFT_INVENTORY } from "./bookyNavigationDrafts";
import { BOOKY_DIALOGUE_DRAFTS } from "./bookyDialogueDrafts";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { PLANET_MASCOT_ROUTES, type PlanetMascotRoute } from "./planetMascotRoutes";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceText = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
// Fixed per-source declarations; changing a provenance binding requires an explicit versioned rebaseline.
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
} as const;
const policy = { canonicalEntityIds: [], approvedReviews: [] } as const;
const request = ({ payload }: BookyDialogueRecord) => ({
  id: payload.id, locale: payload.locale, audience: "adult", age: 30,
  readingLevel: payload.readingLevel, intent: payload.intent, screen: payload.screens[0],
  context: payload.context, entityIds: [], now: "2026-09-20T00:00:00.000Z",
});
const routeSteps = (Object.keys(PLANET_MASCOT_ROUTES) as PlanetMascotRoute[])
  .flatMap(route => PLANET_MASCOT_ROUTES[route].steps.map(step => ({ route, step })));

// Read literal TSX declarations only; never import React, a renderer or artwork.
function existingContextualCopy() {
  const file = "src/host/PlanetMascotControls.tsx";
  const tree = ts.createSourceFile(file, sourceText(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function declaration(name: string): ts.Expression {
    const found: ts.VariableDeclaration[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    if (found.length !== 1 || !found[0].initializer) throw new Error("Ambiguous source declaration: " + name);
    return found[0].initializer;
  }
  function bilingual(expression: ts.Expression) {
    if (!ts.isConditionalExpression(expression) || !ts.isIdentifier(expression.condition) || expression.condition.text !== "ru"
      || !ts.isStringLiteral(expression.whenTrue) || !ts.isStringLiteral(expression.whenFalse)) throw new Error("Nonliteral source copy");
    return { ru: expression.whenTrue.text, en: expression.whenFalse.text };
  }
  const title = bilingual(declaration("name")), helpTip = declaration("helpTip");
  if (!ts.isElementAccessExpression(helpTip) || !ts.isObjectLiteralExpression(helpTip.expression)
    || !helpTip.argumentExpression || !ts.isIdentifier(helpTip.argumentExpression) || helpTip.argumentExpression.text !== "tipKind") {
    throw new Error("Changed contextual source shape");
  }
  const tips = helpTip.expression.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) throw new Error("Nonliteral context");
    return { context: property.name.text, body: bilingual(property.initializer) };
  });
  expect(tips.map(tip => tip.context)).toEqual(["globe", "country", "writer", "collection"]);
  return { title, tips };
}

describe("fixed unreviewed adult navigation inventory", () => {
  it.each(BOOKY_NAVIGATION_DRAFT_INVENTORY.sources)("pins exact source bytes and identity for $sourcePath", source => {
    expect(source).toMatchObject(expectedSources[source.sourcePath]);
    expect(source.sourceHashEncoding).toBe("sha256:utf8:lf");
    expect(source.copyHashEncoding).toBe("sha256:utf8:JSON.stringify({title,body})");
    const normalized = sourceText(source.sourcePath).replace(/\r\n/g, "\n");
    expect(sha256(normalized)).toBe(source.sourceSha256);
    expect(sha256(normalized + "\n")).not.toBe(source.sourceSha256);
  });

  it.each(routeSteps)("retains exact bilingual navigation copy for $route/$step.id", ({ route, step }) => {
    const rows = BOOKY_NAVIGATION_DRAFTS.filter(record => record.payload.context === `tour:${route}:${step.id}`);
    expect(rows.map(record => record.payload.locale).sort()).toEqual(["en", "ru"]);
    for (const { payload } of rows) {
      expect(payload.id).toBe(`navigation.${route}.${step.id}`);
      expect(payload.version).toBe(expectedSources["src/host/planetMascotRoutes.ts"].sourceVersion);
      // The instruction stays visible while the UI offers navigation to the
      // requiredScreen; that target gates advancement, not copy visibility.
      expect(payload.screens).toEqual(["globe", "collection"]);
      expect(["globe", "collection"]).toContain(step.requiredScreen);
      expect(payload.copy).toEqual({ title: step.title[payload.locale], body: step.body[payload.locale],
        caption: step.title[payload.locale], reduced: step.title[payload.locale] });
      expect(payload.provenance.sourceRef).toBe(`${expectedSources["src/host/planetMascotRoutes.ts"].sourceCommit}:PLANET_MASCOT_ROUTES.${route}.steps.${step.id}:${payload.locale}`);
    }
  });

  it.each(["globe", "country", "writer", "collection"])("retains the actual heading and %s contextual body", context => {
    const live = existingContextualCopy();
    const body = live.tips.find(tip => tip.context === context)!.body;
    const rows = BOOKY_NAVIGATION_DRAFTS.filter(record => record.payload.context === "help:" + context);
    expect(rows.map(record => record.payload.locale).sort()).toEqual(["en", "ru"]);
    for (const { payload } of rows) {
      const title = live.title[payload.locale];
      expect(payload.id).toBe("guidance." + context);
      expect(payload.version).toBe(expectedSources["src/host/PlanetMascotControls.tsx"].sourceVersion);
      expect(payload.screens).toEqual([context === "collection" ? "collection" : "globe"]);
      expect(payload.copy).toEqual({ title, body: body[payload.locale], caption: title, reduced: title });
      expect(payload.provenance.sourceRef).toBe(`${expectedSources["src/host/PlanetMascotControls.tsx"].sourceCommit}:PlanetMascotControls.name+helpTip.${context}:${payload.locale}`);
    }
  });

  it("pins complete route versions and step order without silently accepting a new or removed step", () => {
    expect(Object.entries(PLANET_MASCOT_ROUTES).map(([id, route]) => ({ id, version: route.version,
      stepIds: route.steps.map(step => step.id) }))).toEqual(BOOKY_NAVIGATION_DRAFT_INVENTORY.routes);
    expect(BOOKY_NAVIGATION_DRAFT_INVENTORY).toMatchObject({ schemaVersion: 1, recordCount: 22,
      navigationRecordCount: 14, contextualRecordCount: 8, status: "draft", humanReviewed: false,
      childApproved: false, narrationApproved: false, releaseReady: false });
  });

  it("validates all fixed hashes and combines 34 unique drafts while admitting no reviewed adult or child dialogue", () => {
    const combined = [...BOOKY_DIALOGUE_DRAFTS, ...BOOKY_NAVIGATION_DRAFTS];
    const registry = createBookyDialogueRegistry(combined, policy);
    expect(BOOKY_NAVIGATION_DRAFTS).toHaveLength(22);
    expect(combined).toHaveLength(34);
    expect(registry.size).toBe(34);
    expect(registry.rejections).toEqual([]);
    expect(new Set(combined.map(record => `${record.payload.id}:${record.payload.locale}`)).size).toBe(34);
    for (const record of BOOKY_NAVIGATION_DRAFTS) {
      const { payload, review, checksum } = record;
      expect(payload).toMatchObject({ audience: "adult", ageRange: { min: 18, max: 120 }, readingLevel: "plain",
        intent: "navigation", claimKind: "interface-guidance", entityIds: [], factualSources: [], narration: null, prohibitedTags: [] });
      const source = BOOKY_NAVIGATION_DRAFT_INVENTORY.sources.find(value => value.sourcePath === payload.provenance.sourcePath)!;
      expect(source).toBeDefined();
      expect(payload.version).toBe(expectedSources[source.sourcePath].sourceVersion);
      expect(payload.provenance).toMatchObject({ kind: "existing-interface-copy", sourcePath: source.sourcePath,
        sourceVersion: source.sourceVersion, sourceSha256: source.sourceSha256,
        copySha256: sha256(JSON.stringify({ title: payload.copy.title, body: payload.copy.body })) });
      expect(review).toEqual({ status: "draft", reviewer: null, reviewedAt: null, contentChecksum: getBookyDialogueContentChecksum(payload) });
      expect(checksum).toBe(getBookyDialogueChecksum({ payload, review }));
    }
    for (const record of combined) for (const screen of record.payload.screens) {
      expect(registry.resolve({ ...request(record), screen })).toBeNull();
      expect(registry.resolve({ ...request(record), screen, audience: "child", age: 10 })).toBeNull();
    }
  });

  it("rejects changed route or contextual wording and stale contextual versions under fixed declarations", () => {
    const context = BOOKY_NAVIGATION_DRAFTS.find(record => record.payload.id === "guidance.globe")!;
    const changed = [BOOKY_NAVIGATION_DRAFTS[0], context].map(original => ({ ...original,
      payload: { ...original.payload, copy: { ...original.payload.copy, body: "Changed." } } }));
    const stale = [
      { ...context, payload: { ...context.payload, version: 3 } },
      { ...context, payload: { ...context.payload, provenance: { ...context.payload.provenance, sourceVersion: 3 } } },
      { ...context, payload: { ...context.payload, provenance: { ...context.payload.provenance,
        sourceRef: context.payload.provenance.sourceRef.replace(expectedSources["src/host/PlanetMascotControls.tsx"].sourceCommit,
          "c5f8e80ab3b8f6be42e04584a0b174ac427197e7") } } },
    ];
    for (const record of [...changed, ...stale]) {
      const registry = createBookyDialogueRegistry([record], policy);
      expect(registry.size).toBe(0);
      expect(registry.rejections).toHaveLength(1);
      expect(registry.resolve(request(record))).toBeNull();
    }
  });

  it("freezes every exported declaration", () => {
    function assertFrozen(value: unknown): void {
      if (value !== null && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        for (const child of Object.values(value)) assertFrozen(child);
      }
    }
    assertFrozen(BOOKY_NAVIGATION_DRAFTS);
    assertFrozen(BOOKY_NAVIGATION_DRAFT_INVENTORY);
  });
});
