import { supabase } from "../lib/supabase";
import { getCommunitySessionId } from "./sessionIdentity";

export type ClientErrorSource = "runtime" | "promise" | "react" | "resource" | "manual";

const sensitiveContextKey =
  /(?:authorization|password|passcode|secret|token|otp|email|code|confirmation|credential)/iu;
const sensitiveUrlValue =
  /([?&#](?:access_token|refresh_token|provider_token|token|otp|password|email|code|confirmation_url|redirect_to|next)=)[^&#\s]+/giu;
const bearerValue = /\bBearer\s+[^\s,;]+/giu;
const jwtValue = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/gu;
const secretKeyValue = /\bsb_secret_[a-zA-Z0-9._-]+\b/gu;
const emailValue = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `web-${(hash >>> 0).toString(36)}`;
}

function safeMessage(value: unknown) {
  if (value instanceof Error) return value.message || value.name;
  if (typeof value === "string") return value;
  return "Неизвестная ошибка интерфейса";
}

export function redactDiagnosticText(value: unknown, maxLength = 6000) {
  return String(value ?? "")
    .replace(sensitiveUrlValue, "$1[redacted]")
    .replace(bearerValue, "Bearer [redacted]")
    .replace(jwtValue, "[redacted-jwt]")
    .replace(secretKeyValue, "[redacted-key]")
    .replace(emailValue, "[redacted-email]")
    .slice(0, maxLength);
}

export function diagnosticPath(
  locationValue: Pick<Location, "pathname" | "hash">
) {
  const pathname = locationValue.pathname || "/";
  const safeHash = /^#[a-z][a-z0-9-]{0,80}$/iu.test(locationValue.hash || "")
    ? locationValue.hash
    : "";
  return `${pathname}${safeHash}`.slice(0, 500);
}

export function sanitizeDiagnosticContext(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return redactDiagnosticText(value, 1000);
  if (typeof value === "bigint") return value.toString();
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (depth >= 3 || typeof value !== "object") return "[truncated]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeDiagnosticContext(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 30)) {
    output[key.slice(0, 120)] = sensitiveContextKey.test(key)
      ? "[redacted]"
      : sanitizeDiagnosticContext(entry, depth + 1, seen);
  }
  return output;
}

export function reportClientError(
  error: unknown,
  source: ClientErrorSource,
  context: Record<string, unknown> = {}
) {
  if (!supabase) return;
  const message = redactDiagnosticText(safeMessage(error), 1000);
  const stack = redactDiagnosticText(
    error instanceof Error ? error.stack || "" : "",
    6000
  );
  const path = diagnosticPath(window.location);
  const signature = fingerprint(`${source}:${message}:${stack.split("\n")[1] || path}`);
  const safeContext = sanitizeDiagnosticContext({
    ...context,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
  });
  void supabase.rpc("submit_client_error", {
    p_session_id: getCommunitySessionId(),
    p_message: message,
    p_stack: stack,
    p_path: path,
    p_source: source,
    p_fingerprint: signature,
    p_context: safeContext,
  });
}
