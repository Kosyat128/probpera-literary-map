import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { consumeAuthTurnstileToken } from "../community/authTurnstileToken";
import {
  isAuthTurnstileConfigured,
  isCommunityConfigured,
  supabaseConnection,
} from "./supabaseConfig";

export {
  isAuthTurnstileConfigured,
  isCommunityConfigured,
} from "./supabaseConfig";

const authTurnstileInstallationMarker =
  "__probperaAuthTurnstileInstalled__";

type CaptchaCredentials = {
  options?: Record<string, unknown>;
};

function withTurnstileToken<T extends CaptchaCredentials>(credentials: T): T {
  const captchaToken = consumeAuthTurnstileToken();
  return {
    ...credentials,
    options: {
      ...(credentials.options || {}),
      ...(captchaToken ? { captchaToken } : {}),
    },
  } as T;
}

export function installAuthTurnstile(
  client: SupabaseClient,
  enabled = isAuthTurnstileConfigured
) {
  if (!enabled) return client;
  const auth = client.auth;
  const markerHost = auth as unknown as Record<string, unknown>;
  if (markerHost[authTurnstileInstallationMarker] === true) return client;

  const originalSignUp = auth.signUp.bind(auth);
  const originalSignInWithPassword = auth.signInWithPassword.bind(auth);

  Object.defineProperty(auth, "signUp", {
    configurable: true,
    writable: true,
    value: ((credentials: Parameters<typeof originalSignUp>[0]) =>
      originalSignUp(
        withTurnstileToken(
          credentials as Parameters<typeof originalSignUp>[0] &
            CaptchaCredentials
        )
      )) as typeof auth.signUp,
  });
  Object.defineProperty(auth, "signInWithPassword", {
    configurable: true,
    writable: true,
    value: ((credentials: Parameters<typeof originalSignInWithPassword>[0]) =>
      originalSignInWithPassword(
        withTurnstileToken(
          credentials as Parameters<typeof originalSignInWithPassword>[0] &
            CaptchaCredentials
        )
      )) as typeof auth.signInWithPassword,
  });
  Object.defineProperty(auth, authTurnstileInstallationMarker, {
    configurable: false,
    value: true,
  });
  return client;
}

export const supabase = isCommunityConfigured
  ? installAuthTurnstile(
      createClient(
        supabaseConnection.url!,
        supabaseConnection.publishableKey!,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }
      )
    )
  : null;
