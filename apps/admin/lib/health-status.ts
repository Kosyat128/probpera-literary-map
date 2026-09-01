export const healthStatuses = [
  "OK",
  "DEGRADED",
  "FAILED",
  "NOT CONFIGURED",
  "UNKNOWN",
] as const;

export type HealthStatus = (typeof healthStatuses)[number];

export const healthStatusLabels: Record<HealthStatus, string> = {
  OK: "Исправно",
  DEGRADED: "Ограничено",
  FAILED: "Ошибка",
  "NOT CONFIGURED": "Не настроено",
  UNKNOWN: "Неизвестно",
};

const sensitivePatterns = [
  /\b(?:sk|sk-proj|sk-ant)-[a-z0-9_-]{8,}\b/giu,
  /\b(?:bearer|basic)\s+[a-z0-9._~+\/-]+=*\b/giu,
  /\b(?:password|passwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/giu,
  /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/giu,
] as const;

export function redactHealthDiagnosticText(value: unknown, maximum = 320) {
  let text = typeof value === "string" ? value : "Диагностическое сообщение недоступно.";
  text = text
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ");
  for (const pattern of sensitivePatterns) text = text.replace(pattern, "[скрыто]");
  return text.replace(/\s+/gu, " ").trim().slice(0, maximum) || "Сообщение скрыто.";
}
export function safeDiagnosticPath(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  if (!source.startsWith("/") || source.startsWith("//") || source.includes("\\")) {
    return "/";
  }
  return source.split(/[?#]/u, 1)[0].slice(0, 240) || "/";
}
