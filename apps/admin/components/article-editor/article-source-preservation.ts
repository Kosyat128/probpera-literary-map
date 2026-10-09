/** Optional absent lists contain no authored entries; loaded rows are validated separately. */
export function canPreserveArticleEditorSourceList(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!Array.isArray(value) || value.length > 100) return false;

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(item);
    if (keys.length !== 1 || keys[0] !== "text") return false;
    const text = (item as { text: unknown }).text;
    if (typeof text !== "string" || text.length > 1000 || text.trim().length === 0 || /[\r\n]/u.test(text)) return false;
  }
  return true;
}
