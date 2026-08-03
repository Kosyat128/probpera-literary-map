export function getLocalMonthKey(date = new Date()) {
  return date.getFullYear() * 12 + date.getMonth();
}

export function getMonthlySelectionIndex(length: number, monthKey: number) {
  if (!Number.isInteger(length) || length <= 0) return -1;

  const normalizedMonth = Number.isFinite(monthKey) ? Math.trunc(monthKey) : 0;
  return ((normalizedMonth % length) + length) % length;
}
