// Independent behavioral oracle. No production helper or transport decides these expectations.
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function evaluate(trace) {
  const checks=[];
  const check=(name,pass,role='control')=>checks.push({name,pass:Boolean(pass),role});
  const {scenario,commands}=trace;
  check('authored canonical RU/EN/rights stay exact',same(trace.canonicalBefore,trace.canonicalAfter),'preservation');
  check('no editorial DML is issued',trace.editorialWrites.length===0,'preservation');
  check('manual retry/full build never starts article translation',trace.translationCalls.length===0,'preservation');
  check('original outbox identity/reason/metadata are not rewritten',trace.originalIntentPreserved,'preservation');
  check('no uncontrolled transport or module fallback',trace.protocolErrors.length===0,'control');
  check('every completed command retains native Next redirect',commands.every(command=>command.redirect&&!command.error),'control');
  if(scenario.kind==='invalid') {
    check('invalid/missing/denied address makes no enqueue or mark',trace.rpc.length===0);
    check('invalid/missing/denied address makes no external request',trace.external.length===0);
    check('safe refusal does not echo provider detail',commands.every(command=>!JSON.stringify(command).includes('PRIVATE_M04_TRANSPORT_DETAIL')));
    if(scenario.invalidBeforeRead)check('syntactically invalid address stops before DB read',trace.wire.length===0);
  }
  if(scenario.kind==='terminal') {
    check('direct deployed retry makes no new durable enqueue',trace.rpc.filter(row=>row.name==='enqueue_public_build_request').length===0,'target');
    check('direct deployed retry makes no external launch',trace.external.length===0,'target');
  }
  if(scenario.kind==='active') {
    check('known active dispatch is reconciled rather than blindly relaunched',trace.external.length===0,'target');
    check('known active dispatch gets no substitute enqueue',trace.rpc.filter(row=>row.name==='enqueue_public_build_request').length===0,'target');
  }
  if(scenario.kind==='race') {
    check('controlled concurrent completion actually occurs after addressed read',trace.transitions.some(row=>row.kind==='after-read-before-enqueue'&&row.from==='failed'&&row.to==='deployed'));
    check('stale retry cannot dispatch after the source event completed',trace.external.length===0,'target');
    check('stale retry cannot append a substitute event after completion',trace.rpc.filter(row=>row.name==='enqueue_public_build_request').length===0,'target');
  }
  if(scenario.kind==='mark-unknown') {
    check('first external launch was accepted and its journal mark remained unconfirmed',commands.length===2&&commands[0].externalAfter-commands[0].externalBefore===1&&trace.markFailures>=1&&trace.firstUnconfirmedEvent?.status==='requested');
    check('accepted external start retains the existing published=started outcome',typeof commands[0]?.redirect==='string'&&new URL(commands[0].redirect,'http://fixture.invalid').searchParams.get('published')==='started');
    check('second command addresses the actual newly appended unresolved event',commands.length===2&&commands[1].form.outbox_id===trace.firstAcceptedOutboxId);
    check('accepted external work with unknown journal gets no second blind launch',commands.length===2&&commands[1].externalAfter===commands[0].externalAfter,'target');
  }
  if(scenario.kind==='failed-control') {
    check('one known failed event permits one explicit retry',trace.external.length===1);
    check('one known failed retry enqueues once',trace.rpc.filter(row=>row.name==='enqueue_public_build_request').length===1);
    check('retry metadata names the addressed old event',trace.appended[0]?.metadata.retry_of_outbox_id==='42');
  }
  if(scenario.kind==='full-control') {
    check('two deliberate full release commands remain two separate launches',trace.external.length===2);
    check('fresh full release never rewrites or retries the deployed source event',trace.appended.length===2&&trace.appended.every(row=>row.reason==='manual-full-public-build'&&!Object.hasOwn(row.metadata,'retry_of_outbox_id')));
    check('two separate new events retain distinct IDs',new Set(trace.appended.map(row=>row.id)).size===2);
  }
  if(scenario.kind==='distinct-control') {
    check('distinct failed source events are not collapsed by entity ID',trace.external.length===2&&trace.appended.length===2);
    check('each retry retains its own source event',same(trace.appended.map(row=>row.metadata.retry_of_outbox_id),['42','43']));
  }
  return checks;
}
module.exports={evaluate};
