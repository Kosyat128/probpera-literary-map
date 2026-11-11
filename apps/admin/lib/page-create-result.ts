// DRAFT. Shared import-free validation of a known pre-insert content refusal.
// It is never a saved receipt or authority to repeat an unknown create.
export type PageCreateResult = {
  outcome: "rejected";
  reason: "content";
  message: string;
};

export function parsePageCreateResult(value: unknown): PageCreateResult | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3 || keys.some(key => typeof key !== "string"
      || !["outcome", "reason", "message"].includes(key))) return null;
    const fields = Object.getOwnPropertyDescriptors(value);
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const field = fields[key];
      if (!field || !field.enumerable || !("value" in field)) return null;
    }
    const outcome: unknown = fields.outcome?.value;
    const reason: unknown = fields.reason?.value;
    const message: unknown = fields.message?.value;
    if (outcome !== "rejected" || reason !== "content" || typeof message !== "string"
      || message.length > 500 || message.trim().length === 0) return null;
    return { outcome, reason, message };
  } catch {
    return null;
  }
}

/** Construct through the identical closed boundary used by the client. */
export function pageCreateContentRejection(message: string): PageCreateResult {
  const result = parsePageCreateResult({ outcome: "rejected", reason: "content", message });
  if (!result) throw new Error("Invalid page-create rejection contract");
  return result;
}
