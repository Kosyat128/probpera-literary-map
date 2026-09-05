import { BOOK_DOSSIER_REVIEW_STAGES, bookDossierStructureIssues, compileBookDossier, compileBookDossierReviewPreview } from "./bookDossierCompiler";
import type { BookDossierDesignProof, BookDossierDraft, BookDossierIssue, BookDossierRecord, BookDossierReviewStage, BookDossierStatus } from "./bookDossierDocument";
import { validBookDossierDesignProof } from "./bookDossierDesign";
import { bookDossierBlockChecksum, bookDossierDraftChecksum } from "./bookDossierRights";
import { validateBookDossierDraft } from "./bookDossierValidation";

export type BookDossierActor = Readonly<{ id: string; role: "owner" | "admin" | "editor" }>;
export type BookDossierWorkflowContext = Readonly<{
  actor: BookDossierActor; now: number; expectedRevision: number;
  currentArticleVersions?: Readonly<Record<string, string>>;
  designProof?: BookDossierDesignProof;
}>;
export type BookDossierWorkflowResult = Readonly<{ record: BookDossierRecord | null; issues: readonly BookDossierIssue[] }>;
const denied = (code: string): BookDossierWorkflowResult => ({ record: null, issues: [{ code, path: "workflow" }] });
const privileged = (actor: BookDossierActor) => actor.role === "owner" || actor.role === "admin";

function contextIssue(record: BookDossierRecord | null, context: BookDossierWorkflowContext, withdrawal = false) {
  if (!context.actor || !/^[a-f0-9-]{36}$/u.test(context.actor.id) || !["owner", "admin", "editor"].includes(context.actor.role) || !Number.isFinite(context.now)) return "authenticated-human-required";
  if (!Number.isSafeInteger(context.expectedRevision) || context.expectedRevision !== (record?.revision || 0)) return "revision-conflict";
  // Reserve the final bounded audit event for immediate rights withdrawal.
  if ((record?.audit.length || 0) >= (withdrawal ? 256 : 255)) return "audit-capacity-review-required";
  return null;
}

function appendAudit(record: BookDossierRecord, previous: BookDossierRecord | null, context: BookDossierWorkflowContext,
  action: BookDossierRecord["audit"][number]["action"], reason: string): BookDossierRecord {
  return { ...record, revision: context.expectedRevision + 1, audit: [...(previous?.audit || []), {
    id: crypto.randomUUID(), actorId: context.actor.id, at: new Date(context.now).toISOString(), action, reason,
    previousChecksum: previous?.contentChecksum || null, contentChecksum: record.contentChecksum,
  }] };
}

/** Saves content only. Client-supplied review stamps never create a human approval. */
export async function saveBookDossierDraft(value: unknown, previous: BookDossierRecord | null, context: BookDossierWorkflowContext): Promise<BookDossierWorkflowResult> {
  const error = contextIssue(previous, context);
  if (error) return denied(error);
  const validated = validateBookDossierDraft(value, undefined, true);
  if (!validated.draft) return { record: null, issues: validated.issues };
  if (previous && (validated.draft.bookKey !== previous.draft.bookKey || validated.draft.locale !== previous.draft.locale)) return denied("document-identity-immutable");
  const input = validated.draft;
  const checksums = new Map(await Promise.all(input.blocks.map(async block => [block.rightsId, await bookDossierBlockChecksum(block)] as const)));
  if (checksums.size !== input.blocks.length) return denied("one-rights-envelope-per-block-required");
  const draft: BookDossierDraft = { ...input,
    sources: input.sources.map(source => ({ ...source, reviewedBy: null, reviewedAt: null })),
    rights: input.rights.map(grant => ({ ...grant, contentChecksum: checksums.get(grant.id) || grant.contentChecksum,
      reviewedBy: null, reviewedAt: null, reviewKind: "UNREVIEWED",
      ...(grant.translation ? { translation: { ...grant.translation, reviewedBy: null, reviewedAt: null } } : {}),
    })),
  };
  const record: BookDossierRecord = { draft, status: previous ? "RE_REVIEW_REQUIRED" : "DRAFT", revision: 0,
    contentChecksum: await bookDossierDraftChecksum(draft), reviews: [], audit: [] };
  return { record: appendAudit(record, previous, context, previous ? "EDIT" : "CREATE", "Content saved; all reviews required"), issues: [] };
}

/** The CMS supplies context.actor from requireStaff(), never from request data. */
export async function reviewBookDossier(record: BookDossierRecord, stage: BookDossierReviewStage,
  decision: "APPROVED" | "CHANGES_REQUIRED", confirmedHumanReview: boolean, context: BookDossierWorkflowContext): Promise<BookDossierWorkflowResult> {
  const error = contextIssue(record, context);
  if (error) return denied(error);
  if (!confirmedHumanReview || !BOOK_DOSSIER_REVIEW_STAGES.includes(stage) || !["APPROVED", "CHANGES_REQUIRED"].includes(decision)) return denied("explicit-human-review-required");
  if (decision === "APPROVED") {
    const validated = validateBookDossierDraft(record.draft);
    if (validated.issues.length) return { record: null, issues: validated.issues };
  }
  if (["PUBLISHED", "ARCHIVED", "BLOCKED"].includes(record.status)) return denied("review-state-invalid");
  if (["rights", "final"].includes(stage) && !privileged(context.actor)) return denied("owner-or-admin-required");
  if (await bookDossierDraftChecksum(record.draft) !== record.contentChecksum) return denied("dossier-changed-re-review-required");
  const stageIndex = BOOK_DOSSIER_REVIEW_STAGES.indexOf(stage);
  if (stage === "design" && decision === "APPROVED" && !validBookDossierDesignProof(context.designProof, record.draft, record.contentChecksum, context.now)) return denied("measured-design-review-required");
  if (decision === "APPROVED" && BOOK_DOSSIER_REVIEW_STAGES.slice(0, stageIndex).some(required =>
    !record.reviews.some(review => review.stage === required && review.decision === "APPROVED" && review.contentChecksum === record.contentChecksum))) return denied("previous-human-review-required");
  const now = new Date(context.now).toISOString();
  let draft = record.draft;
  if (decision === "APPROVED" && stage === "facts") draft = { ...draft, sources: draft.sources.map(source => ({ ...source, reviewedAt: now, reviewedBy: context.actor.id })) };
  if (decision === "APPROVED" && stage === "rights") draft = { ...draft, rights: draft.rights.map(grant => ({ ...grant,
    reviewedAt: now, reviewedBy: context.actor.id, reviewKind: "HUMAN",
    ...(grant.translation ? { translation: { ...grant.translation, reviewedAt: now, reviewedBy: context.actor.id } } : {}),
  })) };
  const statuses: readonly BookDossierStatus[] = ["RIGHTS_REVIEW", "EDITORIAL_REVIEW", "DESIGN_REVIEW", "ACCESSIBILITY_REVIEW", "READY", "READY"];
  const candidate: BookDossierRecord = { ...record, draft,
    status: decision === "APPROVED" ? statuses[stageIndex] : "RE_REVIEW_REQUIRED",
    reviews: [...record.reviews.filter(review => BOOK_DOSSIER_REVIEW_STAGES.indexOf(review.stage) < stageIndex), {
      stage, actorId: context.actor.id, actorKind: "HUMAN", reviewedAt: now,
      dossierVersion: draft.dossierVersion, contentChecksum: record.contentChecksum, decision,
      ...(stage === "design" && context.designProof ? { designProof: context.designProof } : {}),
    }],
  };
  if (decision === "APPROVED") {
    const issues = bookDossierStructureIssues(draft);
    if (issues.length) return { record: null, issues };
    if (stageIndex >= 1) {
      const preview = await compileBookDossierReviewPreview(candidate, { ...context, themeVersion: "cms-review" });
      if (preview.issues.length) return { record: null, issues: preview.issues };
    }
  }
  return { record: appendAudit(candidate, record, context, "REVIEW", `${stage}: ${decision}`), issues: [] };
}

export async function publishBookDossier(record: BookDossierRecord, context: BookDossierWorkflowContext): Promise<BookDossierWorkflowResult> {
  const error = contextIssue(record, context);
  if (error) return denied(error);
  if (!privileged(context.actor)) return denied("owner-or-admin-required");
  if (record.status !== "READY") return denied("ready-review-required");
  const candidate = { ...record, status: "PUBLISHED" as const };
  const compiled = await compileBookDossier(candidate, { ...context, themeVersion: "published-v2" });
  if (!compiled.document) return { record: null, issues: compiled.issues };
  return { record: appendAudit(candidate, record, context, "PUBLISH", "Explicit human publication"), issues: [] };
}

export async function withdrawBookDossier(record: BookDossierRecord, action: "REVOKE" | "ARCHIVE", reason: string, context: BookDossierWorkflowContext): Promise<BookDossierWorkflowResult> {
  const error = contextIssue(record, context, true);
  if (error) return denied(error);
  if (!privileged(context.actor) || !["REVOKE", "ARCHIVE"].includes(action)) return denied("owner-or-admin-required");
  if (!reason.trim() || reason.length > 500 || /[<>\u0000-\u001f]/u.test(reason)) return denied("withdrawal-reason-required");
  const draft = action === "REVOKE" ? { ...record.draft, rights: record.draft.rights.map(grant => ({ ...grant, revokedAt: new Date(context.now).toISOString() })) } : record.draft;
  const candidate = { ...record, draft, status: action === "REVOKE" ? "BLOCKED" as const : "ARCHIVED" as const,
    contentChecksum: await bookDossierDraftChecksum(draft), reviews: [] };
  return { record: appendAudit(candidate, record, context, action, reason), issues: [] };
}
