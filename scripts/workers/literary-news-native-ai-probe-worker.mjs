import { createPreparationBindingAi } from './literary-news-preparation-worker.mjs';
import { NATIVE_AI_PROBE_URL, NATIVE_AI_PROBE_DRAFT, NATIVE_AI_PROBE_REVIEW,
  NATIVE_AI_PROBE_MESSAGES, matchesNativeAiProbeFixture, nativeAiProbeReport } from '../lib/literary-news-native-ai-probe-fixture.mjs';

// This local-only fixture has no scheduler, publication binding or caller-defined prompt.
// The production adapter and its AbortSignal execute in the Workers runtime itself.
export function createNativeAiProbeWorker() {
  let consumed = false;
  return { async fetch(request, env) {
    if (request.url !== NATIVE_AI_PROBE_URL || request.method !== 'POST') {
      return new Response(null, { status: 404 });
    }
    // An HTTP POST may expose an empty stream even when the sender supplied no body.
    if (request.body !== null) {
      const reader = request.body.getReader();
      try { if (!(await reader.read()).done) return new Response(null, { status: 404 }); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    if (consumed) return Response.json({ code: 'native_ai_probe_already_consumed', stage: 'configuration' }, { status: 409 });
    consumed = true;
    let stage = 'configuration';
    try {
      const client = createPreparationBindingAi(env.AI);
      for (const phase of ['draft', 'review']) {
        stage = phase;
        const result = await client.request({ phase, messages: structuredClone(NATIVE_AI_PROBE_MESSAGES) });
        if (!matchesNativeAiProbeFixture(result, phase === 'draft' ? NATIVE_AI_PROBE_DRAFT : NATIVE_AI_PROBE_REVIEW)) {
          throw Error('native_ai_probe_fixture_unconfirmed');
        }
      }
      return Response.json(nativeAiProbeReport());
    } catch (error) {
      const code = /^(?:native_ai_probe_|ai_|daily_)[a-z0-9_]+$/.test(error?.message || '')
        ? error.message : 'native_ai_probe_remote_binding_unavailable';
      return Response.json({ code, stage }, { status: 503 });
    }
  } };
}

export default createNativeAiProbeWorker();
