function aborted(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('News request aborted', 'AbortError');
}

function waitForRetry(milliseconds, signal) {
  aborted(signal);
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(signal.reason ?? new DOMException('News request aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

/** Retry only the reader's explicit short busy response, within the caller's deadline.
 * Each attempt uses the supplied fetch, including native per-tick request budgets. */
export async function fetchNewsFeedWithTransientRetry(input, init = {}, { fetchImpl = fetch, waitImpl = waitForRetry } = {}) {
  const request = input instanceof Request ? input : null;
  const method = String(init.method ?? request?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') throw Error('news_feed_retry_requires_get');
  const expectedUrl = new URL(request ? request.url : String(input)).href;
  const signal = init.signal ?? request?.signal;
  for (let attempt = 0; attempt < 3; attempt++) {
    aborted(signal);
    const response = await fetchImpl(input, init);
    const retryAfter = response.headers.get('retry-after');
    const retryable = response.status === 503 && !response.redirected && response.url === expectedUrl
      && /^(?:1|2)$/.test(retryAfter ?? '');
    if (!retryable || attempt === 2) return response;
    await response.body?.cancel().catch(() => {});
    aborted(signal);
    await waitImpl(Number(retryAfter) * 1000, signal);
  }
  throw Error('news_feed_retry_exhausted');
}
