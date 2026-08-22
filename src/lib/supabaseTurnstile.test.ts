import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAuthTurnstileToken,
  hasAuthTurnstileToken,
  setAuthTurnstileToken,
} from "../community/authTurnstileToken";
import { installAuthTurnstile } from "./supabase";

function fakeClient() {
  const signUp = vi.fn(async (credentials: unknown) => ({
    data: { user: null, session: null },
    error: null,
    credentials,
  }));
  const signInWithPassword = vi.fn(async (credentials: unknown) => ({
    data: { user: null, session: null },
    error: null,
    credentials,
  }));
  const client = {
    auth: { signUp, signInWithPassword },
  } as unknown as SupabaseClient;
  return { client, signUp, signInWithPassword };
}

describe("Supabase Auth Turnstile bridge", () => {
  beforeEach(() => clearAuthTurnstileToken());

  it("injects a trimmed one-use token into sign-up without losing options", async () => {
    const { client, signUp } = fakeClient();
    installAuthTurnstile(client, true);
    setAuthTurnstileToken("  verified-signup-token  ");

    await client.auth.signUp({
      email: "reader@example.test",
      password: "correct horse battery staple",
      options: {
        data: { display_name: "Reader" },
        emailRedirectTo: "https://probpera.ru/",
      },
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "reader@example.test",
      password: "correct horse battery staple",
      options: {
        data: { display_name: "Reader" },
        emailRedirectTo: "https://probpera.ru/",
        captchaToken: "verified-signup-token",
      },
    });
    expect(hasAuthTurnstileToken()).toBe(false);
  });

  it("injects and consumes the token for password sign-in", async () => {
    const { client, signInWithPassword } = fakeClient();
    installAuthTurnstile(client, true);
    setAuthTurnstileToken("verified-login-token");

    await client.auth.signInWithPassword({
      email: "reader@example.test",
      password: "correct horse battery staple",
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "reader@example.test",
      password: "correct horse battery staple",
      options: { captchaToken: "verified-login-token" },
    });
    expect(hasAuthTurnstileToken()).toBe(false);
  });

  it("leaves auth methods and tokens untouched while protection is disabled", async () => {
    const { client, signUp } = fakeClient();
    const originalSignUp = client.auth.signUp;
    setAuthTurnstileToken("not-consumed");

    installAuthTurnstile(client, false);
    expect(client.auth.signUp).toBe(originalSignUp);
    await client.auth.signUp({
      email: "reader@example.test",
      password: "correct horse battery staple",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "reader@example.test",
      password: "correct horse battery staple",
    });
    expect(hasAuthTurnstileToken()).toBe(true);
  });
});
