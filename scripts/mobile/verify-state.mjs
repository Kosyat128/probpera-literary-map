import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, formatCsv } from "./csv.mjs";
import { git, repositoryFile, verifyEvidenceRecord } from "./evidence.mjs";
import { routeStage, V12_INPUT_PIN, verifyRequirements } from "./requirements.mjs";
import { validateExecution } from "./state.mjs";

export async function verifyExecutionFiles(root) {
  const inputRoot = path.join(root, "docs/mobile/requirements/v12");
  const integrity = await verifyRequirements(inputRoot, V12_INPUT_PIN);
  if (!integrity.pass) return { pass: false, releaseReady: false, errors: integrity.failures };
  const text = async filename => (await repositoryFile(root, filename)).bytes.toString("utf8");
  const json = async filename => JSON.parse(await text(filename));
  const [state, traceability, mapping, sources, stageDefinitions, stateSchema, traceabilitySchema] = await Promise.all([
    json("docs/mobile/AUTOPILOT_STATE.json"), json("docs/mobile/REQUIREMENTS_TRACEABILITY.json"), json("docs/mobile/STAGE_REQUIREMENT_MAP.json"),
    text("docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv").then(parseCsv),
    text("docs/mobile/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv").then(parseCsv),
    json("docs/mobile/requirements/v12/43_AUTOPILOT_STATE_SCHEMA.json"), json("docs/mobile/requirements/v12/57_REQUIREMENTS_TRACEABILITY_SCHEMA.json"),
  ]);
  const result = validateExecution({ state, traceability, mapping, sources, stageDefinitions, schemas: { state: stateSchema, traceability: traceabilitySchema } });
  if (!result.pass) return result;
  const errors = [], historicalStaleInputs = new Set(), cache = new Map();
  if (sources.length !== 342 || result.bilingualCount !== 107 || state.stages.length !== 41) errors.push("V12 completeness count mismatch");
  if (state.requirementsHash !== V12_INPUT_PIN.checksumFileSha256) errors.push("State input pin mismatch");
  for (const commit of [state.baseSha, state.headSha]) {
    try { git(root, ["merge-base", "--is-ancestor", commit, "HEAD"]); }
    catch { errors.push(`Checkpoint is not an ancestor: ${commit}`); }
  }
  async function evidenceFor(item, requirement = false) {
    for (const filename of item.evidence ?? []) {
      try {
        const key = `${filename}:${item.commit}:${requirement}`;
        if (!cache.has(key)) {
          const record = await json(filename);
          cache.set(key, { record, result: await verifyEvidenceRecord(root, record, { sourceCommit: item.commit, currentInputs: requirement }) });
        }
        const checked = cache.get(key);
        if (!checked.record[requirement ? "requirementIds" : "criterionIds"]?.includes(item.id)) throw new Error("Evidence covers a different scope");
        if (!checked.result.pass) throw new Error(checked.result.errors.join("; "));
        checked.result.staleInputs.forEach(filename => historicalStaleInputs.add(filename));
        if (requirement) {
          const covered = new Set(checked.record.sourceFiles.map(reference => reference.path));
          if ([...item.implementationFiles, ...item.tests].some(filename => !covered.has(filename))) throw new Error("Implementation/test inputs missing from evidence identity");
        }
        if (item.status === "BLOCKED_EXTERNAL" && (checked.record.scope !== "internal-preparation" ||
            typeof checked.record.ownerAction !== "string" || !checked.record.ownerAction.trim())) throw new Error("External dependency lacks completed preparation and concrete owner action");
      } catch (error) { errors.push(`${item.id}/${filename}: ${error.message}`); }
    }
  }
  for (const stage of state.stages) {
    for (const criterion of stage.criteria.filter(item => ["PASSED", "BLOCKED_EXTERNAL"].includes(item.status))) await evidenceFor(criterion);
  }
  for (const requirement of traceability.requirements.filter(item => ["PASSED", "BLOCKED_EXTERNAL"].includes(item.status))) await evidenceFor(requirement, true);
  for (const filename of state.resume.contextFiles) {
    try { await repositoryFile(root, filename); }
    catch (error) { errors.push(`resume context: ${error.message}`); }
  }
  const activeRoute = state.currentStageId ? routeStage(await json("docs/mobile/requirements/v12/95_STAGE_DOCUMENT_ROUTING.json"), state.currentStageId) : null;
  for (const filename of state.resume.contextFiles.filter(filename => filename.startsWith("docs/mobile/requirements/v12/"))) {
    if (!activeRoute?.documents.includes(filename.slice("docs/mobile/requirements/v12/".length))) errors.push("Resume context includes an unrouted requirement document");
  }
  for (const exception of Object.values(state.verificationCache?.parallelSafeStages ?? {})) {
    for (const filename of exception.evidence ?? []) {
      try { await repositoryFile(root, filename); }
      catch (error) { errors.push(`parallel-safe evidence: ${error.message}`); }
    }
  }
  if (["baseEditionEnglishCoverage", "uiCoverageRu", "uiCoverageEn"].some(key => state.bilingual?.[key] !== undefined) || state.bilingual?.metricsReport) {
    errors.push("Coverage certification requires the later measured-scope gate; S01 leaves unmeasured metrics absent");
  }
  const projection = projectTraceabilityCsv(traceability, sources);
  if ((await text("docs/mobile/REQUIREMENTS_TRACEABILITY.csv")).replaceAll("\r\n", "\n") !== projection) errors.push("CSV projection is stale");
  return { ...result, pass: errors.length === 0, errors, historicalStaleInputs: [...historicalStaleInputs],
    releaseActionsAuthorized: false, requirementsHash: state.requirementsHash };
}
export function projectTraceabilityCsv(traceability, sources) {
  const byId = new Map(traceability.requirements.map(item => [item.id, item]));
  return formatCsv(sources.map(source => {
    const item = byId.get(source.requirement_id);
    return { ...source, status: item.status, implementation: (item.implementationFiles ?? []).join(";"),
      tests: (item.tests ?? []).join(";"), evidence: (item.evidence ?? []).join(";"), commit: item.commit ?? "" };
  }), ["requirement_id", "category", "priority", "platforms", "summary", "binding_source", "status", "implementation", "tests", "evidence", "commit"]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyExecutionFiles(fileURLToPath(new URL("../../", import.meta.url)));
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ pass: false, releaseReady: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
