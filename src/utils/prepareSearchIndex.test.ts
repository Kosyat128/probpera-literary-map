import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSearchIndexInBatches } from "./prepareSearchIndex";

afterEach(() => vi.useRealTimers());

describe("cooperative search index preparation", () => {
  it("defers iterator acquisition and consumption until the first host yield", async () => {
    let release!: () => void;
    const acquire = vi.fn(() => [3, 1, 2][Symbol.iterator]());
    const map = vi.fn((value: number) => value * 10);
    const preparation = mapSearchIndexInBatches({ [Symbol.iterator]: acquire }, map, {
      yieldToHost: () => new Promise<void>(resolve => { release = resolve; }),
      now: () => 0,
    });
    expect(acquire).not.toHaveBeenCalled();
    expect(map).not.toHaveBeenCalled();
    release();
    expect(await preparation).toEqual([30, 10, 20]);
    expect(acquire).toHaveBeenCalledTimes(1);
  });

  it("uses an actual timer task by default, including for an empty iterable", async () => {
    vi.useFakeTimers();
    const map = vi.fn((value: number) => value);
    const preparation = mapSearchIndexInBatches([1, 2], map);
    await Promise.resolve();
    expect(map).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    await vi.runAllTimersAsync();
    expect(await preparation).toEqual([1, 2]);
    const empty = mapSearchIndexInBatches([], map);
    expect(vi.getTimerCount()).toBe(1);
    await vi.runAllTimersAsync();
    expect(await empty).toEqual([]);
    expect(map).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("yields between bounded batches and preserves the complete result order", async () => {
    let consumed = 0;
    let mapped = 0;
    const turns: { consumed: number; mapped: number }[] = [];
    function* items() {
      for (let value = 0; value < 251; value += 1) {
        consumed += 1;
        yield value;
      }
    }
    const result = await mapSearchIndexInBatches(items(), value => { mapped += 1; return value * 2; }, {
      yieldToHost: async () => { turns.push({ consumed, mapped }); },
      now: () => 0,
    });
    expect(result).toEqual(Array.from({ length: 251 }, (_, index) => index * 2));
    expect(turns[0]).toEqual({ consumed: 0, mapped: 0 });
    expect(turns.length).toBeGreaterThan(2);
    const checkpoints = [...turns, { consumed, mapped }];
    for (let index = 1; index < checkpoints.length; index += 1) {
      expect(checkpoints[index].mapped - checkpoints[index - 1].mapped).toBeLessThanOrEqual(100);
      expect(checkpoints[index].consumed - checkpoints[index - 1].consumed).toBeLessThanOrEqual(100);
    }
  });

  it("maps a yielded object before a generator mutates and yields it again", async () => {
    const row = { n: 0 };
    function* items() {
      yield row;
      row.n = 1;
      yield row;
    }
    expect(await mapSearchIndexInBatches(items(), item => item.n, {
      yieldToHost: async () => {}, now: () => 0,
    })).toEqual([0, 1]);
  });

  it("charges generator work to the time budget before performing more synchronous work", async () => {
    let clock = 0;
    let turnStarted = 0;
    const generatorStarts: number[] = [];
    const mapperStarts: number[] = [];
    function* items() {
      for (let value = 0; value < 3; value += 1) {
        generatorStarts.push(clock - turnStarted);
        clock += 9;
        yield value;
      }
    }
    const result = await mapSearchIndexInBatches(items(), value => {
      mapperStarts.push(clock - turnStarted);
      clock += 9;
      return value;
    }, {
      yieldToHost: async () => { turnStarted = clock; },
      now: () => clock,
    });
    expect(result).toEqual([0, 1, 2]);
    expect(generatorStarts.every(elapsed => elapsed < 8)).toBe(true);
    expect(mapperStarts.every(elapsed => elapsed < 8)).toBe(true);
  });

  it("aborts before consumption or between batches and closes a started iterator", async () => {
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    const acquire = vi.fn(() => [1][Symbol.iterator]());
    await expect(mapSearchIndexInBatches({ [Symbol.iterator]: acquire }, value => value, {
      signal: alreadyAborted.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(acquire).not.toHaveBeenCalled();

    const controller = new AbortController();
    const reason = new Error("superseded locale");
    let closed = false;
    let turns = 0;
    const map = vi.fn((value: number) => value);
    function* items() {
      try { for (let value = 0; value < 250; value += 1) yield value; }
      finally { closed = true; }
    }
    await expect(mapSearchIndexInBatches(items(), map, {
      signal: controller.signal,
      now: () => 0,
      yieldToHost: async () => { if (++turns === 2) controller.abort(reason); },
    })).rejects.toBe(reason);
    expect(map.mock.calls.length).toBeGreaterThan(0);
    expect(map.mock.calls.length).toBeLessThanOrEqual(100);
    expect(closed).toBe(true);
  });

  it("stops mapper calls on an in-item abort and preserves mapper errors through cleanup", async () => {
    const controller = new AbortController();
    const map = vi.fn((value: number) => { controller.abort("obsolete"); return value; });
    const close = vi.fn(() => { throw new Error("cleanup failed"); });
    const iterator: Iterable<number> = {
      [Symbol.iterator]: () => ({ next: () => ({ value: 1, done: false }), return: close }),
    };
    await expect(mapSearchIndexInBatches(iterator, map, {
      signal: controller.signal, yieldToHost: async () => {}, now: () => 0,
    })).rejects.toBe("obsolete");
    expect(map).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    const failure = new Error("cannot compile source");
    await expect(mapSearchIndexInBatches(iterator, () => { throw failure; }, {
      yieldToHost: async () => {}, now: () => 0,
    })).rejects.toBe(failure);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid budgets before scheduling or consuming input", async () => {
    const yieldToHost = vi.fn(async () => {});
    const acquire = vi.fn(() => [1][Symbol.iterator]());
    for (const budgetMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(mapSearchIndexInBatches({ [Symbol.iterator]: acquire }, value => value, {
        budgetMs, yieldToHost,
      })).rejects.toBeInstanceOf(RangeError);
    }
    expect(yieldToHost).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  });
});
