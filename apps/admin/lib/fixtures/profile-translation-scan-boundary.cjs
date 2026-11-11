const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const copy = value => value === undefined ? undefined : structuredClone(value);
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

// Controlled SDK declaration. Native PostgreSQL independently proves the five
// server RPCs; this declaration never classifies prose or schedules app work.
function createProfileTranslationScanBoundary(input) {
  const windows = new Map(), scans = new Map(), events = [], observations = [], errors = [], faults = new Map();
  const names = new Set(['begin_profile_translation_scan', 'get_profile_translation_scan', 'attach_profile_translation_scan_operation',
    'checkpoint_profile_translation_scan_item', 'continue_profile_translation_scan']);
  let beforeCheckpoint = null;
  const response = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
  const fail = (code, message) => { throw {code, message}; };
  const stopped = window => ['cancelled', 'cancelling'].includes(window.status);
  const server = kind => kind === 'writer' ? input.writerServer : input.catalogServer;
  const entity = (kind, member) => kind === 'writer' ? `${member.countryId}:${member.writerId}` : member.countryId;
  const ordinal = window => window.windowIndex * 500 + window.nextPosition;
  const current = window => window.members[window.nextPosition] || null;
  const operation = (window, operationId) => server(window.kind)?.operations.get(operationId) || null;
  const kindMatches = (window, op) => window.kind === 'writer' ? !!op.writerId : op.entityType === 'country';
  function get(jobId) {
    const window = windows.get(jobId);
    if (!window) fail('P0002', 'Controlled profile scan missing');
    if (window.actorId !== input.actorId) fail('42501', 'Controlled scan actor mismatch');
    return window;
  }
  function active(window) {
    const member = current(window);
    return member ? [...(server(window.kind)?.operations.values() || [])].find(op => kindMatches(window, op) &&
      op.entityId === member.entityId && op.phase !== 'finished') || null : null;
  }
  function childView(window) {
    const found = window.child ? null : active(window);
    const link = window.child || (found ? {binding: 'observed-blocked', operationId: found.operationId, initialProviderCalls: found.calls.length} : null);
    if (!link) return null;
    const op = operation(window, link.operationId);
    assert.ok(op, 'Actual admitted operation must exist');
    return {binding: link.binding, initialProviderCalls: link.initialProviderCalls,
      receipt: {...server(window.kind).view(op), canExecute: false, canDispatch: false}};
  }
  function view(window, patch = {}) {
    const child = childView(window);
    return {version: 1, scanId: window.scanId, jobId: window.jobId, jobVersion: String(window.version), actorId: window.actorId,
      kind: window.kind, provider: window.configuration.provider, status: window.status, configurationHash: window.configurationHash,
      fullManifestHash: window.fullManifestHash, membershipHash: window.membershipHash, totalMembership: window.totalMembership,
      windowCount: window.windowCount, windowIndex: window.windowIndex, predecessorJobId: window.predecessorJobId,
      successorJobId: window.successorJobId, totalItems: window.members.length, nextPosition: window.nextPosition,
      lastWindow: window.windowIndex === window.windowCount - 1, exhausted: window.exhausted,
      members: copy(window.members), child, replayed: false, transition: 'read',
      blockReason: stopped(window) ? 'scan_stopped' : child ? child.receipt.actorId !== window.actorId ? 'child_owned_by_another_actor' : 'child_pending'
        : window.nextPosition === window.members.length ? 'window_complete' : null, ...patch};
  }
  function version(window, args) {
    if (String(window.version) !== args.p_expected_version) fail('40001', 'Controlled stale profile scan version');
  }
  function prefixComplete(window) {
    const prior = [...windows.values()].filter(other => other.scanId === window.scanId && other.windowIndex < window.windowIndex);
    if (prior.some(other => other.nextPosition !== other.members.length || other.child)) fail('40001', 'Controlled prior profile prefix unfinished');
  }
  function replay(window, args) {
    if (!uuid(args.p_transition_id)) fail('22023', 'Controlled transition UUID missing');
    const old = window.transitions.get(args.p_transition_id);
    if (!old) return null;
    if (!same(old.args, args)) fail('40001', 'Controlled transition UUID binding mismatch');
    return view(window, {replayed: true, transition: old.transition});
  }
  function remember(window, args, transition) {
    window.transitions.set(args.p_transition_id, {args: copy(args), transition});
    window.version++;
    return view(window, {transition});
  }
  function observe(window, op) {
    window.child = {binding: 'observed-blocked', operationId: op.operationId, initialProviderCalls: op.calls.length};
    window.version++;
    return view(window, {transition: 'held'});
  }
  function begin(args) {
    if (!uuid(args.p_scan_id) || !['writer', 'country'].includes(args.p_kind) || !args.p_configuration || !Array.isArray(args.p_manifest)) fail('22023', 'Controlled BEGIN shape');
    const manifest = args.p_manifest, kind = args.p_kind;
    if (manifest.length > 10000 || Buffer.byteLength(JSON.stringify(manifest)) > 4 * 1024 * 1024) fail('22023', 'Controlled full manifest overflow');
    const identities = new Set();
    for (const member of manifest) {
      const keys = kind === 'writer' ? ['countryId', 'writerId', 'catalogSourceHash'] : ['countryId', 'catalogSourceHash'];
      if (!same(Object.keys(member).sort(), keys.sort()) || !hash(member.catalogSourceHash) || typeof member.countryId !== 'string' ||
        member.countryId.length < 1 || member.countryId.length > 120 || member.countryId.trim() !== member.countryId || /\p{Cc}/u.test(member.countryId)) fail('22023', 'Controlled manifest member shape');
      if (kind === 'writer' && (typeof member.writerId !== 'string' || !member.writerId.length ||
        (input.writerIdentity && input.writerIdentity(member.countryId, member.writerId) !== entity(kind, member)))) fail('22023', 'Controlled writer tuple invalid');
      const id = entity(kind, member);
      if (identities.has(id)) fail('22023', 'Controlled duplicate exact tuple');
      identities.add(id);
    }
    const existing = scans.get(args.p_scan_id);
    if (existing) {
      if (!same(existing.args, args)) fail('40001', 'Controlled scan intent binding mismatch');
      return view(get(args.p_scan_id), {replayed: true, transition: 'created'});
    }
    const count = Math.max(1, Math.ceil(manifest.length / 500));
    const ids = Array.from({length: count}, (_, index) => index === 0 ? args.p_scan_id : crypto.randomUUID());
    const manifestHash = sha(manifest), configurationHash = sha(args.p_configuration);
    for (let index = 0; index < count; index++) {
      const members = manifest.slice(index * 500, (index + 1) * 500);
      const window = {scanId: args.p_scan_id, jobId: ids[index], actorId: input.actorId, kind, configuration: copy(args.p_configuration),
        configurationHash, fullManifestHash: manifestHash, membershipHash: sha(members), totalMembership: manifest.length,
        windowCount: count, windowIndex: index, predecessorJobId: ids[index - 1] || null, successorJobId: ids[index + 1] || null,
        members: members.map((member, position) => ({itemId: crypto.randomUUID(), position, entityId: entity(kind, member), ...copy(member), status: 'reviewing'})),
        nextPosition: 0, version: 1, status: members.length ? 'reviewing' : 'skipped', child: null,
        exhausted: manifest.length === 0, transitions: new Map()};
      windows.set(window.jobId, window);
    }
    scans.set(args.p_scan_id, {args: copy(args), windows: ids});
    return view(get(args.p_scan_id), {transition: 'created'});
  }
  async function execute(name, args) {
    if (name === 'begin_profile_translation_scan') return begin(args);
    if (name === 'get_profile_translation_scan') return view(get(args.p_job_id));
    const window = get(args.p_window_job_id);
    if (name === 'continue_profile_translation_scan') {
      if (!same(window.configuration, args.p_configuration)) fail('40001', 'Controlled continuation configuration mismatch');
      if (stopped(window)) return view(window, {transition: 'held'});
      if (window.nextPosition !== window.members.length || childView(window)) return view(window, {transition: childView(window) ? 'held' : 'read'});
      prefixComplete(window);
      if (window.successorJobId) return view(get(window.successorJobId), {replayed: true, transition: 'successor'});
      if (window.exhausted) return view(window, {replayed: true, transition: 'exhausted'});
      version(window, args);
      window.exhausted = true; window.status = 'completed'; window.version++;
      return view(window, {transition: 'exhausted'});
    }
    const prior = replay(window, args);
    if (prior) return prior;
    version(window, args); prefixComplete(window);
    const member = current(window);
    if (!member || member.itemId !== args.p_item_id) fail('40001', 'Controlled exact current member mismatch');
    if (stopped(window)) return view(window, {transition: 'held'});
    if (name === 'attach_profile_translation_scan_operation') {
      const op = operation(window, args.p_operation_id);
      if (!op || !kindMatches(window, op) || op.entityId !== member.entityId || op.jobId !== args.p_operation_job_id ||
        op.itemId !== args.p_operation_item_id || op.intentHash !== args.p_intent_hash) fail('40001', 'Controlled actual child identity mismatch');
      if (window.child && window.child.operationId !== op.operationId) fail('40001', 'Controlled different attached child');
      const other = [...windows.values()].find(other => other.jobId !== window.jobId && other.child?.operationId === op.operationId);
      if (other) return view(window, {transition: 'held', blockReason: 'child_attached_to_another_scan'});
      if (op.phase === 'finished' && !window.child) fail('40001', 'Controlled historical child cannot attach');
      const cursor = {[window.kind === 'writer' ? 'writerCursor' : 'countryCursor']: ordinal(window)};
      const next = {[window.kind === 'writer' ? 'writerCursor' : 'countryCursor']: ordinal(window) + 1};
      if (op.phase !== 'running' || op.calls.length || !same(op.configuration, window.configuration) ||
        op.provider !== window.configuration.provider || op.sourceRevision.catalogSourceHash !== member.catalogSourceHash ||
        !same(op.currentCursor, cursor) || !same(op.nextCursor, next)) return observe(window, op);
      window.child = {binding: 'attached', operationId: op.operationId, initialProviderCalls: 0};
      return remember(window, args, 'attached');
    }
    assert.equal(name, 'checkpoint_profile_translation_scan_item');
    if (beforeCheckpoint) {const hook = beforeCheckpoint; beforeCheckpoint = null; await hook({window, args});}
    const observation = args.p_observation;
    if (!observation || observation.version !== 1) fail('22023', 'Controlled observation shape');
    if (observation.type === 'free') {
      if (!same(Object.keys(observation).sort(), ['version', 'type', 'state', 'reason', 'sourceHash'].sort()) ||
        !['manual', 'current', 'review-pending', 'stale', 'skipped', 'failed'].includes(observation.state) ||
        ![null, 'source_missing', 'ineligible', 'existing_candidate', 'database_read_failed', 'catalog_changed'].includes(observation.reason) ||
        !(observation.sourceHash === null || hash(observation.sourceHash)) || observation.reason === 'catalog_changed' && observation.state !== 'stale' ||
        args.p_operation_id != null) fail('22023', 'Controlled free observation invalid');
      const blocked = active(window);
      if (blocked) return observe(window, blocked);
      if (window.child) fail('40001', 'Controlled linked child requires terminal proof');
      member.status = observation.state === 'failed' ? 'dead_letter' : observation.state === 'stale' ? 'stale' : 'skipped';
    } else if (observation.type === 'child-terminal') {
      if (!same(Object.keys(observation).sort(), ['version', 'type'].sort()) || args.p_transition_id === args.p_operation_id) fail('22023', 'Controlled terminal proof invalid');
      const blocked = active(window);
      if (blocked && blocked.operationId !== args.p_operation_id) return observe(window, blocked);
      const op = operation(window, args.p_operation_id);
      if (!op || !kindMatches(window, op) || op.entityId !== member.entityId || window.child && window.child.operationId !== op.operationId) fail('40001', 'Controlled terminal exact tuple mismatch');
      if (op.phase !== 'finished') return window.child ? view(window, {transition: 'held'}) : observe(window, op);
      if (op.calls.length === 0) {window.child = null; return remember(window, args, 'zero-call-held');}
      member.status = !window.child || window.child.binding === 'observed-blocked' ? 'skipped'
        : ({translated: 'succeeded', failed: 'dead_letter', 'review-pending': 'skipped', manual: 'skipped', current: 'skipped'})[op.result.state] || op.result.state;
      if (!['succeeded', 'dead_letter', 'conflict', 'stale', 'skipped', 'cancelled', 'not-configured'].includes(member.status)) fail('40001', 'Controlled terminal state invalid');
      window.child = null;
    } else fail('22023', 'Controlled unknown observation type');
    observations.push({jobId: window.jobId, itemId: member.itemId, entityId: member.entityId,
      transitionId: args.p_transition_id, providerCalls: 0, observation: copy(observation), operationId: args.p_operation_id || null});
    window.nextPosition++;
    if (window.nextPosition === window.members.length) {window.status = 'completed'; window.exhausted = window.successorJobId === null;}
    return remember(window, args, 'advanced');
  }
  async function fetchRpc(name, args) {
    assert.ok(names.has(name)); events.push({event: 'request', name, args: copy(args)});
    const configured = faults.get(name), consume = () => {if (configured && --configured.count <= 0) faults.delete(name);};
    if (configured?.mode === 'unavailable') {consume(); return response({code: '57014', message: 'Controlled profile scan unavailable'}, 409);}
    let lost = false;
    try {
      const value = await execute(name, args); events.push({event: 'committed', name, data: copy(value)});
      if (configured) {
        consume();
        if (configured.mode === 'lost-ack') {lost = true; throw new TypeError('Controlled committed profile scan ACK lost');}
        if (configured.mode === 'malformed-ack') return response({invalid: true});
      }
      events.push({event: 'delivered', name, data: copy(value)});
      return response(value);
    } catch (error) {
      if (lost) throw error;
      if (error?.code) return response(error, 409);
      errors.push({name, error: error.stack || String(error)}); throw error;
    }
  }
  return {handles: name => names.has(name), fetchRpc, windows, scans, events, observations, errors, view,
    fault(name, mode = 'lost-ack', count = 1) {assert.ok(names.has(name)); faults.set(name, {mode, count});},
    beforeNextCheckpoint(hook) {beforeCheckpoint = hook;},
    cancel(jobId) {const window = get(jobId); window.status = 'cancelled'; window.version++;},
    latest() {return [...windows.values()].at(-1);},
    attachedDispatchBlocked(operationId) {return [...windows.values()].some(window => window.child?.operationId === operationId && stopped(window));}};
}
function profileScanObservation(scans, base) {
  if (!scans || scans.windows.size === 0) return base;
  const logical = scans.observations.filter(row => row.observation.type === 'free');
  const confirmed = scans.events.filter(event => event.event === 'delivered').at(-1)?.data;
  const kind = [...scans.windows.values()][0].kind;
  return {...base, observerProtocol: 'Actual paid FINISH receipts plus confirmed profile free observations; no fabricated legacy RPC',
    p_items: [...base.p_items, ...logical.map(row => ({entityType: kind, entityId: row.entityId}))],
    p_outcomes: [...base.p_outcomes, ...logical.map(row => ({status: row.observation.state === 'failed' ? 'dead_letter' : row.observation.state === 'stale' ? 'stale' : 'skipped'}))],
    p_resume_cursor: {...base.p_resume_cursor, [`${kind}Cursor`]: confirmed ? confirmed.windowIndex * 500 + confirmed.nextPosition : 0},
    rawProfileScanObservations: copy(scans.observations), rawConfirmedProfileScanReceipt: copy(confirmed)};
}
function freshScanTriggerProof(prefix, first, second) {
  const key = `${prefix}ScanIntent`, job = `${prefix}Job`;
  assert.ok(uuid(first.form[key])); assert.ok(uuid(second.form[key]));
  assert.notEqual(first.form[key], second.form[key]);
  assert.equal(Object.hasOwn(first.form, job), false); assert.equal(Object.hasOwn(second.form, job), false);
  return {version: 1, firstPostForm: copy(first.form), secondPostForm: copy(second.form),
    distinctFreshIntentUuids: true, oldJobIdSubmitted: false,
    meaning: 'Two actual action invocations receive distinct explicit fresh intents. The second command is not a Continue of the first scan.'};
}
module.exports = {createProfileTranslationScanBoundary, profileScanObservation, freshScanTriggerProof};
