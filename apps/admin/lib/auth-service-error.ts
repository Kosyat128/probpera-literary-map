import { unstable_rethrow } from "next/navigation";

type ProviderError = { status?: number | string; statusCode?: number | string; code?: string; name?: string };

/** Describe service failures without exposing provider replies or account existence. */
export function authServiceError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as ProviderError;
  const status = Number(value.status ?? value.statusCode);
  if (status === 402) return "Сервис авторизации временно ограничен. Вход и восстановление пароля сейчас недоступны. Повторите попытку позже.";
  if (status === 429 || value.code === "over_request_rate_limit" || value.code === "over_email_send_rate_limit") {
    return "Слишком много попыток. Подождите несколько минут перед повторным входом или запросом письма.";
  }
  if (status >= 500 || value.name === "AuthRetryableFetchError" || value.name === "TypeError" || value.name === "AbortError" || value.name === "TimeoutError") {
    return "Сервис авторизации временно недоступен. Повторите попытку позже.";
  }
  return null;
}

export async function guardedAuthRequest<T extends { error: unknown }>(request: () => Promise<T>): Promise<T | { error: unknown }> {
  try {
    const response = await request();
    unstable_rethrow(response.error);
    return response;
  }
  catch (error) {
    unstable_rethrow(error);
    return { error: error || Object.assign(new Error("auth_request_failed"), { name: "AuthRetryableFetchError" }) };
  }
}

export function logAuthFailure(operation: string, error: unknown) {
  const value = error && typeof error === "object" ? error as ProviderError : {};
  const status = Number(value.status ?? value.statusCode);
  console.error("Admin auth unavailable", { operation, status: Number.isInteger(status) ? status : null,
    code: typeof value.code === "string" && /^[a-z_]{1,80}$/.test(value.code) ? value.code : "auth_request_failed" });
}
