import { createHash } from "node:crypto";

import { writerBiographySentenceCount } from "./writer-biography-english-qa.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function writerBiographyEnglishSourceHash(record) {
  return sha256(
    JSON.stringify({
      key: record.key,
      writerName: record.writerName,
      locale: record.russian.locale,
      text: record.russian.text,
      sourceLanguage: record.russian.sourceLanguage,
      status: record.russian.status,
      method: record.russian.method,
      reviewedAt: record.russian.reviewedAt,
      reviewer: record.russian.reviewer,
      sourceTextRights: record.russian.sourceTextRights,
      sources: record.russian.sources,
      translationMeta: record.russian.translationMeta || null,
    })
  );
}

export function writerBiographyEnglishSourceFingerprint(records) {
  return `sha256:${sha256(
    JSON.stringify(records.map((record) => [record.key, record.sourceHash]))
  )}`;
}

export function writerBiographyRussianSourceIssues(record) {
  const russian = record?.russian;
  const issues = [];
  if (!russian || typeof russian !== "object") return ["missing-strict-russian"];
  if (russian.locale !== "ru") issues.push("russian-locale-mismatch");
  if (russian.sourceLanguage !== "ru") {
    issues.push("russian-source-language-mismatch");
  }
  if (russian.method !== "editorial-original") {
    issues.push("russian-is-not-editorial-original");
  }
  if (russian.status !== "verified") {
    issues.push("russian-is-not-verified");
  }
  if (russian.sourceTextRights !== "project-original") {
    issues.push("russian-source-rights-mismatch");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(russian.reviewedAt || ""))) {
    issues.push("russian-reviewed-at-missing");
  }
  if (!String(russian.reviewer || "").trim()) {
    issues.push("russian-reviewer-missing");
  }
  if (!Array.isArray(russian.sources) || russian.sources.length === 0) {
    issues.push("russian-sources-missing");
  } else if (
    russian.sources.some(
      (source) =>
        !source ||
        typeof source !== "object" ||
        !String(source.provider || "").trim() ||
        !/^https:\/\//u.test(String(source.url || "")) ||
        source.usage !== "fact-check" ||
        !Array.isArray(source.fields) ||
        !source.fields.includes("biography-facts") ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(String(source.retrievedAt || ""))
    )
  ) {
    issues.push("russian-source-provenance-invalid");
  }
  const text = String(russian.text || "").replace(/\s+/gu, " ").trim();
  if (text.length < 120 || text.length > 1_600) {
    issues.push("russian-length-out-of-range");
  }
  const sentences = writerBiographySentenceCount(text);
  if (sentences < 2 || sentences > 4) {
    issues.push("russian-sentence-count-out-of-range");
  }
  return issues;
}
