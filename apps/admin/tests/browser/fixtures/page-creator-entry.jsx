// Current route-compatible validation and actual loader/editor, never a raw unsupported-row mount.
import React from 'react';
import {createRoot} from 'react-dom/client';
import PageEditorLoader from '@/components/PageEditorLoader';
import {validPageEditorRead,canEditPageBundle} from '@/lib/page-load-validation';
import CreatePageForm from '@/app/(dashboard)/pages/CreatePageForm';
import {FieldChildren} from 'page-creator-current-field-children';
const h=window.__m19Creator;
async function main(){
  if(h.mode==='form'){
    h.reactVersion=React.version;
    createRoot(document.getElementById('root')).render(<CreatePageForm action={h.createAction}>
      <FieldChildren catalog={{term:'Exact original catalog query',status:'all',page:3}} />
    </CreatePageForm>);
    h.entryLoaded=true;return;
  }
  const response=await fetch('/fixture?case='+encodeURIComponent(h.scenario));
  if(!response.ok)throw Error('Controlled read fixture unavailable');
  const row=await response.json();
  const valid=validPageEditorRead(row,row.id),editable=valid&&canEditPageBundle(row);
  const current=editable?{page:row,actorId:'22222222-2222-4222-8222-222222222222',publicSiteUrl:'https://public.invalid',
    catalogContext:{q:'',status:'all',page:1,revisionPage:1}}:null;
  h.row=row;h.readValidation={validPageEditorRead:valid,canEditPageBundle:editable};h.reactVersion=React.version;
  createRoot(document.getElementById('root')).render(<PageEditorLoader pageId={row.id} actorId="22222222-2222-4222-8222-222222222222" current={current}
    retryHref={'/pages/'+row.id} fallback={<p data-m19-read-unavailable="true">Current read guard does not permit editing this stored document.</p>} />);
  h.entryLoaded=true;
}
void main().catch(error=>{h.entryError={name:error.name,message:error.message};throw error;});
