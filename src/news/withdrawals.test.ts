import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { beginNewsWithdrawalUpdate, readKnownNewsWithdrawals, saveKnownNewsWithdrawals, NEWS_WITHDRAWAL_MAX_BYTES, NEWS_WITHDRAWAL_MAX_ROWS, NEWS_WITHDRAWAL_STORAGE_KEY } from "./withdrawals";
const time = "2026-09-01T12:00:00Z";
function storage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[NEWS_WITHDRAWAL_STORAGE_KEY, initial]]);
  return { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), values };
}
const rows = (count: number, offset = 0, reason = "r".repeat(500)) => Array.from({ length: count }, (_, index) => ({ id: `withdrawn-${index + offset}`, withdrawnAt: time, reason }));
afterEach(() => vi.restoreAllMocks());

describe("durable browser withdrawal history", () => {
  it("migrates real 4000 × 500-character legacy reasons beyond the former 2M cap without losing IDs", () => {
    const legacy = JSON.stringify(rows(4000)); expect(legacy.length).toBeGreaterThan(2_000_000);
    const target = storage(legacy), initial = readKnownNewsWithdrawals(target);
    expect(initial.reliable).toBe(true); expect(initial.rows).toHaveLength(4000);
    expect(beginNewsWithdrawalUpdate(target)).toBe(true);
    const saved = saveKnownNewsWithdrawals([], initial, target);
    expect(saved.reliable).toBe(true); expect(readKnownNewsWithdrawals(target).rows).toHaveLength(4000);
    const raw = target.getItem(NEWS_WITHDRAWAL_STORAGE_KEY)!;
    expect(raw.length).toBeLessThan(250_000); expect(raw).not.toContain("reason"); expect(JSON.parse(raw).rows[0]).toEqual(["withdrawn-0", time]);
  });
  it("preserves more than 5000 tombstones accumulated across complete snapshots and reloads", () => {
    const target = storage(); let history = readKnownNewsWithdrawals(target);
    expect(history).toMatchObject({ reliable: false, complete: true });
    expect(beginNewsWithdrawalUpdate(target)).toBe(true);
    history = saveKnownNewsWithdrawals(rows(4000), history, target);
    history = readKnownNewsWithdrawals(target);
    expect(beginNewsWithdrawalUpdate(target)).toBe(true);
    history = saveKnownNewsWithdrawals(rows(4000, 3000), history, target);
    expect(history.rows).toHaveLength(7000); expect(history.reliable).toBe(true);
    const reloaded = readKnownNewsWithdrawals(target);
    expect(reloaded.rows).toHaveLength(7000); expect(new Set(reloaded.rows.map(row => row.id)).size).toBe(7000);
  });
  it("retains the newest timestamp per identity without preserving long editorial reasons", () => {
    const target=storage();let history=saveKnownNewsWithdrawals(rows(1),readKnownNewsWithdrawals(target),target);
    history=saveKnownNewsWithdrawals([{id:"withdrawn-0",withdrawnAt:"2026-09-02T00:00:00Z",reason:"Changed reason"}],history,target);
    expect(history.rows).toEqual([{id:"withdrawn-0",withdrawnAt:"2026-09-02T00:00:00Z",reason:""}]);
  });
  it("leaves a durable dirty marker after quota failure so a reload cannot resurrect withdrawn stories", () => {
    const target=storage();let history=saveKnownNewsWithdrawals(rows(1),readKnownNewsWithdrawals(target),target);
    expect(beginNewsWithdrawalUpdate(target)).toBe(true);
    target.setItem.mockImplementation((key,value)=>{if(value.length>80)throw new Error("QuotaExceededError");target.values.set(key,value);});
    history=saveKnownNewsWithdrawals(rows(2),history,target);
    expect(history.reliable).toBe(false);expect(history.rows).toHaveLength(2);
    const reloaded=readKnownNewsWithdrawals(target);expect(reloaded).toMatchObject({reliable:false,complete:false});
    target.setItem.mockImplementation((key,value)=>{target.values.set(key,value);});
    expect(saveKnownNewsWithdrawals(rows(1),reloaded,target).reliable).toBe(false);
    expect(readKnownNewsWithdrawals(target).reliable).toBe(false);
  });
  it("blocks a live request before it learns new withdrawals if even the dirty marker cannot persist", () => {
    const target=storage(JSON.stringify(rows(1)));target.setItem.mockImplementation(()=>{throw new Error("SecurityError");});
    expect(beginNewsWithdrawalUpdate(target)).toBe(false);
    const panel=readFileSync("src/components/LiteraryNewsPanel.tsx","utf8");
    expect(panel.indexOf("if (!beginNewsWithdrawalUpdate())")).toBeLessThan(panel.indexOf("const response = await fetchNewsFeedWithTransientRetry(url"));
    expect(panel).toContain('if (!withdrawalHistory.current.reliable) throw new Error("Withdrawal history is incomplete")');
  });
  it("fails closed after row or byte capacity rather than silently forgetting part of the history", () => {
    const target=storage();const initial=readKnownNewsWithdrawals(target);
    expect(saveKnownNewsWithdrawals(rows(NEWS_WITHDRAWAL_MAX_ROWS+1),initial,target).reliable).toBe(false);
    expect(readKnownNewsWithdrawals(target)).toMatchObject({reliable:false,complete:false});
    const big=rows(16000).map((row,index)=>({...row,id:`${"x".repeat(110)}-${index}`}));
    expect(JSON.stringify(big.map(row=>[row.id,row.withdrawnAt])).length).toBeGreaterThan(NEWS_WITHDRAWAL_MAX_BYTES);
    expect(saveKnownNewsWithdrawals(big,initial,target).reliable).toBe(false);expect(readKnownNewsWithdrawals(target).reliable).toBe(false);
  });
  it.each(["{broken",JSON.stringify([{id:"x",withdrawnAt:"2026-02-30T12:00:00Z"}]),JSON.stringify([{id:"x",withdrawnAt:"2099-01-01T00:00:00Z"}]),JSON.stringify({schemaVersion:2,reliable:true,rows:[["valid",time],["",time]]})])("marks malformed history untrusted as a whole: %s",raw=>{
    expect(readKnownNewsWithdrawals(storage(raw))).toMatchObject({reliable:false,complete:false});
  });
  it("keeps the dirty marker on interrupted requests and allows a known-complete failed request to checkpoint unchanged history", () => {
    const target=storage();const initial=saveKnownNewsWithdrawals(rows(2),readKnownNewsWithdrawals(target),target);
    expect(beginNewsWithdrawalUpdate(target)).toBe(true);expect(readKnownNewsWithdrawals(target).reliable).toBe(false);
    expect(saveKnownNewsWithdrawals([],initial,target).reliable).toBe(true);expect(readKnownNewsWithdrawals(target).rows).toHaveLength(2);
  });
});
