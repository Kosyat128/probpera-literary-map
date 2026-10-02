import type { SupabaseClient } from "@supabase/supabase-js";
type AuthPort = Pick<SupabaseClient["auth"], "signUp" | "signInWithPassword" | "signOut">;
export type AuthActionError = "unavailable" | "invalid-credentials" | "confirmation-required" | "rate-limited" | "password-rejected" | "already-registered";
export const authActionCopy = Object.freeze({
  ru: { retry: "Повторить проверку аккаунта", unavailable: "Не удалось проверить аккаунт. Проверьте подключение и повторите попытку.",
    "invalid-session": "Сессия аккаунта больше не подтверждена. Войдите снова.", "invalid-credentials": "Почта или пароль указаны неверно.",
    "confirmation-required": "Подтвердите адрес по ссылке в письме, затем войдите.", "rate-limited": "Слишком много запросов. Подождите немного и повторите попытку.",
    "password-rejected": "Пароль не соответствует требованиям безопасности.", "already-registered": "Этот адрес уже зарегистрирован. Переключитесь на вход.",
    privacyFailed: "Не удалось полностью очистить личные данные на этом устройстве. Повторите очистку.", privacyRetry: "Повторить очистку",
    signoutFailed: "Не удалось завершить выход. Проверьте подключение и повторите попытку." },
  en: { retry: "Check account again", unavailable: "Your account could not be verified. Check your connection and try again.",
    "invalid-session": "Your account session is no longer verified. Sign in again.", "invalid-credentials": "The email address or password is incorrect.",
    "confirmation-required": "Confirm your address using the email link, then sign in.", "rate-limited": "Too many requests. Wait a little and try again.",
    "password-rejected": "The password does not meet the security requirements.", "already-registered": "This address is already registered. Switch to sign in.",
    privacyFailed: "Private data on this device could not be fully cleared. Retry the cleanup.", privacyRetry: "Retry cleanup",
    signoutFailed: "Sign-out could not be completed. Check your connection and try again." },
});
export function classifyAuthActionError(value: unknown): AuthActionError {
  if (!value || typeof value !== "object") return "unavailable";
  const error = value as { code?: unknown; status?: unknown; message?: unknown };
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") return "rate-limited";
  if (error.code === "email_not_confirmed") return "confirmation-required";
  if (error.code === "invalid_credentials") return "invalid-credentials";
  if (error.code === "weak_password") return "password-rejected";
  if (error.code === "user_already_exists" || error.code === "email_exists") return "already-registered";
  // Fixed localized messages, never upstream diagnostics or account details.
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "invalid-credentials";
  if (message.includes("already registered") || message.includes("already been registered")) return "already-registered";
  if (message.includes("email rate limit")) return "rate-limited";
  return "unavailable";
}
/** A timeout reports uncertainty. Only the canonical observer owns a later SDK
 * result. Keep this action locked until that transaction actually settles. */
export function createCommunityAuthActions(auth: AuthPort, timeoutMs = 10_000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError("Invalid auth action timeout");
  let pending = false;
  async function perform(start: () => PromiseLike<{ error: unknown }>): Promise<AuthActionError | null> {
    if (pending) return "unavailable";
    pending = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const transaction = Promise.resolve().then(start);
    void transaction.finally(() => { pending = false; }).catch(() => {});
    try {
      const result = await Promise.race([transaction, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Authentication timed out")), timeoutMs);
      })]);
      return result.error ? classifyAuthActionError(result.error) : null;
    } catch { return "unavailable"; }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }
  return Object.freeze({
    signIn(credentials: Parameters<AuthPort["signInWithPassword"]>[0]) { return perform(() => auth.signInWithPassword(credentials)); },
    signUp(credentials: Parameters<AuthPort["signUp"]>[0]) { return perform(() => auth.signUp(credentials)); },
    signOut() { return perform(() => auth.signOut({ scope: "local" })); },
  });
}
