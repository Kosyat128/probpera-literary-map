import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, formatCsv } from "./csv.mjs";
import { validateSchema } from "./schema.mjs";
import { firstOpenCriterion, foundationCriterionIds, validateExecution } from "./state.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../../docs/mobile/requirements/v12/${name}`, import.meta.url), "utf8"));
const schemas = { state: read("43_AUTOPILOT_STATE_SCHEMA.json"), traceability: read("57_REQUIREMENTS_TRACEABILITY_SCHEMA.json") };
const timestamp = "2026-09-05T03:00:00Z";
const commit = "a".repeat(40);
function fixture() {
  const sources = ["CANON-001", "BIL-001"].map(id => ({ requirement_id: id, binding_source: "119", summary: id, priority: "P0" }));
  const stageDefinitions = ["S00", "S01", "S02"].map(id => ({ stage_id: id, stage_name: id }));
  const state = {
    version: "12.0", repository: "Kosyat128/probpera-literary-map", branch: "codex/literary-planet-v12-bilingual-final-autopilot",
    baseSha: commit, headSha: commit, status: "IN_PROGRESS", updatedAt: timestamp,
    currentStageId: "S00", currentCriterionId: "S00.baseline",
    bilingual: { profile: "SAFE_PAID_BILINGUAL_V1", requiredLocales: ["ru", "en"], status: "IN_PROGRESS" },
    ownerMinimal: { releaseProfile: "SAFE_PAID_BILINGUAL_V1", ownerInputsStatus: "NOT_STARTED", draftUploadStatus: "DRY_RUN" },
    stages: stageDefinitions.map(item => ({ id: item.stage_id, name: item.stage_name, status: "NOT_STARTED", criteria: [
      ...foundationCriterionIds(item.stage_id).map(id => ({ id, status: "OPEN" })),
      ...(item.stage_id === "S00" ? [] : sources.map(source => ({ id: `${item.stage_id}.${source.requirement_id}`, status: "OPEN" }))),
    ] })),
    resume: { firstOpenCriterion: "S00.baseline", nextAction: "Implement", contextFiles: ["docs/mobile/STATUS.md"] },
  };
  return { state, sources, stageDefinitions, schemas,
    traceability: { version: "12.0", generatedAt: timestamp, requirements: sources.map(source => ({
      id: source.requirement_id, source: source.binding_source, summary: source.summary, priority: source.priority, status: "OPEN",
    })) },
    mapping: { version: "12.0", requirements: sources.map(source => ({ id: source.requirement_id, implementationStages: ["S01"], validationStages: ["S02"], rationale: "Implementation followed by parity validation" })) },
  };
}
describe("V12 schema subset", () => {
  it("validates the actual pinned state schema and rejects legacy/unknown fields", () => {
    expect(validateSchema(schemas.state, fixture().state)).toEqual([]);
    expect(validateSchema(schemas.state, { ...fixture().state, currentStage: "S00" })).toContain("$.currentStage: additional property");
  });
  it.each(["2026-02-30T00:00:00Z", "2026-09-05", "2026-09-05T24:00:00Z", "2026-09-05T00:00:00+24:00"])("rejects invalid date %s", value => {
    expect(validateSchema({ type: "string", format: "date-time" }, value)).not.toEqual([]);
  });
  it("uses structural const equality, nullable values and Unicode lengths", () => {
    expect(validateSchema({ const: ["ru", "en"] }, ["ru", "en"])).toEqual([]);
    expect(validateSchema({ type: ["string", "null"], format: "date-time" }, null)).toEqual([]);
    expect(validateSchema({ type: "string", minLength: 2 }, "🌍")).not.toEqual([]);
    expect(validateSchema({ type: "number", minimum: 0, maximum: 100 }, Infinity)).not.toEqual([]);
  });
  it("fails closed for unsupported schema validation", () => {
    expect(() => validateSchema({ type: "string", pattern: ".*" }, "x")).toThrow("unsupported keyword");
  });
});
describe("requirement CSV", () => {
  it("preserves quotes, newlines, commas and Russian text through projection", () => {
    const rows = [{ id: "BIL-001", text: 'Русский, "English"\nnext line' }];
    expect(parseCsv(formatCsv(rows, ["id", "text"]))).toEqual(rows);
    const source = readFileSync(new URL("../../docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv", import.meta.url), "utf8");
    expect(parseCsv(source)).toHaveLength(342);
  });
  it.each(['id,id\na,b\n', 'id,text\na,"open', 'id,text\na,b,c', 'id,text\na,"b"oops'])
    ("rejects malformed CSV %s", source => expect(() => parseCsv(source)).toThrow());
});
describe("execution truth", () => {
  it("accepts complete honest open ledgers without granting release readiness", () => {
    expect(validateExecution(fixture())).toMatchObject({ pass: true, releaseReady: false, internalRequirementsPassed: false });
  });
  it.each(["requirements", "mapping", "stages"])("rejects a missing %s identity", kind => {
    const input = fixture();
    (kind === "requirements" ? input.traceability.requirements : kind === "mapping" ? input.mapping.requirements : input.state.stages).pop();
    expect(validateExecution(input).pass).toBe(false);
  });
  it("rejects duplicate identities and empty or prematurely complete stages", () => {
    const input = fixture();
    input.state.stages[0].criteria = [];
    input.state.stages[1].status = "COMPLETE";
    input.traceability.requirements.push(input.traceability.requirements[0]);
    const { errors } = validateExecution(input);
    expect(errors).toEqual(expect.arrayContaining(["requirements: duplicate identity", "S00: empty criteria", "S01: incomplete criteria"]));
  });
  it("rejects a fabricated pass and source summary edits", () => {
    const input = fixture();
    input.traceability.requirements[0].status = "PASSED";
    input.traceability.requirements[0].summary = "Watered down requirement";
    const { errors } = validateExecution(input);
    expect(errors.some(error => error.includes("source metadata drift"))).toBe(true);
    expect(errors.some(error => error.includes("incomplete implementation or validation milestones"))).toBe(true);
    expect(errors.some(error => error.includes("incomplete implementation/test/evidence"))).toBe(true);
  });
  it("requires validation milestones after implementation and evidence for each", () => {
    const input = fixture();
    const requirement = input.traceability.requirements[0];
    Object.assign(requirement, { status: "PASSED", implementationFiles: ["src/a.ts"], tests: ["src/a.test.ts"], evidence: ["docs/evidence.json"], commit });
    input.state.stages[1].criteria.find(item => item.id === "S01.CANON-001").status = "PASSED";
    expect(validateExecution(input).errors).toEqual(expect.arrayContaining([
      "CANON-001: incomplete implementation or validation milestones",
      "S01.CANON-001: missing evidence, source commit or validation date",
    ]));
  });
  it("does not allow waiving bilingual work or classifying build errors as owner work", () => {
    const input = fixture();
    input.traceability.requirements[1].status = "WAIVED";
    input.state.stages[1].criteria[0].status = "BLOCKED_EXTERNAL";
    input.state.stages[1].criteria[0].notes = "external:build:fix the compiler";
    expect(validateExecution(input).pass).toBe(false);
  });
  it("skips a documented external criterion when selecting independent internal work", () => {
    const { state } = fixture();
    state.stages[0].criteria[0].status = "BLOCKED_EXTERNAL";
    expect(firstOpenCriterion(state.stages)).toEqual({ stageId: "S01", criterionId: "S01.architecture" });
  });
  it("rejects stale resume pointers, invalid stage maps and premature readiness", () => {
    const input = fixture();
    input.state.currentStageId = "S02";
    input.mapping.requirements[0].validationStages = ["S41"];
    input.state.status = "READY_INTERNAL";
    const { errors } = validateExecution(input);
    expect(errors).toContain("Premature product readiness status");
    expect(errors.some(error => error.includes("resume pointers"))).toBe(true);
    expect(errors).toContain("CANON-001: invalid validationStages");
  });
  it.each([null, { id: "CANON-001", rationale: 1, implementationStages: [], validationStages: [] },
    { id: "CANON-001", rationale: "x", implementationStages: {}, validationStages: [] }])
    ("returns a structured failure for malformed map row %s", row => {
      const input = fixture(); input.mapping.requirements[0] = row;
      expect(validateExecution(input)).toMatchObject({ pass: false, errors: ["Malformed stage requirement map row"] });
    });
  it("requires foundation acceptance and documented stage entry", () => {
    const input = fixture();
    input.state.stages[1].criteria.shift();
    input.state.stages[2].status = "IN_PROGRESS";
    expect(validateExecution(input).errors).toEqual(expect.arrayContaining([
      "S01: missing foundation criterion", "S02: unmet predecessor without documented parallel-safe work",
    ]));
  });
  it("does not let nested flags manufacture readiness or owner approval", () => {
    const input = fixture();
    input.state.bilingual.status = "READY_FOR_SUBMISSION";
    input.state.ownerMinimal.ownerInputsStatus = "OWNER_APPROVED";
    expect(validateExecution(input).errors).toEqual(expect.arrayContaining([
      "Premature bilingual/moderation readiness", "Owner approval requires the later independently verified approval gate",
    ]));
  });
  it("can express completed internal preparation while preserving a concrete external dependency", () => {
    const input = fixture();
    for (const stage of input.state.stages) {
      stage.status = "COMPLETE";
      for (const criterion of stage.criteria) Object.assign(criterion, { status: "PASSED", evidence: ["prepared.json"], commit, lastValidatedAt: timestamp });
    }
    for (const requirement of input.traceability.requirements) Object.assign(requirement, {
      status: "PASSED", implementationFiles: ["prepared.ts"], tests: ["prepared.test.ts"], evidence: ["prepared.json"], commit,
    });
    const external = input.state.stages[2].criteria.find(item => item.id === "S02.BIL-001");
    external.status = "BLOCKED_EXTERNAL"; external.notes = "external:legal:Approve the completed bilingual legal dossier";
    input.state.stages[2].status = "BLOCKED_EXTERNAL";
    Object.assign(input.traceability.requirements[1], { status: "BLOCKED_EXTERNAL", notes: external.notes });
    Object.assign(input.state, { status: "COMPLETE_WITH_EXTERNAL_BLOCKERS", currentStageId: null, currentCriterionId: null });
    input.state.resume.firstOpenCriterion = null;
    expect(validateExecution(input)).toMatchObject({ pass: true, allInternalComplete: true, internalRequirementsPassed: false, releaseReady: false });
    input.state.stages[2].criteria[0].status = "OPEN";
    expect(validateExecution(input).pass).toBe(false);
  });
});
