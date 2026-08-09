import {
  hasLiteraryIdentitySignal,
  LITERARY_OCCUPATION_IDS,
  normalizeIdentityText,
} from "./curated-writer-identity.mjs";

function tokens(value) {
  return normalizeIdentityText(value).split(/\s+/u).filter(Boolean);
}

function tokenCompatible(shortToken, longToken) {
  const loose = (token) =>
    token.replace(/[ьъ]/gu, "").replace(/^х(?=я)/u, "");
  return (
    shortToken === longToken ||
    loose(shortToken) === loose(longToken) ||
    (shortToken.length === 1 && longToken.startsWith(shortToken)) ||
    (shortToken.length >= 3 && longToken.startsWith(shortToken)) ||
    (longToken.length >= 3 && shortToken.startsWith(longToken))
  );
}

export function namesCompatible(writerNames, labels) {
  const normalizedNames = writerNames.map(normalizeIdentityText).filter(Boolean);
  const normalizedLabels = labels.map(normalizeIdentityText).filter(Boolean);
  if (
    normalizedLabels.some((label) => normalizedNames.includes(label))
  ) {
    return "exact";
  }

  for (const label of normalizedLabels) {
    const labelTokens = tokens(label);
    for (const name of normalizedNames) {
      const nameTokens = tokens(name);
      const [shorter, longer] =
        nameTokens.length <= labelTokens.length
          ? [nameTokens, labelTokens]
          : [labelTokens, nameTokens];
      if (
        shorter.length >= 2 &&
        shorter.every((token) =>
          longer.some((candidate) => tokenCompatible(token, candidate))
        )
      ) {
        return "compatible";
      }
    }
  }

  for (const label of normalizedLabels) {
    const labelTokens = tokens(label);
    if (labelTokens.length < 2) continue;
    for (const name of normalizedNames) {
      const nameTokens = tokens(name);
      if (nameTokens.length < 2) continue;
      const labelSurname = labelTokens.at(-1);
      const nameSurname = nameTokens.at(-1);
      if (!tokenCompatible(labelSurname, nameSurname)) continue;
      const unmatchedNameTokens = [...nameTokens.slice(0, -1)];
      const givenNamesMatch = labelTokens.slice(0, -1).every((labelToken) => {
        const index = unmatchedNameTokens.findIndex((nameToken) =>
          tokenCompatible(labelToken, nameToken)
        );
        if (index < 0) return false;
        unmatchedNameTokens.splice(index, 1);
        return true;
      });
      if (givenNamesMatch) return "compatible";
    }
  }
  return "conflict";
}

export function yearFromValue(value) {
  return String(value || "").match(/[+-]?(\d{3,4})/u)?.[1] || "";
}

function claimYears(entity, property) {
  return [
    ...new Set(
      (entity?.claims?.[property] || [])
        .map((claim) => yearFromValue(claim.time))
        .filter(Boolean)
    ),
  ].sort();
}

function compareYear(localValue, externalYears) {
  const localYear = yearFromValue(localValue);
  if (!localYear) return { status: "no-local-value", localYear, externalYears };
  if (!externalYears.length) {
    return { status: "no-wikidata-value", localYear, externalYears };
  }
  return {
    status: externalYears.includes(localYear) ? "match" : "conflict",
    localYear,
    externalYears,
  };
}

export function auditWriterIdentityRecord({ key, mapping, writer, entity }) {
  if (!writer) {
    return {
      key,
      qid: mapping?.wikidataId || null,
      classification: "blocked",
      issues: ["writer-key-not-found"],
    };
  }
  if (!entity || entity.missing) {
    return {
      key,
      qid: mapping?.wikidataId || null,
      writerName: writer.name || writer.fullName || "",
      classification: "blocked",
      issues: ["wikidata-entity-not-found"],
    };
  }

  const labels = Object.fromEntries(
    Object.entries(entity.labels || {}).filter(([, value]) =>
      Boolean(String(value || "").trim())
    )
  );
  const descriptions = Object.fromEntries(
    Object.entries(entity.descriptions || {}).filter(([, value]) =>
      Boolean(String(value || "").trim())
    )
  );
  const human = (entity.claims?.P31 || []).some(
    (claim) => claim.entityId === "Q5"
  );
  const occupationIds = [
    ...new Set(
      (entity.claims?.P106 || []).map((claim) => claim.entityId).filter(Boolean)
    ),
  ].sort();
  const literaryOccupationIds = occupationIds.filter((qid) =>
    LITERARY_OCCUPATION_IDS.has(qid)
  );
  const literaryEvidence = hasLiteraryIdentitySignal({
    literaryOccupationIds,
    descriptions,
  });
  const nameStatus = namesCompatible(
    [writer.name, writer.fullName].filter(Boolean),
    Object.values(labels)
  );
  const birth = compareYear(
    writer.birthDate || writer.birth || writer.years,
    claimYears(entity, "P569")
  );
  const death = compareYear(writer.deathDate, claimYears(entity, "P570"));
  const issues = [];
  if (!human) issues.push("not-confirmed-human");
  if (nameStatus === "conflict") issues.push("label-name-conflict");
  if (birth.status === "conflict") issues.push("birth-year-conflict");
  if (birth.status === "no-local-value") issues.push("local-birth-year-missing");
  if (birth.status === "no-wikidata-value") issues.push("wikidata-birth-year-missing");
  if (death.status === "conflict") issues.push("death-year-conflict");
  if (!literaryEvidence) issues.push("literary-role-not-corroborated");

  const identityCorroborated =
    human &&
    nameStatus !== "conflict" &&
    birth.status === "match" &&
    literaryEvidence;
  const blocked = !human || nameStatus === "conflict";

  return {
    key,
    qid: mapping.wikidataId,
    writerName: writer.name || writer.fullName || "",
    fullName: writer.fullName || "",
    classification: blocked
      ? "blocked"
      : identityCorroborated
        ? "corroborated"
        : "review-required",
    labels,
    descriptions,
    human,
    nameStatus,
    birth,
    death,
    occupationIds,
    literaryOccupationIds,
    literaryEvidence,
    issues,
    sourceUrl: `https://www.wikidata.org/wiki/${mapping.wikidataId}`,
  };
}

function countBy(records, selector) {
  const counts = {};
  for (const record of records) {
    const value = selector(record);
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}

export function summarizeWriterIdentityAudit(records) {
  return {
    activeMappingsAudited: records.length,
    classificationCounts: countBy(records, (record) => record.classification),
    nameStatusCounts: countBy(records, (record) => record.nameStatus || "missing"),
    birthStatusCounts: countBy(
      records,
      (record) => record.birth?.status || "missing"
    ),
    deathStatusCounts: countBy(
      records,
      (record) => record.death?.status || "missing"
    ),
    humanCorroborated: records.filter((record) => record.human).length,
    literaryRoleCorroborated: records.filter((record) => record.literaryEvidence)
      .length,
    literaryRoleFromDescriptionOnly: records.filter(
      (record) =>
        record.literaryEvidence && !record.literaryOccupationIds?.length
    ).length,
    reviewQueue: records.filter(
      (record) => record.classification === "review-required"
    ).length,
    blockedActiveMappings: records.filter(
      (record) => record.classification === "blocked"
    ).length,
  };
}
