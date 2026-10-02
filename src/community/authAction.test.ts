import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authActionCopy, classifyAuthActionError, createCommunityAuthActions } from "./authAction";
function fixture(timeoutMs = 100) {
  const signUp = vi.fn(async (_value: unknown) => ({ error: null })), signInWithPassword = vi.fn(async (_value: unknown) => ({ error: null })), signOut = vi.fn(async (_value: unknown) => ({ error: null }));
  const auth = { signUp, signInWithPassword, signOut } as unknown as Pick<SupabaseClient["auth"], "signUp" | "signInWithPassword" | "signOut">;
  return { signUp, signInWithPassword, signOut, actions: createCommunityAuthActions(auth, timeoutMs) };
}
afterEach(() => vi.useRealTimers());
describe("existing email/password account actions", () => {
  it("passes registration and confirmation redirect to the existing provider unchanged", async () => {
    const f = fixture(), value = { email: "synthetic@example.test", password: "synthetic-test-password", options: { emailRedirectTo: "https://probpera.ru/en/planet-account/", data: { display_name: "Synthetic Reader" } } };
    expect(await f.actions.signUp(value)).toBeNull(); expect(f.signUp).toHaveBeenCalledWith(value);
    expect(await f.actions.signIn({ email: value.email, password: value.password })).toBeNull();
    expect(f.signInWithPassword).toHaveBeenCalledWith({ email: value.email, password: value.password });
    expect(await f.actions.signOut()).toBeNull(); expect(f.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each([["email_not_confirmed", "confirmation-required"], ["invalid_credentials", "invalid-credentials"],
    ["weak_password", "password-rejected"], ["user_already_exists", "already-registered"], ["over_request_rate_limit", "rate-limited"]])("maps %s to fixed RU/EN messages", (code, expected) => {
    const reason = classifyAuthActionError({ code, message: "SYNTHETIC PRIVATE ACCOUNT DETAIL" }); expect(reason).toBe(expected);
    expect(authActionCopy.ru[reason]).toBeTruthy(); expect(authActionCopy.en[reason]).toBeTruthy();
    expect(JSON.stringify([authActionCopy.ru[reason], authActionCopy.en[reason]])).not.toContain("PRIVATE ACCOUNT");
  });
  it("handles old SDK error messages and unknown statuses without displaying upstream bodies", () => {
    expect(classifyAuthActionError({ message: "Invalid login credentials" })).toBe("invalid-credentials");
    expect(classifyAuthActionError({ status: 429 })).toBe("rate-limited");
    for (const value of [null, "raw body", { message: "PRIVATE SERVER DIAGNOSTIC" }, { status: 503 }, { status: 402 }, { status: 403 }]) expect(classifyAuthActionError(value)).toBe("unavailable");
  });
  it("keeps an uncertain SDK transaction locked after timeout until it actually settles", async () => {
    vi.useFakeTimers(); const f = fixture(); let resolve!: (value: { error: null }) => void;
    f.signInWithPassword.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const first = f.actions.signIn({ email: "synthetic@example.test", password: "synthetic-password" });
    await vi.advanceTimersByTimeAsync(100); expect(await first).toBe("unavailable");
    expect(await f.actions.signIn({ email: "synthetic@example.test", password: "synthetic-password" })).toBe("unavailable");
    expect(f.signInWithPassword).toHaveBeenCalledTimes(1);
    resolve({ error: null }); await Promise.resolve(); await Promise.resolve();
    expect(await f.actions.signIn({ email: "synthetic@example.test", password: "synthetic-password" })).toBeNull();
  });
  it("sanitizes rejected signout and lets a subsequent explicit action retry", async () => {
    const f = fixture(); f.signOut.mockRejectedValueOnce(new Error("PRIVATE DETAIL"));
    expect(await f.actions.signOut()).toBe("unavailable"); expect(await f.actions.signOut()).toBeNull();
  });
});
