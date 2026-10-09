export type TranslationOperationBudgetReason =
  | "attempt-limit"
  | "provider-call-limit"
  | "deadline"
  | "stopped";

export type TranslationOperationBudgetSnapshot = {
  attempts: number;
  providerCalls: number;
  maxAttempts: number;
  maxProviderCalls: number;
  elapsedMs: number;
  deadlineMs: number;
  stopped: boolean;
};

export class TranslationOperationBudgetError extends Error {
  readonly code = "translation_operation_budget_exhausted";

  constructor(readonly reason: TranslationOperationBudgetReason) {
    super(`Translation operation stopped before a new request: ${reason}`);
    this.name = "TranslationOperationBudgetError";
  }
}

export type TranslationOperationBudget = {
  startAttempt(): void;
  beforeProviderCall(): void;
  stop(): void;
  snapshot(): TranslationOperationBudgetSnapshot;
  exhaustedReason(): TranslationOperationBudgetReason | null;
};

/** Shared by a whole bounded operation, including every translation and repair. */
export function createTranslationOperationBudget(options: {
  maxAttempts: number;
  maxProviderCalls: number;
  deadlineMs: number;
  now?: () => number;
}): TranslationOperationBudget {
  for (const [name, value] of Object.entries({
    maxAttempts: options.maxAttempts,
    maxProviderCalls: options.maxProviderCalls,
    deadlineMs: options.deadlineMs,
  })) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`Invalid translation operation budget: ${name}`);
    }
  }
  const now = options.now ?? Date.now;
  const startedAt = now();
  if (!Number.isFinite(startedAt)) {
    throw new TypeError("Invalid translation operation clock");
  }
  let observedAt = startedAt;
  let attempts = 0;
  let providerCalls = 0;
  let stopped = false;

  const elapsedMs = () => {
    const current = now();
    // A malformed clock or a backwards wall-clock adjustment cannot replenish
    // an elapsed budget. Production uses Date.now; tests may inject a clock.
    observedAt = Number.isFinite(current)
      ? Math.max(observedAt, current)
      : Math.max(observedAt, startedAt + options.deadlineMs);
    return Math.max(0, observedAt - startedAt);
  };
  const commonReason = (): TranslationOperationBudgetReason | null => {
    if (stopped) return "stopped";
    if (elapsedMs() >= options.deadlineMs) return "deadline";
    if (providerCalls >= options.maxProviderCalls) return "provider-call-limit";
    return null;
  };

  return {
    startAttempt() {
      const reason = commonReason() ??
        (attempts >= options.maxAttempts ? "attempt-limit" : null);
      if (reason) throw new TranslationOperationBudgetError(reason);
      attempts += 1;
    },
    beforeProviderCall() {
      // The final admitted attempt may use its remaining passes. Reaching the
      // attempt cap prevents the next item, not review of the admitted item.
      const reason = commonReason();
      if (reason) throw new TranslationOperationBudgetError(reason);
      providerCalls += 1;
    },
    stop() {
      stopped = true;
    },
    snapshot() {
      return {
        attempts,
        providerCalls,
        maxAttempts: options.maxAttempts,
        maxProviderCalls: options.maxProviderCalls,
        elapsedMs: elapsedMs(),
        deadlineMs: options.deadlineMs,
        stopped,
      };
    },
    exhaustedReason() {
      return commonReason() ??
        (attempts >= options.maxAttempts ? "attempt-limit" : null);
    },
  };
}
