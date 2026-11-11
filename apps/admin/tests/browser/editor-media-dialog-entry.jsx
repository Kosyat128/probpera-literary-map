import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import EditorMediaDialog from '@/components/EditorMediaDialog';

function Fixture() {
  const [open,setOpen]=useState(false),[queue,setQueue]=useState([]),[selected,setSelected]=useState([]);
  window.__mediaFixture={selected,queue,setQueue,open};
  return <main><label>Article draft<textarea aria-label="Article draft" defaultValue="Exact manually authored source and rights remain unchanged." /></label>
    <button id="open-media" onClick={()=>setOpen(true)}>Open actual media dialog</button>
    <EditorMediaDialog open={open} queue={queue} onClose={()=>setOpen(false)}
      onPickFiles={()=>{throw Error('Actual upload workflow is outside this minimal before slice');}}
      onSelectAsset={asset=>{setSelected(value=>[...value,structuredClone(asset)]);setOpen(false);}}
      onCancelItem={()=>{throw Error('Unused upload boundary');}} onRetryItem={()=>{throw Error('Unused upload boundary');}} />
    <output id="selected-assets">{JSON.stringify(selected)}</output></main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
