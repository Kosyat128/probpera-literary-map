export function aliasCanIdentifyWork(
  alias,
  { authorPresent = false, exactTitle = false } = {}
) {
  const words = String(alias).trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return false;
  if (words.length === 1 || /^\d+$/u.test(alias)) {
    return authorPresent || exactTitle;
  }
  return true;
}
