// Finite independent observations only. No app imports or replica creator/editor logic.
module.exports=function evaluate(scenario,prepared,observation){
  const checks=[];
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const check=(name,pass,details)=>checks.push({name,pass:Boolean(pass),...(details===undefined?{}:{details})});
  const expected=scenario.paragraphs,trace=prepared.runtime.trace;
  if(scenario.kind==='actual-create'){
    check('actual current creator emitted exactly one installed-SDK insert and native redirect',prepared.trace.actualCreator&&trace.createPayloads.length===1&&typeof prepared.trace.nativeRedirect?.digest==='string'&&prepared.trace.nativeRedirect.digest.startsWith('NEXT_REDIRECT;'));
    check('original supported creator input contains the exact two author paragraphs',new Map(prepared.trace.creationFormFields).get('content')===expected.join('\n\n'));
    check('creator HTML retains authored plain paragraph text literally',equal(observation.storedHTMLParagraphs,expected),{expected,actual:observation.storedHTMLParagraphs});
    check('creator JSON retains the same authored paragraphs',equal(observation.storedJSONParagraphs,expected),{expected,actual:observation.storedJSONParagraphs});
  }else check('coherent positive control is honestly synthetic, with no fake creator result',!prepared.trace.actualCreator&&trace.createPayloads.length===0&&prepared.trace.nativeRedirect===null);
  check('stored HTML and JSON paragraph texts are coherent',equal(observation.storedHTMLParagraphs,observation.storedJSONParagraphs),{html:observation.storedHTMLParagraphs,json:observation.storedJSONParagraphs});
  check('actual installed-SDK read returns the exact controlled persistence projection',prepared.trace.SDKReadWire.length===1&&equal(prepared.trace.SDKReadWire[0].response,[prepared.row]));
  check('actual current page read validator accepts the returned row shape',observation.readValidation?.validPageEditorRead===true);
  check('created nonempty page is editable through the real bundle guard and loader',observation.readValidation?.canEditPageBundle===true&&observation.editorAvailable&&!observation.guardUnavailable,{readValidation:observation.readValidation,guardUnavailable:observation.guardUnavailable});
  check('actual reopened editor displays both exact authored paragraphs',equal(observation.editorParagraphs,expected),{expected,actual:observation.editorParagraphs,guardUnavailable:observation.guardUnavailable});
  check('actual editable hidden HTML and JSON preserve the same author text',observation.editorAvailable&&equal(observation.hiddenHTMLParagraphs,expected)&&equal(observation.hiddenJSONParagraphs,expected),{html:observation.hiddenHTMLParagraphs,json:observation.hiddenJSONParagraphs});
  check('initial reopen never submits a save/check or silently mutates canonical transport',prepared.trace.browserActionCalls.length===0&&trace.canonicalWrites.length===0&&trace.actionCalls.filter(call=>call.kind!=='create').length===0);
  check('no active script or literal-tag markup execution',observation.activeMarkupProbe===0&&observation.editorScriptNodes===0&&(scenario.id!=='creator-literal-tags'||observation.editorEmNodes===0));
  check('no automatic initial dirty state or autosave deletion',!observation.dirty&&observation.autosave.every(call=>call.kind!=='delete'));
  check('no unhandled actual component or observer error',observation.pageErrors.length===0&&!observation.entryError&&!observation.executionError);
  check('no external browser/provider/translation transport',observation.externalRequests.length===0&&trace.external.length===0&&trace.forbiddenTranslationCalls.length===0);
  return checks;
};
