export const PORTRAIT_RIGHTS_QUEUE_SCHEMA_VERSION = 1;

export const PORTRAIT_RIGHTS_STATUSES = Object.freeze([
  "commons-search",
  "permission-needed",
  "permission-received",
  "licensed",
]);

export const PORTRAIT_RIGHTS_BASES = Object.freeze([
  "public-domain",
  "license",
  "permission",
]);

const STATUS_SET = new Set(PORTRAIT_RIGHTS_STATUSES);
const BASIS_SET = new Set(PORTRAIT_RIGHTS_BASES);
// One legacy public writer id contains U+00AD. Preserve that stable key rather
// than silently changing a routed entity id; all other formatting/control
// characters remain forbidden.
const SAFE_ID = /^[\p{L}\p{N}_.\u00ad-]+$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const OPAQUE_EVIDENCE_REF = /^(?:vault|dms|repo):\/\/[a-z0-9][a-z0-9/_.:-]*#sha256=([a-f0-9]{64})$/iu;
const STAGING_ASSET_REF = /^staging:\/\/writer-portraits\/[a-z0-9][a-z0-9/_.-]*\.webp#sha256=([a-f0-9]{64})$/iu;
const STAGING_QID_ASSET_REF = /^staging:\/\/writer-portraits\/(q[1-9]\d*)\.webp#sha256=([a-f0-9]{64})$/iu;
const UNKNOWN_PARTY = /^(?:unknown|unknown author|anonymous|неизвест(?:ен|на|но)?|неизвестный автор)$/iu;
const HISTORICAL_LIKENESS_KINDS = new Set([
  "drawing",
  "engraving",
  "icon",
  "miniature",
  "painting",
]);
const PHOTOGRAPHY_ERA_START_YEAR = 1840;

const REQUIRED_ENTRY_FIELDS = Object.freeze([
  "key",
  "countryId",
  "countryName",
  "writerId",
  "writerName",
  "status",
  "candidate",
  "rights",
  "notes",
]);

const REQUIRED_CANDIDATE_FIELDS = Object.freeze([
  "assetRef",
  "mediaKind",
  "subjectNameAtSource",
  "identityEvidenceUrl",
]);

const REQUIRED_RIGHTS_FIELDS = Object.freeze([
  "rightsHolder",
  "creator",
  "basis",
  "licenseName",
  "licenseUrl",
  "licenseOrPermissionArtifactRef",
  "territory",
  "sourceUrl",
  "checkedAt",
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeHttpsUrl(value) {
  const normalized = text(value);
  if (!normalized || normalized.length > 2_000) return false;
  try {
    const parsed = new URL(normalized);
    return (
      parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function permanentHttpsEvidence(value) {
  if (!safeHttpsUrl(value)) return false;
  const parsed = new URL(value);
  const hashDigest = parsed.hash.match(/(?:^#|&)sha256=([a-f0-9]{64})(?:&|$)/iu)?.[1];
  return Boolean(
    SHA256.test(hashDigest || "") ||
      /^\/wiki\/Special:PermanentLink\/\d+\/?$/iu.test(parsed.pathname) ||
      /^\d+$/u.test(parsed.searchParams.get("oldid") || "")
  );
}

function permanentArtifactRef(value) {
  const normalized = text(value);
  return OPAQUE_EVIDENCE_REF.test(normalized) || permanentHttpsEvidence(normalized);
}

function dateIssue(value, today) {
  const normalized = text(value);
  if (!ISO_DATE.test(normalized)) return "must be an ISO date (YYYY-MM-DD)";
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "must be a real calendar date";
  if (date.toISOString().slice(0, 10) !== normalized) {
    return "must be a real calendar date";
  }
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  if (date > todayDate) return "cannot be in the future";
  const ageDays = Math.floor((todayDate.getTime() - date.getTime()) / 86_400_000);
  if (ageDays > 366) return "must be rechecked within the last 366 days";
  return "";
}

function issue(path, code, message) {
  return { path, code, message };
}

function identityMappingForKey(identityRegistry, key) {
  const mappings = identityRegistry?.writers || identityRegistry;
  if (mappings instanceof Map) return mappings.get(key);
  return isRecord(mappings) ? mappings[key] : undefined;
}

export function stagedPortraitQid(assetRef) {
  return text(assetRef).match(STAGING_QID_ASSET_REF)?.[1]?.toUpperCase() || "";
}

export function emptyPortraitRightsQueueEntry(record) {
  const countryId = text(record?.countryId);
  const writerId = text(record?.writerId);
  return {
    key: `${countryId}:${writerId}`,
    countryId,
    countryName: text(record?.countryName),
    writerId,
    writerName: text(record?.writerName),
    status: "commons-search",
    candidate: {
      assetRef: "",
      mediaKind: "",
      subjectNameAtSource: "",
      identityEvidenceUrl: "",
    },
    rights: {
      rightsHolder: "",
      creator: "",
      basis: "",
      licenseName: "",
      licenseUrl: "",
      licenseOrPermissionArtifactRef: "",
      territory: "",
      sourceUrl: "",
      checkedAt: "",
    },
    notes: "",
  };
}

/**
 * A complete bundle is deliberately stricter than a typical image credit.
 * It proves subject identity, records worldwide rights and binds the staged
 * binary plus the legal evidence to immutable SHA/revision references.
 */
export function portraitRightsBundleIssues(entry, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const key = text(entry?.key) || "<unknown>";
  const prefix = `writers.${key}`;
  const issues = [];
  const candidate = isRecord(entry?.candidate) ? entry.candidate : {};
  const rights = isRecord(entry?.rights) ? entry.rights : {};
  const rightsHolder = text(rights.rightsHolder);
  const creator = text(rights.creator);
  const basis = text(rights.basis);
  const mediaKind = text(candidate.mediaKind);

  if (!rightsHolder || UNKNOWN_PARTY.test(rightsHolder)) {
    issues.push(issue(`${prefix}.rights.rightsHolder`, "rights-holder-required", "A known rights holder or an explicit public-domain statement is required."));
  }
  if (!creator || UNKNOWN_PARTY.test(creator)) {
    issues.push(issue(`${prefix}.rights.creator`, "creator-required", "A documented photographer or portrait creator is required."));
  }
  if (!BASIS_SET.has(basis)) {
    issues.push(issue(`${prefix}.rights.basis`, "legal-basis-required", `Legal basis must be one of: ${PORTRAIT_RIGHTS_BASES.join(", ")}.`));
  }
  if (!text(rights.licenseName)) {
    issues.push(issue(`${prefix}.rights.licenseName`, "license-name-required", "The exact license, public-domain rationale or permission grant name is required."));
  }
  if (basis === "permission") {
    if (text(rights.licenseUrl)) {
      issues.push(issue(`${prefix}.rights.licenseUrl`, "permission-license-url-forbidden", "Permission evidence belongs in the immutable artifact reference, not in licenseUrl."));
    }
  } else if (!safeHttpsUrl(rights.licenseUrl)) {
    issues.push(issue(`${prefix}.rights.licenseUrl`, "license-url-required", "A valid HTTPS license or public-domain rationale URL is required."));
  }
  if (!permanentArtifactRef(rights.licenseOrPermissionArtifactRef)) {
    issues.push(issue(`${prefix}.rights.licenseOrPermissionArtifactRef`, "immutable-rights-evidence-required", "Use a permanent HTTPS revision or a vault/dms/repo URI with a SHA-256 fragment."));
  }
  if (text(rights.territory).toLocaleLowerCase("en") !== "worldwide") {
    issues.push(issue(`${prefix}.rights.territory`, "worldwide-rights-required", "The public site requires worldwide rights."));
  }
  if (!safeHttpsUrl(rights.sourceUrl)) {
    issues.push(issue(`${prefix}.rights.sourceUrl`, "source-url-required", "A credential-free HTTPS source page is required."));
  }
  const checkedAtIssue = dateIssue(rights.checkedAt, today);
  if (checkedAtIssue) {
    issues.push(issue(`${prefix}.rights.checkedAt`, "rights-check-date-invalid", checkedAtIssue));
  }
  if (!STAGING_ASSET_REF.test(text(candidate.assetRef))) {
    issues.push(issue(`${prefix}.candidate.assetRef`, "staged-asset-required", "Use a non-public staging://writer-portraits/*.webp reference bound to SHA-256."));
  }
  if (text(entry?.status) === "licensed") {
    const assetQid = stagedPortraitQid(candidate.assetRef);
    const identityMapping = identityMappingForKey(options.identityRegistry, key);
    const expectedQid = text(identityMapping?.wikidataId).toUpperCase();
    if (!assetQid) {
      issues.push(
        issue(
          `${prefix}.candidate.assetRef`,
          "staged-asset-qid-required",
          "A licensed staged portrait must use its verified Wikidata QID as the asset filename."
        )
      );
    }
    if (!expectedQid) {
      issues.push(
        issue(
          `${prefix}.candidate.assetRef`,
          "writer-identity-binding-required",
          "A licensed portrait requires a trusted writer-key to Wikidata-QID registry binding."
        )
      );
    } else if (assetQid && assetQid !== expectedQid) {
      issues.push(
        issue(
          `${prefix}.candidate.assetRef`,
          "staged-asset-writer-mismatch",
          `The staged portrait QID ${assetQid} does not match the trusted ${key} binding ${expectedQid}.`
        )
      );
    }
  }
  if (mediaKind === "historical-likeness") {
    const subjectDeathYear = Number(candidate.subjectDeathYear);
    const likenessKind = text(candidate.historicalLikenessType);
    if (
      !Number.isInteger(subjectDeathYear) ||
      subjectDeathYear >= PHOTOGRAPHY_ERA_START_YEAR
    ) {
      issues.push(
        issue(
          `${prefix}.candidate.subjectDeathYear`,
          "historical-likeness-era-invalid",
          `A non-photographic likeness is accepted only for a documented subject death before ${PHOTOGRAPHY_ERA_START_YEAR}.`
        )
      );
    }
    if (!HISTORICAL_LIKENESS_KINDS.has(likenessKind)) {
      issues.push(
        issue(
          `${prefix}.candidate.historicalLikenessType`,
          "historical-likeness-type-invalid",
          `Historical likeness type must be one of: ${[...HISTORICAL_LIKENESS_KINDS].join(", ")}.`
        )
      );
    }
  } else if (mediaKind !== "photograph") {
    issues.push(issue(`${prefix}.candidate.mediaKind`, "real-photograph-required", "Only a documented real photograph is accepted. Drawings, paintings, icons, sculptures, stamps, envelopes, covers, photomontages and AI likenesses are forbidden."));
  }
  if (!text(candidate.subjectNameAtSource)) {
    issues.push(issue(`${prefix}.candidate.subjectNameAtSource`, "source-subject-name-required", "Record the subject name exactly as identified by the evidence source."));
  }
  if (!safeHttpsUrl(candidate.identityEvidenceUrl)) {
    issues.push(issue(`${prefix}.candidate.identityEvidenceUrl`, "identity-evidence-required", "An HTTPS source identifying the depicted writer is required."));
  }

  return issues;
}

export function isPortraitRightsBundleComplete(entry, options = {}) {
  return portraitRightsBundleIssues(entry, options).length === 0;
}

/** Fail-closed helper for any future manifest/admin importer. */
export function assertPortraitCandidatePublishable(entry, options = {}) {
  if (text(entry?.status) !== "licensed") {
    throw new Error(`Portrait ${text(entry?.key) || "<unknown>"} is not in licensed state.`);
  }
  const issues = portraitRightsBundleIssues(entry, options);
  if (issues.length) {
    throw new Error(`Portrait ${text(entry?.key) || "<unknown>"} has an incomplete rights bundle: ${issues.map((item) => item.code).join(", ")}`);
  }
  return true;
}

export function portraitRightsFromLicensedQueueEntry(entry, options = {}) {
  assertPortraitCandidatePublishable(entry, options);
  const rights = entry.rights;
  const basis = text(rights.basis);
  const status =
    basis === "public-domain"
      ? "public-domain"
      : basis === "permission"
        ? "permission"
        : "licensed";
  const licenseUrl = text(rights.licenseUrl);
  return {
    status,
    licenseName: text(rights.licenseName),
    ...(licenseUrl ? { licenseUrl } : {}),
    creator: text(rights.creator),
    sourceUrl: text(rights.sourceUrl),
    checkedAt: text(rights.checkedAt),
  };
}

export function validatePortraitRightsQueue(queue, expectedRecords = [], options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const issues = [];
  if (!isRecord(queue)) {
    return { issues: [issue("queue", "queue-invalid", "Queue must be a JSON object.")], summary: null };
  }
  if (queue.schemaVersion !== PORTRAIT_RIGHTS_QUEUE_SCHEMA_VERSION) {
    issues.push(issue("schemaVersion", "schema-version-invalid", `Expected schema version ${PORTRAIT_RIGHTS_QUEUE_SCHEMA_VERSION}.`));
  }
  const queueDateIssue = dateIssue(queue.updatedAt, today);
  if (queueDateIssue) {
    issues.push(issue("updatedAt", "queue-date-invalid", queueDateIssue));
  }
  const policy = isRecord(queue.policy) ? queue.policy : {};
  for (const [field, expected] of Object.entries({
    worldwidePublicationRequired: true,
    aiGeneratedLikenessesAllowed: false,
    publicAssetReferencesAllowedBeforeClearance: false,
    publishableStatus: "licensed",
    unlicensedPresentation: "photo-not-published",
  })) {
    if (policy[field] !== expected) {
      issues.push(issue(`policy.${field}`, "fail-closed-policy-invalid", `Policy field must equal ${JSON.stringify(expected)}.`));
    }
  }
  if (!Array.isArray(queue.writers)) {
    return { issues: [...issues, issue("writers", "writers-invalid", "writers must be an array.")], summary: null };
  }

  const expectedByKey = new Map(expectedRecords.map((record) => [record.key, record]));
  const publicByKey = new Map(
    (options.publicRecords || expectedRecords).map((record) => [record.key, record])
  );
  const rosterValidationEnabled =
    Object.hasOwn(options, "publicRecords") || expectedRecords.length > 0;
  const seen = new Set();
  const statusCounts = Object.fromEntries(PORTRAIT_RIGHTS_STATUSES.map((status) => [status, 0]));
  let completeRightsBundles = 0;
  let readyForPublication = 0;
  let approvalLedgerEntries = 0;

  for (const [index, entry] of queue.writers.entries()) {
    const entryPath = `writers[${index}]`;
    if (!isRecord(entry)) {
      issues.push(issue(entryPath, "entry-invalid", "Queue entry must be an object."));
      continue;
    }
    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (!Object.hasOwn(entry, field)) {
        issues.push(issue(`${entryPath}.${field}`, "field-missing", "Required field is missing."));
      }
    }
    const key = text(entry.key);
    const countryId = text(entry.countryId);
    const writerId = text(entry.writerId);
    if (!key || key !== `${countryId}:${writerId}` || !SAFE_ID.test(countryId) || !SAFE_ID.test(writerId)) {
      issues.push(issue(`${entryPath}.key`, "writer-key-invalid", "key must equal the safe countryId:writerId pair."));
    }
    if (seen.has(key)) {
      issues.push(issue(`${entryPath}.key`, "writer-key-duplicate", "Writer appears more than once in the queue."));
    }
    seen.add(key);
    if (!text(entry.countryName) || !text(entry.writerName)) {
      issues.push(issue(entryPath, "writer-labels-required", "Country and writer display names are required."));
    }
    if (!STATUS_SET.has(entry.status)) {
      issues.push(issue(`${entryPath}.status`, "status-invalid", `Status must be one of: ${PORTRAIT_RIGHTS_STATUSES.join(", ")}.`));
    } else {
      statusCounts[entry.status] += 1;
    }
    if (typeof entry.notes !== "string") {
      issues.push(issue(`${entryPath}.notes`, "notes-invalid", "notes must be a string."));
    }

    for (const [objectName, fields] of [
      ["candidate", REQUIRED_CANDIDATE_FIELDS],
      ["rights", REQUIRED_RIGHTS_FIELDS],
    ]) {
      const value = entry[objectName];
      if (!isRecord(value)) {
        issues.push(issue(`${entryPath}.${objectName}`, `${objectName}-invalid`, `${objectName} must be an object.`));
        continue;
      }
      for (const field of fields) {
        if (!Object.hasOwn(value, field) || typeof value[field] !== "string") {
          issues.push(issue(`${entryPath}.${objectName}.${field}`, "field-invalid", "Required field must be present as a string."));
        }
      }
    }

    const candidate = isRecord(entry.candidate) ? entry.candidate : {};
    const rights = isRecord(entry.rights) ? entry.rights : {};
    const hasStagedAsset = Boolean(text(candidate.assetRef));
    const bundleIssues = portraitRightsBundleIssues(entry, {
      today,
      identityRegistry: options.identityRegistry,
    });
    const bundleComplete = bundleIssues.length === 0;
    if (bundleComplete) completeRightsBundles += 1;

    if (entry.status === "commons-search") {
      if (hasStagedAsset) {
        issues.push(issue(`${entryPath}.candidate.assetRef`, "uncleared-asset-forbidden", "Do not stage an asset while Commons research is incomplete."));
      }
    } else if (entry.status === "permission-needed") {
      for (const field of ["rightsHolder", "creator"]) {
        if (!text(rights[field]) || UNKNOWN_PARTY.test(text(rights[field]))) {
          issues.push(issue(`${entryPath}.rights.${field}`, "permission-contact-field-required", `A known ${field} is required before requesting permission.`));
        }
      }
      if (text(rights.territory).toLocaleLowerCase("en") !== "worldwide") {
        issues.push(issue(`${entryPath}.rights.territory`, "permission-worldwide-scope-required", "The request must explicitly ask for worldwide publication rights."));
      }
      if (!safeHttpsUrl(rights.sourceUrl)) {
        issues.push(issue(`${entryPath}.rights.sourceUrl`, "permission-source-required", "A credential-free HTTPS source identifying the candidate photograph is required."));
      }
      if (rights.basis !== "permission") {
        issues.push(issue(`${entryPath}.rights.basis`, "permission-basis-required", "permission-needed requires basis=permission."));
      }
      if (text(candidate.mediaKind) !== "photograph") {
        issues.push(issue(`${entryPath}.candidate.mediaKind`, "permission-real-photograph-required", "Permission may be requested only for a documented real photograph."));
      }
      if (!text(candidate.subjectNameAtSource) || !safeHttpsUrl(candidate.identityEvidenceUrl)) {
        issues.push(issue(`${entryPath}.candidate.identityEvidenceUrl`, "permission-identity-evidence-required", "Confirm the depicted writer in an HTTPS authority source before requesting permission."));
      }
      if (hasStagedAsset) {
        issues.push(issue(`${entryPath}.candidate.assetRef`, "unpermitted-asset-forbidden", "Do not stage the portrait until permission evidence is received and reviewed."));
      }
    } else if (entry.status === "permission-received") {
      if (rights.basis !== "permission") {
        issues.push(issue(`${entryPath}.rights.basis`, "permission-basis-required", "permission-received requires basis=permission."));
      }
      const receivedIssues = bundleIssues.filter((item) => item.code !== "staged-asset-required");
      issues.push(...receivedIssues);
      if (hasStagedAsset) {
        issues.push(issue(`${entryPath}.candidate.assetRef`, "preclearance-asset-forbidden", "Legal review must promote the record to licensed before staging the publishable binary."));
      }
    } else if (entry.status === "licensed") {
      issues.push(...bundleIssues);
      if (bundleComplete) readyForPublication += 1;
    } else if (hasStagedAsset) {
      issues.push(issue(`${entryPath}.candidate.assetRef`, "unlicensed-asset-forbidden", "Only a licensed entry may reference a staged portrait asset."));
    }

    const expected = expectedByKey.get(key);
    const publicRecord = publicByKey.get(key);
    if (expected || (publicRecord && entry.status === "licensed")) {
      const rosterRecord = expected || publicRecord;
      for (const field of ["countryId", "countryName", "writerId", "writerName"]) {
        if (text(entry[field]) !== text(rosterRecord[field])) {
          issues.push(issue(`${entryPath}.${field}`, "writer-roster-mismatch", "Queue identity metadata differs from the current public writer roster."));
        }
      }
      if (!expected) approvalLedgerEntries += 1;
    } else if (rosterValidationEnabled) {
      issues.push(issue(`${entryPath}.key`, "resolved-or-unknown-writer", "Only an unresolved no-photo row or a complete licensed approval-ledger row may remain in the queue."));
    }
  }

  if (expectedRecords.length) {
    for (const expected of expectedRecords) {
      if (!seen.has(expected.key)) {
        issues.push(issue(`writers.${expected.key}`, "missing-writer", "Current no-portrait writer is absent from the rights queue."));
      }
    }
  }

  return {
    issues,
    summary: {
      queueEntries: queue.writers.length,
      expectedNoPortraitWriters: expectedRecords.length || queue.writers.length,
      statusCounts,
      completeRightsBundles,
      readyForPublication,
      approvalLedgerEntries,
      invalidEntries: new Set(issues.map((item) => item.path.split(".").slice(0, 2).join("."))).size,
    },
  };
}

export function mergePortraitRightsQueue(
  existingQueue,
  missingPortraitRecords,
  updatedAt,
  publicRecords = missingPortraitRecords
) {
  const existingByKey = new Map(
    (Array.isArray(existingQueue?.writers) ? existingQueue.writers : [])
      .filter((entry) => isRecord(entry) && text(entry.key))
      .map((entry) => [text(entry.key), entry])
  );
  const publicByKey = new Map(publicRecords.map((record) => [record.key, record]));
  const unresolvedByKey = new Map(missingPortraitRecords.map((record) => [record.key, record]));
  const retainedLicensed = [...existingByKey.values()]
    .filter(
      (entry) =>
        entry.status === "licensed" &&
        publicByKey.has(text(entry.key)) &&
        !unresolvedByKey.has(text(entry.key))
    )
    .map((entry) => publicByKey.get(text(entry.key)));
  const rosterByKey = new Map(
    [...missingPortraitRecords, ...retainedLicensed].map((record) => [record.key, record])
  );
  const writers = [...rosterByKey.values()]
    .sort((left, right) => left.key.localeCompare(right.key, "en"))
    .map((record) => {
      const existing = existingByKey.get(record.key);
      if (!existing) return emptyPortraitRightsQueueEntry(record);
      return {
        ...emptyPortraitRightsQueueEntry(record),
        ...existing,
        key: record.key,
        countryId: record.countryId,
        countryName: record.countryName,
        writerId: record.writerId,
        writerName: record.writerName,
        candidate: {
          ...emptyPortraitRightsQueueEntry(record).candidate,
          ...(isRecord(existing.candidate) ? existing.candidate : {}),
        },
        rights: {
          ...emptyPortraitRightsQueueEntry(record).rights,
          ...(isRecord(existing.rights) ? existing.rights : {}),
        },
      };
    });
  return {
    schemaVersion: PORTRAIT_RIGHTS_QUEUE_SCHEMA_VERSION,
    updatedAt,
    policy: {
      worldwidePublicationRequired: true,
      aiGeneratedLikenessesAllowed: false,
      publicAssetReferencesAllowedBeforeClearance: false,
      publishableStatus: "licensed",
      unlicensedPresentation: "photo-not-published",
    },
    writers,
  };
}
