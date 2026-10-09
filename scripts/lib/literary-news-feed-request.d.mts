export function fetchNewsFeedWithTransientRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    fetchImpl?: typeof fetch;
    waitImpl?: (milliseconds: number, signal?: AbortSignal | null) => Promise<void>;
  },
): Promise<Response>;
