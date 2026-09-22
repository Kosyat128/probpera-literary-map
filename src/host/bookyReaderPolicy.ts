/** Explicit local adult input. This is not age assurance or content approval. */
export const BOOKY_READER_POLICY_KEY = "probpera-booky-reader-policy-v1";
export const BOOKY_READER_POLICY_MAX_LENGTH = 1_024;
export type BookyReadingLevel = "plain" | "developing" | "fluent";
export type BookyReaderPolicyInput = Readonly<{ age: number; readingLevel: BookyReadingLevel }>;
export type BookyReaderPolicy = BookyReaderPolicyInput & Readonly<{
  schemaVersion: 1;
  audience: "adult";
  confirmedAt: string;
  revision: number;
}>;
export type BookyReaderPolicyDecoded = Readonly<{
  policy: BookyReaderPolicy | null;
  error: "invalid" | "unsupported" | null;
}>;
const fields = ["schemaVersion", "audience", "age", "readingLevel", "confirmedAt", "revision"];

function objectData(value: unknown): PropertyDescriptorMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !("value" in descriptors[key]) || !descriptors[key].enumerable)) return null;
  return descriptors;
}

function decode(input: unknown): BookyReaderPolicyDecoded {
  try {
    let value = input;
    if (typeof value === "string") {
      if (value.length > BOOKY_READER_POLICY_MAX_LENGTH) return { policy: null, error: "invalid" };
      value = JSON.parse(value);
    }
    const data = objectData(value);
    if (!data) return { policy: null, error: "invalid" };
    const schemaVersion: unknown = data.schemaVersion?.value;
    // Preserve newer formats even when their fields differ from this schema.
    if (typeof schemaVersion === "number" && Number.isSafeInteger(schemaVersion) && schemaVersion > 1) return { policy: null, error: "unsupported" };
    if (Object.keys(data).length !== fields.length || fields.some(key => !data[key])) return { policy: null, error: "invalid" };
    const age: unknown = data.age.value, readingLevel: unknown = data.readingLevel.value;
    const confirmedAt: unknown = data.confirmedAt.value, revision: unknown = data.revision.value;
    if (schemaVersion !== 1 || data.audience.value !== "adult"
      || typeof age !== "number" || !Number.isInteger(age) || age < 18 || age > 120
      || readingLevel !== "plain" && readingLevel !== "developing" && readingLevel !== "fluent"
      || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1
      || typeof confirmedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(confirmedAt)
      || new Date(confirmedAt).toISOString() !== confirmedAt) return { policy: null, error: "invalid" };
    return { policy: Object.freeze({ schemaVersion: 1, audience: "adult", age, readingLevel, confirmedAt, revision }), error: null };
  } catch { return { policy: null, error: "invalid" }; }
}

export function parseBookyReaderPolicy(input: unknown): BookyReaderPolicy | null { return decode(input).policy; }
export function decodeBookyReaderPolicy(serialized: unknown): BookyReaderPolicyDecoded {
  return Object.freeze(serialized === null ? { policy: null, error: null } : typeof serialized === "string"
    ? decode(serialized) : { policy: null, error: "invalid" });
}
export function serializeBookyReaderPolicy(input: unknown): string | null {
  const policy = parseBookyReaderPolicy(input);
  return policy ? JSON.stringify(policy) : null;
}

/** Copies only explicit primitive input; getters, prototypes and extra fields fail closed. */
export function createBookyReaderPolicy(input: unknown, confirmedAt: string, revision: number): BookyReaderPolicy | null {
  try {
    const data = objectData(input);
    if (!data || Object.keys(data).length !== 2 || !data.age || !data.readingLevel) return null;
    return parseBookyReaderPolicy({ schemaVersion: 1, audience: "adult", age: data.age.value,
      readingLevel: data.readingLevel.value, confirmedAt, revision });
  } catch { return null; }
}
