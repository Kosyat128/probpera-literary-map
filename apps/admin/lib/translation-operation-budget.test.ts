import { describe, expect, it } from "vitest";

import {
  createTranslationOperationBudget,
  TranslationOperationBudgetError,
} from "./translation-operation-budget";

describe("shared translation operation budget", () => {
  it("counts unsuccessful attempts and stops the next candidate", () => {
    const budget = createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 300_000 });
    budget.startAttempt();
    budget.startAttempt();
    expect(budget.snapshot().attempts).toBe(2);
    expect(budget.exhaustedReason()).toBe("attempt-limit");
    expect(() => budget.startAttempt()).toThrow(TranslationOperationBudgetError);
    expect(budget.snapshot().attempts).toBe(2);
  });

  it("allows review of the final admitted attempt and bounds actual calls", () => {
    const budget = createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 2, deadlineMs: 300_000 });
    budget.startAttempt();
    budget.beforeProviderCall();
    budget.beforeProviderCall();
    expect(budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 2 });
    expect(budget.exhaustedReason()).toBe("provider-call-limit");
    expect(() => budget.beforeProviderCall()).toThrow(TranslationOperationBudgetError);
    expect(budget.snapshot().providerCalls).toBe(2);
  });

  it("blocks starts exactly at a deadline without counting a denied request", () => {
    let clock = 100;
    const budget = createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 10, now: () => clock });
    budget.startAttempt();
    clock = 109;
    budget.beforeProviderCall();
    clock = 110;
    expect(budget.exhaustedReason()).toBe("deadline");
    expect(() => budget.beforeProviderCall()).toThrow(TranslationOperationBudgetError);
    expect(() => budget.startAttempt()).toThrow(TranslationOperationBudgetError);
    expect(budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 1, elapsedMs: 10 });
  });

  it("cannot replenish an observed deadline when the wall clock moves backwards", () => {
    let clock = 1_000;
    const budget = createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 20, now: () => clock });
    clock = 1_020;
    expect(budget.exhaustedReason()).toBe("deadline");
    clock = 500;
    expect(budget.snapshot().elapsedMs).toBe(20);
    expect(() => budget.startAttempt()).toThrow(TranslationOperationBudgetError);
  });

  it("fails closed when the clock becomes invalid", () => {
    let clock = 0;
    const budget = createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 20, now: () => clock });
    clock = Number.NaN;
    expect(budget.exhaustedReason()).toBe("deadline");
    expect(budget.snapshot().elapsedMs).toBe(20);
  });

  it("stop prevents any new attempt or pass without inventing cancellation", () => {
    const budget = createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 300_000 });
    budget.startAttempt();
    budget.beforeProviderCall();
    budget.stop();
    expect(budget.exhaustedReason()).toBe("stopped");
    expect(() => budget.startAttempt()).toThrow(TranslationOperationBudgetError);
    expect(() => budget.beforeProviderCall()).toThrow(TranslationOperationBudgetError);
    expect(budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 1, stopped: true });
  });

  it("snapshots are detached from counters", () => {
    const budget = createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 300_000 });
    const first = budget.snapshot();
    first.attempts = 100;
    first.providerCalls = 100;
    expect(budget.snapshot()).toMatchObject({ attempts: 0, providerCalls: 0 });
  });

  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("rejects invalid configured limits %s", value => {
    for (const key of ["maxAttempts", "maxProviderCalls", "deadlineMs"] as const) {
      expect(() => createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 300_000, [key]: value })).toThrow(TypeError);
    }
  });

  it("rejects a malformed initial clock", () => {
    expect(() => createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 8, deadlineMs: 300_000, now: () => Number.NaN })).toThrow(TypeError);
  });
});
