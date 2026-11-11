import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import RecoveryController from '@/components/editor/RecoveryController';

const h = window.__m20Scope;
const initial = { entityType: 'page', entityId: '66666666-6666-4666-8666-666666666666', draftScope: '66666666-6666-4666-8666-666666666666', localeScope: 'default', baseUpdatedAt: '2026-10-30T10:00:00.123456Z' };
h.flush = async (index, result, reject = false) => { await React.act(async () => { h.settle(index, result, reject); await Promise.resolve(); }); };
h.flushEffects = async () => { await React.act(async () => { await Promise.resolve(); }); };
function Harness() {
  const [text, setText] = useState('Authored snapshot S');
  const [locator, setLocator] = useState(initial);
  const next = () => h.scenario.startsWith('locale-') ? { ...initial, localeScope: 'en' }
    : h.scenario.startsWith('version-') ? { ...initial, baseUpdatedAt: '2026-10-30T10:01:00.654321Z' }
    : h.scenario === 'same-locator-control' ? { ...initial }
    : { ...initial, entityId: '77777777-7777-4777-8777-777777777777', draftScope: '77777777-7777-4777-8777-777777777777' };
  return <>
    <label>Current input<textarea aria-label="Current input" value={text} onChange={event => setText(event.target.value)} /></label>
    <button type="button" onClick={() => setLocator(next())}>Switch locator</button>
    <output data-locator>{JSON.stringify(locator)}</output>
    <RecoveryController locator={locator} snapshot={{ title: text }} isDirty savedAfterSubmit={false}
      onRestore={snapshot => { setText(snapshot.title); return true; }} />
  </>;
}
React.act(() => { createRoot(document.getElementById('root')).render(<Harness />); });
