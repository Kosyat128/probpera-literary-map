const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const copy = value => value === undefined ? undefined : structuredClone(value);
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

// SDK transport fixture only. This models committed server effects before an
// injected lost acknowledgement; application decisions remain in actual TS.
function createWriterAdmissionBoundary(input) {
  const operations = new Map(), currentByEntity = new Map(), events = [], faults = new Map(), errors = [];
  let tick = 0;
  const stamp = () => `2026-10-29T22:00:${String(++tick).padStart(2, '0')}.123456+00:00`;
  const fault = (name, mode = 'lost-ack') => faults.set(name, mode);
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (code, message) => ({ code, message });
  const key = (country, writer) => `${country}:${writer}`;
  const receipt = (operation, patch = {}) => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId,
    operationId: operation.operationId, entityId: operation.entityId, countryId: operation.countryId,
    writerId: operation.writerId, actorId: input.actorId, provider: operation.provider, sourceHash: operation.sourceHash,
    intentHash: operation.intentHash, configurationHash: operation.configurationHash, configuration: copy(operation.configuration),
    sourceRevision: copy(operation.sourceRevision), targetRevision: copy(operation.targetRevision), jobVersion: String(operation.version),
    phase: operation.phase, canExecute: false, canDispatch: false, replayed: false, providerCalls: operation.calls.length,
    pendingCallId: operation.calls.find(call => !call.response)?.id || null, blockReason: operation.blockReason,
    resumeCursor: copy(operation.resumeCursor), result: copy(operation.result), ...patch });
  function targetChanged(operation) {
    const row = input.getOverride(operation.countryId, operation.writerId);
    return (row?.id || null) !== operation.targetRevision.id || (row?.updated_at || null) !== operation.targetRevision.updatedAt;
  }
  function view(operation) {
    return receipt(operation, { replayed: true, ...(operation.phase !== 'finished' && operation.calls.some(call => !call.response)
      ? { phase: 'blocked', blockReason: 'provider_outcome_unknown' } : operation.phase !== 'finished' && operation.cancelRequested
        ? { phase: 'blocked', blockReason: 'operation_stopped' } : {}) });
  }
  function lookup(args) {
    const operation = operations.get(args.p_operation_id);
    assert.ok(operation, 'Controlled operation must exist');
    assert.equal(operation.jobId, args.p_job_id); assert.equal(operation.itemId, args.p_item_id);
    return operation;
  }
  const handles = name => /^(?:begin_writer_translation_operation|record_writer_translation_operation_dispatch|record_writer_translation_operation_response|finish_writer_translation_operation|reconcile_writer_translation_operation|writer_translation_operation_ready|get_writer_translation_operation_artifacts)$/u.test(name);
  async function execute(name, args) {
    if (name === 'writer_translation_operation_ready') return true;
    if (name === 'reconcile_writer_translation_operation') {
      const id = args.p_operation_id || currentByEntity.get(key(args.p_country_id, args.p_writer_id));
      const operation = id ? operations.get(id) : null;
      return operation ? view(operation) : null;
    }
    if (name === 'begin_writer_translation_operation') {
      const identity = key(args.p_country_id, args.p_writer_id), priorId = currentByEntity.get(identity);
      if (priorId) {
        const prior = operations.get(priorId);
        if (prior.phase !== 'finished') {
          const previous = view(prior);
          return { ...previous, phase: 'blocked', blockReason: previous.blockReason || 'operation_in_progress' };
        }
      }
      const row = input.getOverride(args.p_country_id, args.p_writer_id);
      assert.deepEqual(args.p_expected_override_fields, row?.fields || null);
      assert.deepEqual(args.p_target_revision, { id: row?.id || null, updatedAt: row?.updated_at || null });
      const operation = { jobId: args.p_job_id, itemId: args.p_item_id, operationId: args.p_operation_id,
        entityId: identity, countryId: args.p_country_id, writerId: args.p_writer_id, provider: args.p_provider,
        sourceHash: args.p_source_hash, sourceSnapshot: copy(args.p_source_snapshot), sourceRevision: copy(args.p_source_revision),
        targetRevision: copy(args.p_target_revision), expectedOverrideFields: copy(args.p_expected_override_fields),
        configuration: copy(args.p_configuration), currentCursor: copy(args.p_current_cursor || {}), nextCursor: copy(args.p_resume_cursor || {}),
        resumeCursor: copy(args.p_current_cursor || {}),
        intentHash: sha(args), configurationHash: sha(args.p_configuration), version: 1,
        phase: 'running', blockReason: null, result: null, calls: [], candidate: null };
      operations.set(operation.operationId, operation); currentByEntity.set(identity, operation.operationId);
      return receipt(operation, { canExecute: true });
    }
    if (name === 'record_writer_translation_operation_dispatch') {
      const operation = lookup(args), same = operation.calls.find(call => call.id === args.p_call_id);
      if (same) return view(operation);
      assert.equal(operation.phase, 'running'); assert.equal(operation.calls.some(call => !call.response), false);
      if (operation.cancelRequested) throw fail('40001', 'Controlled writer operation stopped before dispatch');
      assert.ok(operation.calls.length < 4); assert.equal(args.p_provider, operation.provider);
      if (targetChanged(operation)) throw fail('40001', 'Controlled source/target changed before dispatch');
      operation.calls.push({ id: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass,
        requestHash: args.p_request_hash, dispatchedAt: stamp(), response: null, artifact: null });
      operation.version++;
      return receipt(operation, { canDispatch: true });
    }
    if (name === 'record_writer_translation_operation_response') {
      const operation = lookup(args), metadata = args.p_metadata;
      assert.deepEqual(Object.keys(args.p_response_artifact).sort(), ['body', 'version']);
      assert.equal(args.p_response_artifact.version, 1);
      const call = operation.calls.find(value => value.id === metadata.callId);
      assert.ok(call, 'Response must match a real prior dispatch');
      assert.equal(metadata.provider, call.provider); assert.equal(metadata.model, call.model); assert.equal(metadata.pass, call.pass);
      if (call.response) { assert.deepEqual(call.response, metadata); assert.deepEqual(call.artifact, args.p_response_artifact); return view(operation); }
      call.response = copy(metadata); call.artifact = copy(args.p_response_artifact); call.receivedAt = stamp(); operation.version++;
      return receipt(operation);
    }
    if (name === 'get_writer_translation_operation_artifacts') {
      const operation = lookup(args);
      assert.equal(args.p_intent_hash, operation.intentHash); assert.equal(args.p_source_hash, operation.sourceHash);
      return { version: 1, receipt: view(operation), sourceSnapshot: copy(operation.sourceSnapshot), sourceRevision: copy(operation.sourceRevision),
        targetRevision: copy(operation.targetRevision), expectedOverrideFields: copy(operation.expectedOverrideFields), configuration: copy(operation.configuration),
        calls: operation.calls.map(call => ({ requestHash: call.requestHash, metadata: { callId: call.id, provider: call.provider,
          model: call.model, pass: call.pass, dispatchRecordedAt: call.dispatchedAt, responseReceivedAt: call.response ? call.receivedAt : null,
          httpStatus: call.response?.httpStatus ?? null, requestId: call.response?.requestId ?? null, responseId: call.response?.responseId ?? null,
          inputTokens: call.response?.inputTokens ?? null, outputTokens: call.response?.outputTokens ?? null }, responseArtifact: copy(call.artifact) })),
        candidate: copy(operation.candidate) };
    }
    if (name === 'finish_writer_translation_operation') {
      const operation = lookup(args);
      if (operation.phase === 'finished') return view(operation);
      assert.equal(operation.calls.some(call => !call.response), false, 'An unknown accepted request cannot be completed or released');
      const candidate = args.p_candidate;
      if (candidate) {
        const translator = operation.calls.find(call => call.id === candidate.translatorCallId);
        const reviewer = operation.calls.find(call => call.id === candidate.reviewerCallId);
        assert.ok(translator?.response && reviewer?.response); assert.equal(translator.pass, 'translation');
        assert.ok(['review', 'repair'].includes(reviewer.pass));
        operation.candidate = copy(candidate);
        const changed = targetChanged(operation), existing = input.getPrivateCandidate(operation.entityId);
        let draft = null;
        if (!existing) {
          draft = { id: crypto.randomUUID(), version: 1, entityType: 'writer_biography', entityId: operation.entityId,
            targetLocale: 'en', humanReview: 'pending', sourceHash: operation.sourceHash,
            candidateHash: sha(candidate), sourceSnapshot: copy(operation.sourceSnapshot), sourceRevision: copy(operation.sourceRevision),
            targetRevision: copy(operation.targetRevision), payload: copy(candidate.payload), provenance: copy(candidate.provenance),
            createdAt: stamp(), createdBy: input.actorId };
          input.setPrivateCandidate(operation.entityId, draft);
        }
        operation.result = { state: operation.cancelRequested ? 'cancelled' : draft && !changed ? 'translated' : 'conflict',
          errorCode: operation.cancelRequested || draft && !changed ? null : 'write_conflict',
          persistence: draft ? 'working-draft' : 'private-artifact', draftId: draft?.id || null, draftVersion: draft?.version || null,
          draftUpdatedAt: draft?.createdAt || null, candidateHash: sha(candidate), publication: 'unchanged', humanReview: 'pending' };
      } else {
        const states = { dead_letter: 'failed', succeeded: 'translated' };
        operation.result = { state: states[args.p_outcome.status] || args.p_outcome.status || 'failed', errorCode: args.p_outcome.errorCode || null,
          persistence: 'none', draftId: null, draftVersion: null, draftUpdatedAt: null, candidateHash: null,
          publication: 'unchanged', humanReview: 'unchanged' };
      }
      operation.phase = 'finished'; operation.version++;
      operation.resumeCursor = copy(args.p_outcome.status === 'skipped' && args.p_outcome.providerCalls === 0
        ? operation.currentCursor : operation.nextCursor);
      return receipt(operation);
    }
    throw new Error(`Unsupported controlled writer RPC ${name}`);
  }
  async function fetchRpc(name, args) {
    assert.equal(handles(name), true);
    events.push({ name, args: copy(args), event: 'request' });
    try {
      const data = await execute(name, args), faultMode = faults.get(name);
      events.push({ name, event: 'committed', data: copy(data) });
      if (faultMode) {
        faults.delete(name);
        if (faultMode === 'lost-ack') return response(fail('57014', 'Controlled committed RPC acknowledgement loss'), 409);
        if (faultMode === 'malformed-ack') return response({ malformed: true });
      }
      return response(data);
    } catch (error) {
      if (error && typeof error === 'object' && typeof error.code === 'string') return response(error, 409);
      errors.push({ name, error: error.stack || String(error) }); throw error;
    }
  }
  return { handles, fetchRpc, operations, events, errors, fault, targetChanged, receipt, view };
}
module.exports = { createWriterAdmissionBoundary };
