const assert = require('node:assert/strict'), crypto = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');
const copy = value => value === undefined ? undefined : structuredClone(value);
const same = (left, right) => isDeepStrictEqual(left, right);
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scope = 'site-copy-overrides';

// Controlled SDK effects for the closed7RPC family. Actual application helpers,
// request builders and provider parsers execute independently of this transport.
// Synthetic fingerprints are opaque fixture values, not nativeJSONB digests.
// Native SQL/RLS/lock/final DTO proof must be bound separately after release.
function createSiteCopyAdmissionBoundary(input) {
  const operations = new Map(), events = [], faults = new Map();
  const names = new Set(['site_copy_translation_operation_ready', 'begin_site_copy_translation_operation',
    'reconcile_site_copy_translation_operation', 'get_site_copy_translation_operation_artifacts',
    'record_site_copy_translation_operation_dispatch', 'record_site_copy_translation_operation_response',
    'finish_site_copy_translation_operation']);
  const actor = () => input.getActorId ? input.getActorId() : input.actorId;
  const now = () => input.now ? input.now() : Date.parse('2026-10-30T12:00:00.000Z');
  const fail = (code, message) => {throw {code, message};};
  const active = () => [...operations.values()].find(op => op.phase !== 'finished') || null;
  const response = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
  const load = file => input.load(`apps/admin/lib/${file}`);
  function staff() {if (input.isStaff && !input.isStaff()) fail('42501', 'Controlled staff authorization failed');}
  function receipt(op, patch = {}) {
    const pending = op.calls.find(call => call.metadata.responseReceivedAt === null);
    const blockReason = op.actorId !== actor() ? 'operation_owned_by_another_actor' : pending ? 'provider_outcome_unknown'
      : op.cancelRequested ? 'operation_stopped' : now() >= Date.parse(op.deadlineAt) ? 'operation_deadline' : null;
    return {version: 1, logicalScope: scope, jobId: op.jobId, itemId: op.itemId, operationId: op.operationId,
      entityType: 'site_copy', entityId: op.blockId, actorId: op.actorId, provider: op.configuration.provider,
      sourceHash: op.sourceHash, intentHash: op.intentHash, rawSeedHash: op.rawSeedHash,
      configurationHash: op.configurationHash, configuration: copy(op.configuration), sourceRevision: copy(op.sourceRevision),
      targetRevision: copy(op.targetRevision), startedAt: op.startedAt, deadlineAt: op.deadlineAt, jobVersion: String(op.version),
      phase: op.phase === 'finished' ? 'finished' : blockReason ? 'blocked' : 'running', canExecute: false, canDispatch: false,
      replayed: false, providerCalls: op.calls.length, pendingCallId: pending?.metadata.callId || null,
      blockReason: op.phase === 'finished' ? null : blockReason, resumeCursor: {}, result: copy(op.result), ...patch};
  }
  function own(args) {
    staff(); const op = operations.get(args.p_operation_id);
    if (!op) fail('P0002', 'Controlled site-copy operation missing');
    if (op.actorId !== actor()) fail('42501', 'Foreign private artifacts are unavailable');
    if (op.jobId !== args.p_job_id || op.itemId !== args.p_item_id) fail('40001', 'Controlled exact operation identity differs');
    return op;
  }
  async function execute(name, args) {
    staff();
    if (name === 'site_copy_translation_operation_ready') return true;
    if (name === 'reconcile_site_copy_translation_operation') {
      // Scope first, regardless of the current/recreated block or new config.
      const op = active() || (args.p_operation_id ? operations.get(args.p_operation_id) : [...operations.values()].at(-1));
      return op ? receipt(op, {replayed: true}) : null;
    }
    if (name === 'begin_site_copy_translation_operation') {
      const held = active();
      if (held) return receipt(held, {replayed: true, phase: 'blocked', blockReason: receipt(held).blockReason || 'operation_in_progress'});
      const existing = operations.get(args.p_operation_id);
      if (existing) {
        if (existing.actorId !== actor()) fail('42501', 'Controlled operation actor differs');
        if (!same(existing.beginArgs, args)) fail('40001', 'Controlled BEGIN idempotency binding differs');
        return receipt(existing, {replayed: true});
      }
      const rows = input.getCanonicalBlocks();
      if (rows.length !== 1 || rows[0].id !== args.p_block_id || rows[0].settings?.systemKey !== scope) fail('40001', 'Canonical singleton missing/recreated/ambiguous');
      const block = rows[0];
      if (!same(args.p_expected_state, {version: 1, block: {id: block.id, settings: block.settings, updated_at: block.updated_at}}) ||
        !same(args.p_source_snapshot.settings, block.settings) || args.p_source_revision.blockId !== block.id ||
        args.p_source_revision.blockUpdatedAt !== block.updated_at || !same(args.p_target_revision, {id: block.id, updatedAt: block.updated_at})) fail('40001', 'Controlled full settings/revision seed differs');
      const source = await load('site-copy-translation-contract.ts').siteCopyTranslationSource(block.settings);
      const items = args.p_source_snapshot.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 50 || new Set(items.map(item => item.key)).size !== items.length ||
        !same(source.items.filter(item => items.some(selected => selected.key === item.key)), items) ||
        await load('auto-translate-site-copy.ts').translationSourceHash(items) !== args.p_source_hash) fail('22023', 'Selected source membership/order/hash differs');
      load('site-copy-translation-operation-rpc.ts').siteCopyTranslationConfigurationSchema.parse(args.p_configuration);
      if (input.validateBegin) await input.validateBegin(args);
      const rawSeed = {version: 1, block: copy(block)}, rawSeedHash = sha(rawSeed), startedAt = new Date(now()).toISOString();
      const op = {operationId: args.p_operation_id, jobId: args.p_job_id, itemId: args.p_item_id, blockId: block.id,
        actorId: actor(), beginArgs: copy(args), sourceHash: args.p_source_hash, sourceSnapshot: copy(args.p_source_snapshot),
        sourceRevision: copy(args.p_source_revision), targetRevision: copy(args.p_target_revision), expectedState: copy(args.p_expected_state),
        rawSeed, rawSeedHash, intentHash: sha([args, rawSeedHash]), configuration: copy(args.p_configuration), configurationHash: sha(args.p_configuration),
        startedAt, deadlineAt: new Date(now() + 45000).toISOString(), calls: [], candidate: null, result: null, phase: 'running', version: 1, cancelRequested: false};
      operations.set(op.operationId, op); return receipt(op, {canExecute: true});
    }
    const op = own(args);
    if (name === 'get_site_copy_translation_operation_artifacts') {
      if (op.intentHash !== args.p_intent_hash || op.sourceHash !== args.p_source_hash || op.rawSeedHash !== args.p_raw_seed_hash) fail('40001', 'Controlled private artifact proof differs');
      return {version: 1, receipt: receipt(op, {replayed: true}), expectedState: copy(op.expectedState), rawSeed: copy(op.rawSeed),
        sourceSnapshot: copy(op.sourceSnapshot), sourceRevision: copy(op.sourceRevision), targetRevision: copy(op.targetRevision),
        configuration: copy(op.configuration), calls: copy(op.calls), candidate: copy(op.candidate)};
    }
    if (name === 'record_site_copy_translation_operation_dispatch') {
      const existing = op.calls.find(call => call.metadata.callId === args.p_call_id);
      if (existing) {
        if (existing.requestHash !== args.p_request_hash || existing.metadata.provider !== args.p_provider ||
          existing.metadata.model !== args.p_model || existing.metadata.pass !== args.p_pass) fail('40001', 'Dispatch replay metadata changed');
        return receipt(op, {replayed: true});
      }
      if (op.phase === 'finished' || op.cancelRequested || now() >= Date.parse(op.deadlineAt) || op.calls.length >= 4 ||
        op.calls.some(call => call.metadata.responseReceivedAt === null)) fail('40001', 'Controlled stop/deadline/unknown/call bound prevents dispatch');
      const rows = input.getCanonicalBlocks();
      if (rows.length !== 1 || !same({version: 1, block: rows[0]}, op.rawSeed)) fail('40001', 'Recorded full source row changed before dispatch');
      if (args.p_provider !== op.configuration.provider || args.p_model !== (args.p_pass === 'translation' ? op.configuration.model : op.configuration.reviewerModel) ||
        !['translation', 'repair', 'review'].includes(args.p_pass) || !/^[a-f0-9]{64}$/u.test(args.p_request_hash) ||
        (op.calls.length === 0) !== (args.p_pass === 'translation') || args.p_pass === 'review' && !op.configuration.twoPassReview) fail('22023', 'Configured provider/model/pass/request differs');
      if (input.validateDispatch) await input.validateDispatch(op, args);
      op.calls.push({requestHash: args.p_request_hash, metadata: {callId: args.p_call_id, provider: args.p_provider,
        model: args.p_model, pass: args.p_pass, dispatchRecordedAt: new Date(now()).toISOString(), responseReceivedAt: null,
        httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null}, responseArtifact: null});
      op.version++;
      return receipt(op, {phase: 'running', blockReason: null, canDispatch: true});
    }
    if (name === 'record_site_copy_translation_operation_response') {
      const metadata = args.p_metadata, call = op.calls.find(call => call.metadata.callId === metadata.callId);
      if (!call) fail('40001', 'Response lacks an actual dispatch');
      if (metadata.provider !== call.metadata.provider || metadata.model !== call.metadata.model || metadata.pass !== call.metadata.pass ||
        !args.p_response_artifact || args.p_response_artifact.version !== 1 || !Object.hasOwn(args.p_response_artifact, 'body')) fail('40001', 'Response identity/body declaration differs');
      if (call.metadata.responseReceivedAt !== null) {
        const old = {...call.metadata}; delete old.dispatchRecordedAt; delete old.responseReceivedAt;
        if (!same(old, metadata) || !same(call.responseArtifact, args.p_response_artifact)) fail('40001', 'Response metadata/body changed on ACK retry');
        return receipt(op, {replayed: true});
      }
      if (op.calls.at(-1) !== call) fail('40001', 'Only the last pending reservation can receive its first response');
      // Accepted output is retained even after deadline/cancel/source drift.
      call.metadata = {...call.metadata, ...copy(metadata), responseReceivedAt: new Date(now()).toISOString()};
      call.responseArtifact = copy(args.p_response_artifact); op.version++;
      return receipt(op);
    }
    assert.equal(name, 'finish_site_copy_translation_operation');
    if (op.phase === 'finished') {
      if (!same(op.finishProof, [args.p_outcome,args.p_candidate])) fail('40001','FINISH replay outcome/candidate changed');
      return receipt(op, {replayed: true});
    }
    if (op.calls.some(call => call.metadata.responseReceivedAt === null)) fail('40001', 'Unknown accepted work cannot be finished/released');
    if (op.calls.length && !args.p_candidate) fail('40001', 'Paid unfinished output remains held');
    if (!input.finishCandidate) throw new Error('Bind actual private candidate effect before running this controlled boundary');
    const result = await input.finishCandidate(op, args);
    op.candidate = copy(args.p_candidate || null); op.result = copy(result); op.finishProof=copy([args.p_outcome,args.p_candidate]);op.phase = 'finished'; op.version++;
    return receipt(op);
  }
  async function fetchRpc(name, args = {}) {
    assert.ok(names.has(name)); events.push({event: 'request', name, args: copy(args)});
    input.onEvent?.(name, args);
    const fault = faults.get(name);
    if (fault?.mode === 'unavailable') {if (--fault.count <= 0) faults.delete(name); return response({code: '57014', message: 'Controlled response unavailable'}, 409);}
    let committed = false;
    try {
      const value = await execute(name, args); committed = true; events.push({event: 'committed', name, data: copy(value)});
      input.onCommitted?.(name, args, value);
      if (fault) {
        if (--fault.count <= 0) faults.delete(name);
        if (fault.mode === 'lost-ack') throw new TypeError('Controlled committed response ACK delivery lost');
        if (fault.mode === 'malformed-ack') return response({malformed: true});
      }
      return response(value);
    } catch (error) {
      if (committed || !error?.code) throw error;
      return response(error, 409);
    }
  }
  return {handles: name => names.has(name), fetchRpc, operations, events, view: receipt,
    fault(name, mode = 'lost-ack', count = 1) {assert.ok(names.has(name)); faults.set(name, {mode, count});},
    cancel(operationId) {operations.get(operationId).cancelRequested = true;}};
}
module.exports = {createSiteCopyAdmissionBoundary};
