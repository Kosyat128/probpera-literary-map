import { unstable_rethrow } from "next/navigation";

export type AdminReadIssue = "schema" | "permission" | "unavailable" | "invalid";

export type AdminReadResult<T> =
  | { status: "success"; data: T }
  | { status: "failed"; issue: AdminReadIssue };

export function isReadRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isReadRecordList(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isReadRecord);
}

/** Inspect the entire settled batch before an ordinary failure can return early. */
export function rethrowAdminReadControlFlow(...results: unknown[]): void {
  for (const result of results) {
    if (!isReadRecord(result)) continue;
    if (result.status === "rejected") unstable_rethrow(result.reason);
    else if (result.status === "fulfilled" && isReadRecord(result.value)) {
      unstable_rethrow(result.value.error);
    }
  }
}

function readIssue(error: unknown): AdminReadIssue {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
  if (typeof code !== "string") return "unavailable";
  if (["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(code)) {
    return "schema";
  }
  if (["42501", "PGRST301", "PGRST302", "PGRST303"].includes(code)) {
    return "permission";
  }
  if (code === "PGRST116") return "invalid";
  return "unavailable";
}

/** Read-only boundary: validate data and keep raw provider errors out of the UI. */
export function readAdminResult<T>(
  result: PromiseSettledResult<{ data: T; error?: unknown }>,
  isValid: (data: T) => boolean,
): AdminReadResult<T> {
  if (!result || typeof result !== "object" ||
    (result.status !== "fulfilled" && result.status !== "rejected")) {
    return { status: "failed", issue: "invalid" };
  }
  rethrowAdminReadControlFlow(result);
  if (result.status === "rejected") {
    return { status: "failed", issue: readIssue(result.reason) };
  }
  const response = result.value;
  if (!response || typeof response !== "object" || !("data" in response)) {
    return { status: "failed", issue: "invalid" };
  }
  if (response.error != null) {
    return { status: "failed", issue: readIssue(response.error) };
  }
  if (!isValid(response.data)) return { status: "failed", issue: "invalid" };
  return { status: "success", data: response.data };
}

/** A successful list is an actual array; null never represents an empty list. */
export function readAdminList<T extends object>(
  result: PromiseSettledResult<{ data: T[] | null; error?: unknown }>,
  isValidItem?: (item: T) => boolean,
): AdminReadResult<T[]> {
  const read = readAdminResult(result, (data) =>
    isReadRecordList(data) && (!isValidItem || data.every((item) => isValidItem(item as T))));
  if (read.status === "failed") return read;
  return { status: "success", data: read.data as T[] };
}

export function adminReadMessage(issue: AdminReadIssue): string {
  switch (issue) {
    case "schema":
      return "Структура редакционной базы не соответствует запросу. Обратитесь к администратору; сохранение недоступно до проверки.";
    case "permission":
      return "Не удалось проверить доступ к данным. Проверьте вход и права доступа, затем повторите загрузку.";
    case "invalid":
      return "Редакционная база вернула неполный или повреждённый ответ. Повторите загрузку; сохранение с неполными данными недоступно.";
    case "unavailable":
      return "Редакционная база временно недоступна. Повторите загрузку или вернитесь к работе позже.";
  }
}
