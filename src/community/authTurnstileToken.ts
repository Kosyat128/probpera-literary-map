export const AUTH_TURNSTILE_RESET_EVENT =
  "probpera:auth-turnstile-reset";

let currentToken = "";

export function setAuthTurnstileToken(value: string) {
  currentToken = value.trim();
}

export function hasAuthTurnstileToken() {
  return currentToken.length > 0;
}

export function clearAuthTurnstileToken() {
  currentToken = "";
}

export function consumeAuthTurnstileToken() {
  const token = currentToken;
  currentToken = "";
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_TURNSTILE_RESET_EVENT));
  }
  return token || undefined;
}
