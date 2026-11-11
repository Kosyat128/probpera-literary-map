// Additive real save/publish submitter controls for the actual PageEditor/action/SDK boundary.
// No mounting/hook/receipt implementation is cloned here, and this module is not executed in preparation.
import assert from 'node:assert/strict';

/** Each caller must provide a fresh actual browser page/current source-bound bridge.
 * waitUntil is the original bounded observer poll; releaseFirstResponse is the real local delivery gate.
 */
export async function observeRealPageSubmitter({page,bridge,waitUntil,releaseFirstResponse,intent}) {
  let released=false;
  const release=()=>{if(!released){released=true;releaseFirstResponse();}};
  try {
  assert(['save','publish'].includes(intent));
  assert.equal(bridge.runtime.trace.actionCalls.length,0);
  await page.getByRole('textbox',{name:'Название страницы',exact:true}).fill('Exact submitter '+intent+' title');
  await page.locator('.ProseMirror[contenteditable="true"]').fill('Exact submitter '+intent+' body.');
  await page.locator('[name="status"]').selectOption('draft');
  await page.waitForFunction(intent=>document.querySelector('[name="content_json"]')?.value.includes('Exact submitter '+intent+' body.'),intent);
  const before=await page.evaluate(()=>({fields:[...new FormData(document.querySelector('form')).entries()],
    cas:document.querySelector('[name="expected_updated_at"]').value}));
  // The actual button contributes intent; no fixture FormData.set('intent',...) is allowed.
  await page.locator('button[name="intent"][value="'+intent+'"]').click();
  await waitUntil(()=>bridge.ready,'Actual action must settle behind held first response');
  const submitted=bridge.runtime.trace.actionCalls[0];
  const rawIntents=submitted.fields.filter(([name])=>name==='intent').map(([,value])=>value);
  assert.deepEqual(rawIntents,[intent],'Actual emitted submitter must survive urgent disabled state');
  assert.equal(submitted.intent.intent,intent,'Parsed default save alone is not the oracle');
  assert.equal(submitted.intent.expectedUpdatedAt,before.cas);
  const native=bridge.runtime.trace.wire.find(row=>row.pathname==='/rest/v1/rpc/save_page_operation');
  assert(native,'Actual installed-SDK mutation must be observed');
  assert.equal(native.body.p_payload.status,intent==='publish'?'published':'draft');
  assert.equal(native.body.p_submitted_intent.intent,intent);
  assert.deepEqual(native.body.p_submitted_intent.fields.filter(([name])=>name==='intent'),[['intent',intent]]);
  await page.waitForFunction(()=>[...document.querySelectorAll('button[name="intent"]')].every(button=>button.disabled)
    &&document.body.innerText.includes('Сохранение страницы...'));
  const pending=await page.evaluate(()=>({calls:window.__m20PageActor.calls,savingNotice:document.body.innerText.includes('Сохранение страницы...'),buttons:[...document.querySelectorAll('button[name="intent"]')].map(button=>({value:button.value,disabled:button.disabled}))}));
  assert.equal(pending.calls[0].state,'pending');
  const box=await page.locator('button[name="intent"][value="'+intent+'"]').boundingBox();
  assert(box,'Actual disabled submitter has pointer coordinates');
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const secondClick={attempted:true,actionCalls:bridge.runtime.trace.actionCalls.length,browserCalls:await page.evaluate(()=>window.__m20PageActor.calls.length)};
  assert.equal(secondClick.actionCalls,1);assert.equal(secondClick.browserCalls,1);
  release();
  await page.waitForFunction(()=>window.__m20PageActor.calls[0].state!=='pending');
  await page.waitForFunction(()=>!document.body.innerText.includes('Сохранение страницы...'));
  const final=await page.evaluate(()=>({status:document.querySelector('[name="status"]').value,
    cas:document.querySelector('[name="expected_updated_at"]').value,
    dirty:document.body.innerText.includes('Есть несохранённые изменения'),calls:window.__m20PageActor.calls}));
  assert.equal(final.status,intent==='publish'?'published':'draft');
  assert.equal(final.dirty,false);
  assert.equal(final.calls[0].result.receipt.canonicalStatus,intent==='publish'?'published':'draft');
  assert.equal(bridge.runtime.trace.canonicalWrites.length,1);
  assert.equal(bridge.runtime.trace.actionCalls.filter(row=>row.kind==='save').length,1);
  return {intent,before,rawIntents,submitted,native,pending,secondClick,final};
  } finally {
    release();
  }
}

export const proposedCases=Object.freeze(['actual-save-submitter-through-urgent-pending','actual-publish-submitter-through-urgent-pending']);
