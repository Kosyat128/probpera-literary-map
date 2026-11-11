import React, {useEffect, useState} from 'react';
import {hydrateRoot} from 'react-dom/client';
import PublicationRetryForm from '@/app/(dashboard)/publication/PublicationRetryForm';

const boot=JSON.parse(document.getElementById('publication-retry-bootstrap').textContent);
const observation=window.__publicationRetryClient={hydrated:false,posts:[],results:[],rerender:null};
async function action(data) {
  const entries=[...data.entries()];observation.posts.push(entries);
  const response=await fetch('/_fixture/retry',{method:'POST',body:new URLSearchParams(entries)});
  if(!response.ok)throw Error('Controlled local action bridge failed');
  const result=await response.json();observation.results.push(result);return result;
}
function Fixture() {
  const [request,setRequest]=useState(boot.request),[revision,setRevision]=useState(0);
  observation.rerender=()=>{setRequest({...boot.unrelatedRequest});setRevision(value=>value+1);};
  observation.parentRevision=revision;
  useEffect(()=>{observation.hydrated=true;},[]);
  return <PublicationRetryForm key={boot.request.outboxId+':'+boot.request.expectedUpdatedAt}
    request={request} action={action} catalog={boot.catalog} />;
}
hydrateRoot(document.getElementById('publication-retry-root'),<Fixture />);
