import { z } from "zod";

import { adminEnv } from "./env";
import { premiumTranslateToEnglish } from "./premium-english-translation";

const siteCopySchema = z.object({
  items: z.array(z.object({
    key: z.string().trim().min(1).max(1_200),
    text: z.string().trim().min(1).max(4_000),
  })).max(50),
});

const siteCopyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "text"],
        properties: {
          key: { type: "string" },
          text: { type: "string" },
        },
      },
    },
  },
} as const;

export type SiteCopyTranslationInput = { key: string; text: string };

export async function translationSourceHash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function validateOutput(
  source: readonly SiteCopyTranslationInput[],
  value: unknown
) {
  const parsed = siteCopySchema.parse(value);
  const expected = source.map((item) => item.key);
  const actual = parsed.items.map((item) => item.key);
  if (
    expected.length !== actual.length ||
    expected.some((key, index) => actual[index] !== key) ||
    new Set(actual).size !== actual.length
  ) {
    throw new Error("Premium site-copy translation changed keys or order");
  }
  for (const item of parsed.items) {
    if (/\p{Script=Cyrillic}/u.test(item.text)) {
      throw new Error(`English site copy still contains Cyrillic: ${item.key}`);
    }
  }
  return parsed;
}

export async function translateSiteCopyBatchToEnglish(
  source: readonly SiteCopyTranslationInput[],
  options: {
    apiKey?: string;
    model?: string;
    reviewerModel?: string;
    review?: boolean;
    fetchImpl?: typeof fetch;
  } = {}
) {
  if (!source.length) return null;
  if (source.length > 50) throw new Error("Site-copy translation batch is limited to 50 items");
  const normalized = source.map((item) => ({
    key: item.key.trim(),
    text: item.text.replace(/\r\n?/gu, "\n").trim(),
  }));
  if (normalized.some((item) => !item.key || !item.text)) {
    throw new Error("Site-copy translation requires non-empty input");
  }
  if (new Set(normalized.map((item) => item.key)).size !== normalized.length) {
    throw new Error("Site-copy translation contains duplicate keys");
  }

  const translated = await premiumTranslateToEnglish({
    source: { items: normalized },
    schema: siteCopyJsonSchema,
    schemaName: "probpera_site_copy_translation",
    validate: (value) => validateOutput(normalized, value),
    apiKey: options.apiKey,
    model: options.model,
    reviewerModel: options.reviewerModel,
    review: options.review,
    fetchImpl: options.fetchImpl,
    maxOutputTokens: 12_000,
    domainInstructions: [
      "Translate website UI copy into concise natural professional English.",
      "Preserve every item key and item order exactly.",
      "Use consistent established wording for Proba Pera and Literary Planet.",
      "Do not add facts, explanations or marketing claims.",
    ],
  });

  return translated;
}
