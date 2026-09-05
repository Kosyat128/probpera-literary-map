import { validateSchema } from "./schema.mjs";

const sha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const list = value => Array.isArray(value) && value.length > 0;
const unique = values => new Set(values).size === values.length;
const externalNote = value => typeof value === "string" &&
  /^external:(?:credentials|signing|store_account|legal|license|manual_review|owner_approval):\S.+/.test(value);
export const stageCriterionId = (stageId, requirementId) => `${stageId}.${requirementId}`;
export const foundationCriterionIds = stageId => stageId === "S00" ? ["S00.baseline"] :
  stageId === "S01" ? ["S01.architecture", "S01.traceability"] : [`${stageId}.acceptance`];
export function firstOpenCriterion(stages) {
  for (const stage of stages) {
    const criterion = stage.criteria.find(item => !["PASSED", "BLOCKED_EXTERNAL"].includes(item.status));
    if (criterion) return { stageId: stage.id, criterionId: criterion.id };
  }
  return null;
}

// Structural validity, stage progress and release readiness are separate results.
// Historical stage evidence is retained; global PASSED claims also need current
// evidence verification in the CLI. This pure function never grants approval.
export function validateExecution({ state, traceability, mapping, sources, stageDefinitions, schemas }) {
  const errors = [
    ...validateSchema(schemas.state, state).map(error => `state${error}`),
    ...validateSchema(schemas.traceability, traceability).map(error => `traceability${error}`),
  ];
  if (errors.length) return { pass: false, errors, releaseReady: false };
  const fail = message => errors.push(message);
  if (!sources.length || !stageDefinitions.length) fail("Empty canonical definitions");
  const expectedIds = sources.map(item => item.requirement_id);
  const stageIds = stageDefinitions.map(item => item.stage_id);
  const actualIds = traceability.requirements.map(item => item.id);
  const rows = mapping?.requirements;
  if (mapping?.version !== "12.0" || !Array.isArray(rows)) {
    return { pass: false, errors: ["Invalid stage requirement map"], releaseReady: false };
  }
  if (rows.some(row => !row || typeof row.id !== "string" || typeof row.rationale !== "string" ||
      !["implementationStages", "validationStages"].every(key => Array.isArray(row[key]) && row[key].every(id => typeof id === "string")))) {
    return { pass: false, errors: ["Malformed stage requirement map row"], releaseReady: false };
  }
  const equalSet = (actual, expected, label) => {
    if (!unique(actual)) fail(`${label}: duplicate identity`);
    const missing = expected.filter(id => !actual.includes(id));
    const extra = actual.filter(id => !expected.includes(id));
    if (missing.length) fail(`${label}: missing ${missing.join(", ")}`);
    if (extra.length) fail(`${label}: unknown ${extra.join(", ")}`);
  };
  equalSet(actualIds, expectedIds, "requirements");
  equalSet(rows.map(item => item.id), expectedIds, "mapping");
  equalSet(state.stages.map(stage => stage.id), stageIds, "stages");
  if (state.stages.some((stage, index) => stage.id !== stageIds[index])) fail("Noncanonical stage order");
  if (!sha(state.baseSha) || !sha(state.headSha)) fail("Source checkpoints need full Git SHAs");
  if (state.branch !== "codex/literary-planet-v12-bilingual-final-autopilot") fail("Unexpected execution branch");
  const criteria = state.stages.flatMap(stage => stage.criteria);
  if (!unique(criteria.map(item => item.id))) fail("Duplicate criterion identity");
  const byCriterion = new Map(criteria.map(item => [item.id, item]));
  const byMapping = new Map(rows.map(item => [item.id, item]));
  for (const row of rows) {
    for (const key of ["implementationStages", "validationStages"]) {
      if (!list(row[key]) || !unique(row[key]) || row[key].some(id => !stageIds.includes(id))) {
        fail(`${row.id}: invalid ${key}`);
      }
    }
    if (!row.rationale?.trim()) fail(`${row.id}: missing mapping rationale`);
  }
  for (const stage of state.stages) {
    const definition = stageDefinitions.find(item => item.stage_id === stage.id);
    if (definition && definition.stage_name !== stage.name) fail(`${stage.id}: noncanonical name`);
    if (!stage.criteria.length) fail(`${stage.id}: empty criteria`);
    if (foundationCriterionIds(stage.id).some(id => !byCriterion.has(id))) fail(`${stage.id}: missing foundation criterion`);
    const expectedCriteria = new Set([...foundationCriterionIds(stage.id), ...rows.filter(row =>
      row.implementationStages.includes(stage.id) || row.validationStages.includes(stage.id)).map(row => stageCriterionId(stage.id, row.id))]);
    if (stage.criteria.some(criterion => !expectedCriteria.has(criterion.id))) fail(`${stage.id}: unknown criterion identity`);
    const predecessors = state.stages.slice(0, state.stages.indexOf(stage));
    if (stage.status !== "NOT_STARTED" && predecessors.some(item => item.status !== "COMPLETE")) {
      const exception = state.verificationCache?.parallelSafeStages?.[stage.id];
      if (!exception || typeof exception.reason !== "string" || !exception.reason.trim() ||
          !list(exception.evidence) || exception.evidence.some(filename => typeof filename !== "string")) {
        fail(`${stage.id}: unmet predecessor without documented parallel-safe work`);
      }
    }
    if (stage.status === "COMPLETE" && stage.criteria.some(item => item.status !== "PASSED")) fail(`${stage.id}: incomplete criteria`);
    if (stage.status === "BLOCKED_EXTERNAL" && stage.criteria.some(item => !["PASSED", "BLOCKED_EXTERNAL"].includes(item.status))) fail(`${stage.id}: internal work remains`);
    if (stage.status === "NOT_STARTED" && stage.criteria.some(item => item.status !== "OPEN")) fail(`${stage.id}: unexpected progress`);
    for (const criterion of stage.criteria) {
      if (!criterion.id.startsWith(`${stage.id}.`)) fail(`${criterion.id}: wrong stage namespace`);
      if (["PASSED", "BLOCKED_EXTERNAL"].includes(criterion.status) && (!list(criterion.evidence) || !sha(criterion.commit) || !criterion.lastValidatedAt)) {
        fail(`${criterion.id}: missing evidence, source commit or validation date`);
      }
      if (criterion.lastValidatedAt && validateSchema({ type: "string", format: "date-time" }, criterion.lastValidatedAt).length) {
        fail(`${criterion.id}: invalid validation date`);
      }
      if (criterion.status === "BLOCKED_EXTERNAL" && !externalNote(criterion.notes)) {
        fail(`${criterion.id}: missing specific external dependency`);
      }
    }
  }
  for (const item of traceability.requirements) {
    const source = sources.find(row => row.requirement_id === item.id);
    if (source && [
      ["source", "binding_source"], ["summary", "summary"], ["priority", "priority"],
    ].some(([key, sourceKey]) => item[key] !== source[sourceKey])) fail(`${item.id}: immutable source metadata drift`);
    if (source?.platforms && JSON.stringify(item.platforms) !== JSON.stringify(source.platforms.split(";"))) fail(`${item.id}: platform scope drift`);
    const row = byMapping.get(item.id);
    const milestoneStages = [...new Set([...(row?.implementationStages ?? []), ...(row?.validationStages ?? [])])];
    const milestones = milestoneStages.map(stage => byCriterion.get(stageCriterionId(stage, item.id)));
    if (milestones.some(criterion => !criterion)) fail(`${item.id}: missing stage milestone`);
    if (item.status === "WAIVED") fail(`${item.id}: V12 mandatory requirements cannot be waived`);
    if (item.status === "BLOCKED_EXTERNAL" && !externalNote(item.notes)) fail(`${item.id}: unclassified external dependency`);
    if (["PASSED", "BLOCKED_EXTERNAL"].includes(item.status)) {
      if (!list(item.implementationFiles) || !list(item.tests) || !list(item.evidence) || !sha(item.commit)) fail(`${item.id}: incomplete implementation/test/evidence/commit references`);
      const allowed = item.status === "PASSED" ? ["PASSED"] : ["PASSED", "BLOCKED_EXTERNAL"];
      if (!milestones.length || milestones.some(criterion => !allowed.includes(criterion?.status))) fail(`${item.id}: incomplete implementation or validation milestones`);
    }
  }
  const open = firstOpenCriterion(state.stages);
  if (state.currentStageId !== (open?.stageId ?? null) || state.currentCriterionId !== (open?.criterionId ?? null) ||
      state.resume.firstOpenCriterion !== (open?.criterionId ?? null)) fail("Current/resume pointers do not identify first internal open criterion");
  if (!state.resume.nextAction.trim() || !list(state.resume.contextFiles)) fail("Incomplete resume context");
  const allPassed = traceability.requirements.every(item => item.status === "PASSED") &&
    state.stages.every(stage => stage.status === "COMPLETE");
  const allInternalComplete = traceability.requirements.every(item => ["PASSED", "BLOCKED_EXTERNAL"].includes(item.status)) &&
    state.stages.every(stage => ["COMPLETE", "BLOCKED_EXTERNAL"].includes(stage.status));
  const externalCompletion = state.status === "COMPLETE_WITH_EXTERNAL_BLOCKERS";
  if (!["IN_PROGRESS", "FAILED"].includes(state.status) && !(externalCompletion ? allInternalComplete && !allPassed : allPassed)) fail("Premature product readiness status");
  const unready = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED_INTERNAL", "BLOCKED_EXTERNAL"];
  if (!allPassed && ((state.bilingual?.status && !unready.includes(state.bilingual.status)) ||
      (state.moderation?.status && !unready.includes(state.moderation.status)))) fail("Premature bilingual/moderation readiness");
  if (state.ownerMinimal?.ownerInputsStatus === "OWNER_APPROVED") fail("Owner approval requires the later independently verified approval gate");
  if (state.bilingual?.profile !== "SAFE_PAID_BILINGUAL_V1" || JSON.stringify(state.bilingual?.requiredLocales) !== '["ru","en"]' ||
      state.ownerMinimal?.releaseProfile !== "SAFE_PAID_BILINGUAL_V1") fail("Required bilingual/safe-release contract is missing");
  // User authorization permanently limits this execution to preparation.
  if (["SUBMITTED", "APPROVED", "RELEASED"].includes(state.status) ||
      ["SUBMITTED", "APPROVED"].includes(state.moderation?.status)) fail("Unauthorized production/reviewer state");
  if (state.ownerMinimal?.draftUploadStatus && !["DISABLED", "DRY_RUN", "READY", "BLOCKED_EXTERNAL"].includes(state.ownerMinimal.draftUploadStatus)) {
    fail("Draft upload not authorized in this execution");
  }
  return { pass: errors.length === 0, errors, releaseReady: false, internalRequirementsPassed: errors.length === 0 && allPassed,
    requirementCount: actualIds.length, bilingualCount: actualIds.filter(id => id.startsWith("BIL-")).length,
    allInternalComplete: errors.length === 0 && allInternalComplete, completedStages: state.stages.filter(stage => stage.status === "COMPLETE").map(stage => stage.id), firstOpen: open };
}
