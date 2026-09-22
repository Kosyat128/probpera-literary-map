import { describe, expect, it } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import type { Country, BookArchiveEntry } from "../planet/types";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyEntityId, getBookyJourneyChecksum, type BookyJourneyContext,
  type BookyJourneyDefinition, type BookyJourneyTrust } from "./bookyJourney";
import type { BookyJourneyHostRequest, BookyJourneyHostSnapshot } from "./bookyJourneyHost";
import {createPlanetMascotController, type PlanetMascotContext} from "./planetMascot";
import type {BookyReaderPolicy} from "./bookyReaderPolicy";

const now = "2026-09-20T12:00:00.000Z", reviewedAt = "2026-09-19T12:00:00.000Z";
function fixture(locale: "ru" | "en" = "en", includeWork = true) {
  // Synthetic catalog, policy and reviewers only. These fixtures confer no
  // production journey, content, child-policy or human approval.
  const country: Country = { id: "test-country", name: "Synthetic country", coordinates: [20, 30], writers: [{ id: "test-writer" }] };
  const book: BookArchiveEntry = { id: "test-work", title: "Synthetic work", countryId: country.id, countryName: country.name,
    writerId: "test-writer", writerName: "Synthetic writer", country, writer: country.writers[0], editorial: { status: "verified" } };
  const allNodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "test-country-line", version: 1, contentChecksum: "" } },
    { id: "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "test-writer" }, screen: "globe", dialogue: { id: "test-writer-line", version: 1, contentChecksum: "" } },
    { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id }, screen: "collection", dialogue: { id: "test-work-line", version: 1, contentChecksum: "" } },
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: "globe", dialogue: { id: "test-checkpoint-line", version: 1, contentChecksum: "" } },
  ];
  const nodes = includeWork ? allNodes : [allNodes[0], allNodes[3]];
  const records: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: locale === "ru" ? "Проверка" : "Test", body: locale === "ru" ? "Текст тестового интерфейса." : "Synthetic interface text.", caption: "Synthetic caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", intent: "navigation", screens: [node.screen], context: `test-journey:${node.id}`,
      entityIds: node.entity ? [bookyJourneyEntityId(node.entity)] : [], claimKind: "interface-guidance", factualSources: [], copy,
      narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/fixture.ts", sourceVersion: 1,
        sourceRef: node.id, sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt, contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const definition: BookyJourneyDefinition = { schemaVersion: 1, id: "test-journey", version: 1, locale, audience: "adult",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", title: locale === "ru" ? "Тестовый маршрут" : "Synthetic journey", prerequisites: [],
    nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: records[index].review.contentChecksum } })) };
  const context: BookyJourneyContext = { audience: "adult", age: 30, locale, readingLevel: "plain", now, connectivity: "online", completedPrerequisites: [],
    availability: definition.nodes.map(node => ({ nodeId: node.id, locale, dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) };
  const trust: BookyJourneyTrust = { currentVersions: [{ id: definition.id, version: 1 }], approvedReviews: [
    { id: definition.id, version: 1, locale, definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt },
  ], dialogueRegistry: createBookyDialogueRegistry(records, { canonicalEntityIds: records.flatMap(record => [...record.payload.entityIds]),
    approvedReviews: records.map(record => ({ id: record.payload.id, locale, version: 1,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })) }), publicCountries: [country], publicBooks: [book] };
  let host: BookyJourneyHostSnapshot | null = Object.freeze({ revision: 1, enabled: true, active: true, access: "adult",
    countryStatus: "ready", booksStatus: "ready", context, definition, trust });
  const request: BookyJourneyHostRequest = { journeyId: definition.id, version: 1, locale,
    definitionChecksum: getBookyJourneyChecksum(definition)!, nodeId: "country", hostRevision: 1 };
  const read = () => host;
  const update = (change: Partial<BookyJourneyHostSnapshot>) => {
    host = Object.freeze({ ...host!, ...change, revision: host!.revision + 1 });
    return { ...request, hostRevision: host.revision };
  };
  return { request, context, trust, definition, records, read, update, clear: () => { host = null; } };
}


describe("reader policy in the actual companion controller", () => {
  const policy: BookyReaderPolicy = {schemaVersion:1,audience:"adult",age:30,readingLevel:"plain",confirmedAt:now,revision:1};
  const base: PlanetMascotContext = {enabled:true,active:true,access:"adult",screen:"globe",selectedCountry:true,selectedWriter:true,
    countryStatus:"ready",booksStatus:"ready",connectivity:"online",locale:"en",readerPolicy:policy};
  function setup(){const f=fixture(),controller=createPlanetMascotController();controller.setContext(base);
    const source=Object.freeze({definition:f.definition,trust:f.trust,now,availability:f.context.availability,completedPrerequisites:[]});
    const request=()=>({...f.request,hostRevision:controller.getSnapshot().revision});
    return{f,controller,source,request,resolve:()=>controller.resolveJourneyNode(request(),()=>source)};}
  it("uses explicit policy for the exact admitted route while preserving normal navigation",()=>{
    const f=setup();expect(f.resolve()?.node.id).toBe("country");expect(f.controller.getReaderPolicy()).toEqual(policy);
    expect(f.controller.show()).toBe(true);expect(f.controller.start("overview")).toBe(true);
    expect(f.controller.getSnapshot().step).toBe(0);
  });
  it("keeps ordinary adult navigation when reader policy is absent and denies literary admission",()=>{
    const f=setup();f.controller.setContext({...base,readerPolicy:null});
    expect(f.controller.getReaderPolicy()).toBeNull();expect(f.resolve()).toBeNull();
    expect(f.controller.start("overview")).toBe(true);
  });
  it("fences stale actions after locale, profile, readiness and availability changes",()=>{
    const f=setup(),stale=f.request();
    for(const change of [{locale:"ru" as const},{readerPolicy:{...policy,readingLevel:"fluent" as const,revision:2}},
      {readerPolicy:null},{countryStatus:"loading" as const},{booksStatus:"error" as const},{active:false},{access:"child" as const}]){
      f.controller.setContext({...base,...change});
      expect(f.controller.resolveJourneyNode(stale,()=>f.source)).toBeNull();expect(f.resolve()).toBeNull();
    }
    f.controller.setContext(base);expect(f.resolve()).not.toBeNull();
  });
  it("does not create a new revision for an identical explicit policy",()=>{
    const f=setup(),revision=f.controller.getSnapshot().revision;
    f.controller.setContext({...base,readerPolicy:{...policy}});
    expect(f.controller.getSnapshot().revision).toBe(revision);
  });
  it("rejects policy dates in the future and missing locale without defaults",()=>{
    const f=setup();f.controller.setContext({...base,readerPolicy:{...policy,confirmedAt:"2026-09-21T00:00:00.000Z"}});
    expect(f.resolve()).toBeNull();f.controller.setContext({...base,locale:undefined});expect(f.resolve()).toBeNull();
  });
  it("rechecks host and source during injected compilation and never caches old approval",()=>{
    const f=setup(),registry=f.source.trust.dialogueRegistry;
    const source={...f.source,trust:{...f.source.trust,dialogueRegistry:{...registry,resolve(value:unknown){
      f.controller.setContext({...base,readerPolicy:null});return registry.resolve(value);}}}};
    expect(f.controller.resolveJourneyNode(f.request(),()=>source)).toBeNull();
    f.controller.setContext(base);expect(f.resolve()).not.toBeNull();
    let reads=0;expect(f.controller.resolveJourneyNode(f.request(),()=>++reads===1?f.source:{...f.source})).toBeNull();
    expect(f.controller.resolveJourneyNode(f.request(),()=>({...f.source,trust:{...f.source.trust,approvedReviews:[]}}))).toBeNull();
    f.controller.dispose();expect(f.resolve()).toBeNull();
  });
  it("rejects policy revocation inside either final source-reader callback",()=>{
    for(const revokeAt of [2,3]){
      const f=setup();let reads=0;
      expect(f.controller.resolveJourneyNode(f.request(),()=>{
        if(++reads===revokeAt)f.controller.setContext({...base,readerPolicy:null});
        return f.source;
      })).toBeNull();
      expect(f.controller.getReaderPolicy()).toBeNull();
    }
  });
});
