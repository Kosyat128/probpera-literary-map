export const articleStatusLabels: Record<string, string> = {
  draft: "Черновик",
  review: "На проверке",
  scheduled: "Запланирована",
  published: "Опубликована",
  hidden: "Скрыта",
  archived: "В архиве",
};

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? { hour: "2-digit" as const, minute: "2-digit" as const }
      : {}),
  }).format(parsed);
}

export function safeCount(
  result: { count: number | null; error?: unknown } | null | undefined
) {
  return result?.count || 0;
}
