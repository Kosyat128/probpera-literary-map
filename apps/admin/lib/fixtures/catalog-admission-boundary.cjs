const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { catalogCandidateFreshnessReceipt } = require('./catalog-review-freshness-boundary.cjs');
const copy = value => value === undefined ? undefined : structuredClone(value);
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Controlled installed-SDK transport only. Committed effects precede injected
// lost acknowledgements. Native SQL evidence independently covers real DB rules.
function createCatalogAdmissionBoundary(input) {
  const operations = new Map(), currentByEntity = new Map(), events = [], faults = new Map(), errors = [];
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 9, 30, 10, 0, ++tick)).toISOString();
  const fault = (name, mode = 'lost-ack') => faults.set(name, mode);
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (code, message) => ({ code, message });
  const key = (type, entity) => `${type}:${entity}`;
  const project = (row, fields) => row === null ? null : Object.fromEntries(fields.map(field => [field, copy(row[field])]));
  const workColumns = ['id','title','original_title','first_published','original_language','editorial_status','updated_at'];
  const ruColumns = ['id','title','description','source_language','source_urls','editorial_status','updated_at','metadata'];
  const enColumns = ['id','title','description','source_urls','translation_method','editorial_status','updated_at','metadata'];
  function serverSeed(type, entity, expected) {
    const value = input.getSeed(type, entity); if (!value) throw fail('P0002', 'Controlled entity not found');
    if (type === 'literary_work') {
      const sources = copy(value.sources).sort((a,b) => a.id.localeCompare(b.id));
      const selected = sources.find(row => row.source_url === expected.titleSource.source_url && row.provider === expected.titleSource.provider &&
        (row.retrieved_at || null) === (expected.titleSource.retrieved_at || null));
      if (!selected) throw fail('40001', 'Controlled selected title source changed');
      return { version: 1, work: copy(value.work), russian: copy(value.russian), english: copy(value.english), sources, selectedTitleSourceId: selected.id };
    }
    return { version: 1, catalogFields: copy(value.catalogFields), override: copy(value.override) };
  }
  function expectedFor(seed, type) {
    if (type === 'literary_work') {
      const selected = seed.sources.find(row => row.id === seed.selectedTitleSourceId);
      return { version: 1, work: project(seed.work, workColumns), russian: project(seed.russian, ruColumns), english: project(seed.english, enColumns),
        titleSource: project(selected, ['provider','source_url','retrieved_at']) };
    }
    return { version: 1, catalogFields: copy(seed.catalogFields), override: project(seed.override, ['id','fields','updated_at']) };
  }
  const receipt = (operation, patch = {}) => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId, operationId: operation.operationId,
    entityType: operation.entityType, entityId: operation.entityId, actorId: input.actorId, provider: operation.provider,
    sourceHash: operation.sourceHash, rawSeedHash: operation.rawSeedHash, intentHash: operation.intentHash,
    configurationHash: operation.configurationHash, configuration: copy(operation.configuration), sourceRevision: copy(operation.sourceRevision),
    targetRevision: copy(operation.targetRevision), jobVersion: String(operation.version), phase: operation.phase, canExecute: false, canDispatch: false,
    replayed: false, providerCalls: operation.calls.length, pendingCallId: operation.calls.find(call => !call.response)?.id || null,
    blockReason: operation.blockReason, resumeCursor: copy(operation.resumeCursor), result: copy(operation.result), ...patch });
  function targetChanged(operation) {
    const now = serverSeed(operation.entityType, operation.entityId, operation.expectedState);
    return JSON.stringify(now) !== JSON.stringify(operation.rawSeed);
  }
  function view(operation) {
    return receipt(operation, { replayed: true, ...(operation.phase !== 'finished' && operation.calls.some(call => !call.response)
      ? { phase: 'blocked', blockReason: 'provider_outcome_unknown' } : operation.phase !== 'finished' && operation.cancelRequested
        ? { phase: 'blocked', blockReason: 'operation_stopped' } : {}) });
  }
  function lookup(args) {
    const operation = operations.get(args.p_operation_id); if (!operation) throw fail('P0002', 'Controlled operation missing');
    assert.equal(operation.jobId, args.p_job_id); assert.equal(operation.itemId, args.p_item_id); return operation;
  }
  const handles = name => /^(?:begin_catalog_translation_operation|record_catalog_translation_operation_dispatch|record_catalog_translation_operation_response|finish_catalog_translation_operation|reconcile_catalog_translation_operation|catalog_translation_operation_ready|get_catalog_translation_operation_artifacts|get_catalog_translation_candidate_freshness)$/u.test(name);
  async function execute(name, args) {
    if(name==='get_catalog_translation_candidate_freshness')return catalogCandidateFreshnessReceipt(args,{
      findDraft(request){const direct=input.getPrivateCandidate(request.p_entity_type,request.p_entity_id);if(direct?.id===request.p_draft_id)return direct;
        const linked=[...operations.values()].find(operation=>operation.result?.draftId===request.p_draft_id);return linked?input.getPrivateCandidate(linked.entityType,linked.entityId):null;},
      findOperation(draft){return[...operations.values()].find(operation=>operation.result?.draftId===draft.id)||null;},
      isSourceCurrent(operation,request){return!targetChanged(operation)&&(operation.entityType!=='country'||equal(operation.rawSeed.catalogFields,request.p_catalog_source_fields));},
    });
    if (name === 'catalog_translation_operation_ready') return true;
    if (name === 'reconcile_catalog_translation_operation') {
      const id = args.p_operation_id || currentByEntity.get(key(args.p_entity_type, args.p_entity_id)), operation = id ? operations.get(id) : null;
      if (operation && (operation.entityType !== args.p_entity_type || operation.entityId !== args.p_entity_id)) throw fail('40001', 'Controlled reconcile entity mismatch');
      return operation ? view(operation) : null;
    }
    if (name === 'begin_catalog_translation_operation') {
      assert.ok(['literary_work', 'country'].includes(args.p_entity_type));
      const identity = key(args.p_entity_type, args.p_entity_id), priorId = currentByEntity.get(identity);
      if (priorId) {
        const prior = operations.get(priorId);
        if (prior.phase !== 'finished') { const previous = view(prior); return { ...previous, phase: 'blocked', blockReason: previous.blockReason || 'operation_in_progress' }; }
      }
      const rawSeed = serverSeed(args.p_entity_type, args.p_entity_id, args.p_expected_state);
      if (bytes(rawSeed) > 4 * 1024 * 1024) throw fail('22023', 'Controlled full server seed too large');
      if (JSON.stringify(expectedFor(rawSeed, args.p_entity_type)) !== JSON.stringify(args.p_expected_state)) {
        assert.deepEqual(args.p_expected_state, expectedFor(rawSeed, args.p_entity_type), 'Caller expected state must match actual controlled server projection');
      }
      const operation = { jobId: args.p_job_id, itemId: args.p_item_id, operationId: args.p_operation_id, entityType: args.p_entity_type,
        entityId: args.p_entity_id, provider: args.p_provider, sourceHash: args.p_source_hash, rawSeed, rawSeedHash: sha(rawSeed),
        sourceSnapshot: copy(args.p_source_snapshot), sourceRevision: copy(args.p_source_revision), targetRevision: copy(args.p_target_revision),
        expectedState: copy(args.p_expected_state), configuration: copy(args.p_configuration), currentCursor: copy(args.p_current_cursor || {}),
        nextCursor: copy(args.p_resume_cursor || {}), resumeCursor: copy(args.p_current_cursor || {}), intentHash: sha(args),
        configurationHash: sha(args.p_configuration), version: 1, phase: 'running', blockReason: null, result: null, calls: [], candidate: null };
      operations.set(operation.operationId, operation); currentByEntity.set(identity, operation.operationId); return receipt(operation, { canExecute: true });
    }
    if (name === 'record_catalog_translation_operation_dispatch') {
      const operation = lookup(args), same = operation.calls.find(call => call.id === args.p_call_id); if (same) return view(operation);
      assert.equal(operation.phase, 'running'); assert.equal(operation.calls.some(call => !call.response), false);
      if (operation.cancelRequested) throw fail('40001', 'Controlled operation stopped before dispatch');
      if (targetChanged(operation)) throw fail('40001', 'Controlled full source/target changed before dispatch');
      assert.ok(operation.calls.length < 4); assert.equal(args.p_provider, operation.provider);
      operation.calls.push({ id: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass, requestHash: args.p_request_hash,
        dispatchedAt: stamp(), response: null, artifact: null }); operation.version++; return receipt(operation, { canDispatch: true });
    }
    if (name === 'record_catalog_translation_operation_response') {
      const operation = lookup(args), metadata = args.p_metadata;
      assert.deepEqual(Object.keys(args.p_response_artifact).sort(), ['body', 'version']); assert.equal(args.p_response_artifact.version, 1);
      if (bytes(args.p_response_artifact) > 1024 * 1024 || operation.calls.reduce((sum, call) => sum + (call.artifact ? bytes(call.artifact) : 0), 0) + bytes(args.p_response_artifact) > 4 * 1024 * 1024) throw fail('22023', 'Controlled private response artifact too large');
      const call = operation.calls.find(value => value.id === metadata.callId); assert.ok(call, 'Response needs a real prior dispatch');
      assert.equal(metadata.provider, call.provider); assert.equal(metadata.model, call.model); assert.equal(metadata.pass, call.pass);
      if (call.response) { assert.deepEqual(call.response, metadata); assert.deepEqual(call.artifact, args.p_response_artifact); return view(operation); }
      call.response = copy(metadata); call.artifact = copy(args.p_response_artifact); call.receivedAt = stamp(); operation.version++; return receipt(operation);
    }
    if (name === 'get_catalog_translation_operation_artifacts') {
      const operation = lookup(args); assert.equal(args.p_intent_hash, operation.intentHash); assert.equal(args.p_source_hash, operation.sourceHash);
      assert.equal(args.p_entity_type, operation.entityType); assert.equal(args.p_entity_id, operation.entityId);
      return { version: 1, receipt: view(operation), expectedState: copy(operation.expectedState), rawSeed: copy(operation.rawSeed),
        sourceSnapshot: copy(operation.sourceSnapshot), sourceRevision: copy(operation.sourceRevision), targetRevision: copy(operation.targetRevision), configuration: copy(operation.configuration),
        calls: operation.calls.map(call => ({ requestHash: call.requestHash, metadata: { callId: call.id, provider: call.provider, model: call.model, pass: call.pass,
          dispatchRecordedAt: call.dispatchedAt, responseReceivedAt: call.response ? call.receivedAt : null, httpStatus: call.response?.httpStatus ?? null,
          requestId: call.response?.requestId ?? null, responseId: call.response?.responseId ?? null, inputTokens: call.response?.inputTokens ?? null,
          outputTokens: call.response?.outputTokens ?? null }, responseArtifact: copy(call.artifact) })), candidate: copy(operation.candidate) };
    }
    if (name === 'finish_catalog_translation_operation') {
      const operation = lookup(args); if (operation.phase === 'finished') return view(operation);
      assert.equal(operation.calls.some(call => !call.response), false, 'An unknown dispatch cannot be completed/released');
      const candidate = args.p_candidate;
      if (candidate) {
        if (bytes(candidate) > 1024 * 1024) throw fail('22023', 'Controlled complete candidate too large');
        const translator = operation.calls.find(call => call.id === candidate.translatorCallId), reviewer = operation.calls.find(call => call.id === candidate.reviewerCallId);
        assert.ok(translator?.response); assert.equal(translator.pass, 'translation');
        if (operation.configuration.twoPassReview) assert.ok(operation.calls.some(call => call.pass === 'review' && call.response));
        if (candidate.reviewerCallId !== null) { assert.ok(reviewer?.response); assert.ok(['review', 'repair'].includes(reviewer.pass)); }
        operation.candidate = copy(candidate);
        const changed = targetChanged(operation), existing = input.getPrivateCandidate(operation.entityType, operation.entityId);
        let draft = null;
        if (!existing) {
          draft = { id: crypto.randomUUID(), version: 1, entityType: operation.entityType, entityId: operation.entityId, targetLocale: 'en', humanReview: 'pending',
            sourceHash: operation.sourceHash, candidateHash: sha(candidate), sourceSnapshot: copy(operation.sourceSnapshot), sourceRevision: copy(operation.sourceRevision),
            targetRevision: copy(operation.targetRevision), payload: copy(candidate.payload), provenance: copy(candidate.provenance), createdAt: stamp(), createdBy: input.actorId };
          input.setPrivateCandidate(operation.entityType, operation.entityId, draft);
        }
        operation.result = { state: operation.cancelRequested ? 'cancelled' : draft && !changed ? 'translated' : 'conflict',
          errorCode: operation.cancelRequested || draft && !changed ? null : 'write_conflict', persistence: draft ? 'working-draft' : 'private-artifact',
          draftId: draft?.id || null, draftVersion: draft?.version || null, draftUpdatedAt: draft?.createdAt || null, candidateHash: sha(candidate), publication: 'unchanged', humanReview: 'pending' };
      } else {
        operation.result = { state: ({ dead_letter: 'failed', succeeded: 'translated' })[args.p_outcome.status] || args.p_outcome.status || 'failed',
          errorCode: args.p_outcome.errorCode || null, persistence: 'none', draftId: null, draftVersion: null, draftUpdatedAt: null, candidateHash: null, publication: 'unchanged', humanReview: 'unchanged' };
      }
      operation.phase = 'finished'; operation.version++; operation.resumeCursor = copy(args.p_outcome.status === 'skipped' && args.p_outcome.providerCalls === 0 ? operation.currentCursor : operation.nextCursor); return receipt(operation);
    }
    throw new Error(`Unsupported controlled catalog RPC ${name}`);
  }
  async function fetchRpc(name, args) {
    assert.ok(handles(name)); events.push({ name, args: copy(args), event: 'request' });
    try {
      const data = await execute(name, args), mode = faults.get(name); events.push({ name, event: 'committed', data: copy(data) });
      if (mode) { faults.delete(name); if (mode === 'lost-ack') return response(fail('57014', 'Controlled committed acknowledgement loss'), 409); if (mode === 'malformed-ack') return response({ malformed: true }); }
      return response(data);
    } catch (error) { if (error && ['22023', '40001', '42501', 'P0002'].includes(error.code)) return response(error, 409); errors.push({ name, error: error.stack || String(error) }); throw error; }
  }
  return { handles, fetchRpc, operations, events, errors, fault, targetChanged, receipt, view };
}
function catalogAdmissionObservation(server, freeRuns, options = {}) {
  const paid = [...server.operations.values()].filter(item => item.phase === 'finished' && item.calls.length > 0 && !options.excludeOperationIds?.has(item.operationId));
  const cursor = freeRuns.at(-1)?.p_resume_cursor || paid.at(-1)?.resumeCursor || {};
  const budget = options.budget, metrics = budget?.snapshot();
  return { observerProtocol: 'Actual catalog FINISH receipts plus free-only aggregates; no fabricated legacy RPC',
    p_items: [...freeRuns.flatMap(run => run.p_items), ...paid.map(item => ({ entityType: item.entityType, entityId: item.entityId }))],
    p_outcomes: [...freeRuns.flatMap(run => run.p_outcomes), ...paid.map(item => ({ status: item.result.state === 'translated' ? 'succeeded' : item.result.state === 'failed' ? 'dead_letter' : item.result.state }))],
    p_resume_cursor: { ...cursor, ...(metrics ? { [`${options.kind}Budget`]: { version: 1, ...metrics, stopReason: budget.exhaustedReason() } } : {}) },
    rawPaidOperations: copy(paid), rawFreeAggregates: copy(freeRuns) };
}
module.exports = { createCatalogAdmissionBoundary, catalogAdmissionObservation };
