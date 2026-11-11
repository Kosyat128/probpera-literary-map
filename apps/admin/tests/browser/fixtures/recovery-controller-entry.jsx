import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import RecoveryController from '@/components/editor/RecoveryController';
const h=window.__m20Recovery;
h.flush=async(index,value,reject=false)=>{await React.act(async()=>{h.settle(index,value,reject);await Promise.resolve();});};
const base={entityType:'page',entityId:'66666666-6666-4666-8666-666666666666',draftScope:'66666666-6666-4666-8666-666666666666',localeScope:'default',baseUpdatedAt:'2026-10-30T10:00:00.123456Z'};
function Harness(){
 const [text,setText]=useState('Unchanged authored input B'),[locator,setLocator]=useState(base);
 return <><label>Current authored input<textarea aria-label="Current authored input" value={text} onChange={event=>setText(event.target.value)}/></label>
  <button type="button" onClick={()=>setLocator({...base,entityId:'77777777-7777-4777-8777-777777777777',draftScope:'77777777-7777-4777-8777-777777777777'})}>Switch actual locator</button>
  <output data-current-locator>{locator.entityId}</output>
  <RecoveryController locator={locator} snapshot={{title:text}} isDirty={false} savedAfterSubmit={false} onRestore={snapshot=>{h.restores.push(snapshot);setText(snapshot.title);return true;}}/>
 </>;
}
React.act(()=>{createRoot(document.getElementById('root')).render(<Harness/>);});
