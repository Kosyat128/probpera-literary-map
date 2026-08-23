import { z } from "zod";

import {
  protectedArticleHtmlSignature,
  type AutoTranslationResult,
  type AutoTranslationSource,
} from "./auto-translate-article-core";

const reviewedTranslationSchema = z.object({
  title: z.string().trim().min(3).max(240),
  subtitle: z.string().trim().max(360),
  excerpt: z.string().trim().min(80).max(700),
  content_html: z.string().min(20).max(2_000_000),
  cover_alt: z.string().trim().min(10).max(500),
  seo_title: z.string().trim().min(3).max(180),
  seo_description: z.string().trim().min(80).max(400),
  seo_keywords: z.array(z.string().trim().min(1).max(80)).max(30),
  og_title: z.string().trim().min(3).max(180),
  og_description: z.string().trim().min(20).max(400),
  sources: z.array(z.string().trim().min(1).max(1000)).max(100),
  bibliography: z.array(z.string().trim().min(1).max(1000)).max(100),
});

const reviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "subtitle",
    "excerpt",
    "content_html",
    "cover_alt",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "og_title",
    "og_description",
    "sources",
    "bibliography",
  ],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    excerpt: { type: "string" },
    content_html: { type: "string" },
    cover_alt: { type: "string" },
    seo_title: { type: "string" },
    seo_description: { type: "string" },
    seo_keywords: { type: "array", maxItems: 30, items: { type: "string" } },
    og_title: { type: "string" },
    og_description: { type: "string" },
    sources: { type: "array", maxItems: 100, items: { type: "string" } },
    bibliography: { type: "array", maxItems: 100, items: { type: "string" } },
  },
} as const;

const cyrillicPattern = /[\u0400-\u04ff]/u;
const urlPattern = /https?:\/\/[^\s<>"')\]]+/giu;

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  for (const item of Array.isArray(record.output) ? record.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    for (const part of Array.isArray(content) ? content : []) {
      if (!part || typeof part !== "object") continue;
      const value = part as Record<string, unknown>;
      if (value.type === "output_text" && typeof value.text === "string") {
        return value.text;
      }
    }
  }
  return "";
}

function responseUsage(payload: unknown) {
  const usage =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).usage
      : null;
  const record =
    usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  return {
    inputTokens: typeof record.input_tokens === "number" ? record.input_tokens : 0,
    outputTokens: typeof record.output_tokens === "number" ? record.output_tokens : 0,
  };
}

function sortedUrls(value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return [...serialized.matchAll(urlPattern)].map((match) => match[0]).sort();
}

function sameArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function visibleEnglishPayload(value: z.infer<typeof reviewedTranslationSchema>) {
  return [
    value.title,
    value.subtitle,
    value.excerpt,
    value.content_html.replace(/https?:\/\/[^\s<>"']+/giu, ""),
    value.cover_alt,
    value.seo_title,
    value.seo_description,
    value.seo_keywords.join(" "),
    value.og_title,
    value.og_description,
    value.sources.join(" ").replace(urlPattern, ""),
    value.bibliography.join(" ").replace(urlPattern, ""),
  ].join("\n");
}

export async function premiumReviewArticleTranslation(input: {
  source: AutoTranslationSource;
  draft: AutoTranslationResult;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): Promise<AutoTranslationResult> {
  if (!input.apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await (input.fetchImpl || fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        store: false,
        max_output_tokens: 30_000,
        instructions: [
          "You are the final senior English-language literary editor for Proba Pera, reviewing a machine translation before publication.",
          "Use the Russian SOURCE only to verify meaning, factual fidelity, names, dates, quotations, nuance and omissions. Use DRAFT as the English text to copy-edit.",
          "Produce elegant, natural, publication-grade English comparable to a major literary magazine. Remove literal Russian syntax, awkward calques and machine-translated phrasing while preserving the author's register and degree of formality.",
          "Do not add, delete, soften, intensify or reinterpret factual claims. Do not invent explanations, citations, bibliographic facts, quotations or context.",
          "Preserve the exact HTML element order, nesting, href/src/id/class/name/target/rel/width/height/loading/data-* attributes, links and image URLs. Only human-facing text and alt/title/caption text may be edited.",
          "Preserve every URL, ISBN, identifier, year, issue/volume number and publisher identity exactly. Translate bibliographic prose without fabricating publication data.",
          "Use established English forms of names and titles when genuinely conventional; otherwise transliterate consistently. The final reader-facing English fields must not contain Cyrillic.",
          "SEO and social fields must be idiomatic English, accurate, specific and not clickbait. Return only the requested JSON object.",
        ].join("\n"),
        input: JSON.stringify({ SOURCE: input.source, DRAFT: input.draft }, null, 2),
        text: {
          format: {
            type: "json_schema",
            name: "probpera_premium_translation_review",
            strict: true,
            schema: reviewJsonSchema,
          },
        },
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const apiError = payload && typeof payload === "object"
        ? (payload as Record<string, unknown>).error
        : null;
      const message = apiError && typeof apiError === "object"
        ? String((apiError as Record<string, unknown>).message || "")
        : "";
      throw new Error(
        `OpenAI premium translation review failed (${response.status})${message ? `: ${message.slice(0, 300)}` : ""}`
      );
    }

    const text = responseText(payload);
    if (!text) throw new Error("OpenAI premium review returned no translation text");
    let decoded: unknown;
    try {
      decoded = JSON.parse(text);
    } catch {
      throw new Error("OpenAI premium review returned invalid translation JSON");
    }
    const parsed = reviewedTranslationSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new Error(
        `OpenAI premium review did not match the editorial schema: ${parsed.error.issues[0]?.message || "invalid result"}`
      );
    }

    if (!sameArray(
      protectedArticleHtmlSignature(input.source.contentHtml),
      protectedArticleHtmlSignature(parsed.data.content_html)
    )) {
      throw new Error("OpenAI premium review changed protected HTML structure or link/image attributes");
    }

    const sourceUrls = sortedUrls({
      html: input.source.contentHtml,
      sources: input.source.sources,
      bibliography: input.source.bibliography,
    });
    const reviewedUrls = sortedUrls({
      html: parsed.data.content_html,
      sources: parsed.data.sources,
      bibliography: parsed.data.bibliography,
    });
    if (!sameArray(sourceUrls, reviewedUrls)) {
      throw new Error("OpenAI premium review changed a protected source URL");
    }
    if (cyrillicPattern.test(visibleEnglishPayload(parsed.data))) {
      throw new Error("OpenAI premium review left Cyrillic in reader-facing English fields");
    }

    const usage = responseUsage(payload);
    return {
      ...parsed.data,
      model: input.model,
      requestId:
        response.headers.get("x-request-id") ||
        (payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).id === "string"
          ? String((payload as Record<string, unknown>).id)
          : null),
      inputTokens: (input.draft.inputTokens || 0) + usage.inputTokens,
      outputTokens: (input.draft.outputTokens || 0) + usage.outputTokens,
    };
  } finally {
    clearTimeout(timeout);
  }
}
