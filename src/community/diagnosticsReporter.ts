import { supabase } from "../lib/supabase";
import { getCommunitySessionId } from "./sessionIdentity";

export type ClientErrorSource = "runtime" | "promise" | "react" | "resource" | "manual";

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

export function reportClientError(
  error: unknown,
  source: ClientErrorSource,
  context: Record<string, unknown> = {}
) {
  if (!supabase) return;
  const message = safeMessage(error).slice(0, 1000);
  const stack = error instanceof Error ? (error.stack || "").slice(0, 6000) : "";
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`.slice(0, 500);
  const signature = fingerprint(`${source}:${message}:${stack.split("\n")[1] || path}`);
  const safeContext = {
    ...context,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
  };
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
