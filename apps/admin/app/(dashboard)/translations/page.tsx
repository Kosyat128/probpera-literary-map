import TranslationSubmitButton from "@/components/TranslationSubmitButton";
import { z } from "zod";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import {
  adminReadMessage, isReadRecord, readAdminList, readAdminResult,
  type AdminReadIssue, type AdminReadResult,
} from "@/lib/admin-read-result";
import { adminEnv } from "@/lib/env";
import { decodeArticleTranslationResumeCursor } from "@/lib/article-translation-scan";
import type { ArticleTranslationItemRetryReceipt, ArticleTranslationItemRetryProgress, ArticleTranslationItemRetryCandidate } from "@/lib/article-translation-item-retry";
import { canFinalizeOrdinaryCandidate, type ArticleTranslationOrdinaryReceipt } from "@/lib/article-translation-ordinary-rpc";
import { formatDate, safeCount } from "@/lib/format";
import {
  loadEditorialCatalog,
  type EditorialCatalog,
} from "@/lib/editorial-catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readSiteCopyValues } from "@/lib/site-copy-storage";
import { premiumTranslationRuntimeReadiness } from "@/lib/premium-english-translation";
import {
  PREMIUM_TRANSLATION_PROBE_COLUMNS, isPremiumTranslationProbe,
  premiumTranslationConfigurationIdentity, premiumTranslationProbeStatus,
  type PremiumTranslationProbe,
} from "@/lib/premium-translation-probe";
import { translationErrorMessage, type TranslationErrorCode } from "@/lib/translation-errors";
import { unstable_rethrow } from "next/navigation";

import { translatePremiumArticleBatchAction } from "./article-actions";
import {
  translatePremiumLibraryBatchAction,
  translatePremiumSiteCopyBatchAction,
  translatePremiumWriterBatchAction,
} from "./actions";
import { translatePremiumCountryBatchAction } from "./country-actions";
import { runPremiumTranslationSelfTestAction } from "./self-test-action";
import { resumeTranslationJobAction } from "./resume-action";

export const metadata = { title: "Premium English" };
export const dynamic = "force-dynamic";

type BackfillCursorQuery = {
  articleJob?: string;
  articleCursor?: string;
  libraryCursor?: string;
  writerCursor?: string;
  countryCursor?: string;
};

type RetryQuery = { retryJob?: string; retryItem?: string; retryOperation?: string };
const retryItemRow = z.object({
  id: z.string().uuid(), job_id: z.string().uuid(), entity_type: z.literal("article"),
  entity_id: z.string().uuid(), position: z.number().int().min(0).max(499),
  status: z.enum(["dead_letter", "conflict", "stale", "not-configured", "reviewing", "retry_wait"]),
  source_hash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
  attempt_count: z.number().int().min(0).max(10), max_attempts: z.number().int().min(1).max(5),
  last_error_code: z.enum(["translation_not_configured", "provider_unavailable", "provider_request_failed", "provider_invalid_response",
    "source_changed", "write_conflict", "database_read_failed", "database_write_failed", "unexpected"]).nullable(),
}).strict();
type RetryItemRow = z.infer<typeof retryItemRow>;
type RetrySelection = {
  ordinary?: boolean;
  items: AdminReadResult<RetryItemRow[]>;
  receipt: { status: "success"; data: ArticleTranslationItemRetryReceipt | ArticleTranslationOrdinaryReceipt } | { status: "failed"; errorCode: TranslationErrorCode } | null;
  progress?: { status: "success"; data: ArticleTranslationItemRetryProgress } | { status: "failed"; errorCode: TranslationErrorCode } | null;
  candidate?: { status: "success"; data: ArticleTranslationItemRetryCandidate } | { status: "failed"; errorCode: TranslationErrorCode } | null;
};

const retryBlockMessages: Record<NonNullable<ArticleTranslationItemRetryReceipt["blockReason"]>, string> = {
  source_hash_missing: "В журнале нет достаточных сведений об исходном тексте для безопасного повтора.",
  item_not_failed: "Элемент уже выполнен или не относится к неуспешным.",
  attempt_limit: "Достигнут предел попыток для этого элемента.",
  job_not_finished: "Исходный пакет ещё выполняется.",
  job_not_sync: "Этот элемент относится к другому способу выполнения задач.",
  operation_stopped: "Задача отменена или остановлена.",
  retry_busy: "Для элемента уже выполняется повтор или ожидается подтверждение результата.",
  author_draft_exists: "У статьи есть рабочий черновик. Он сохранён; завершите работу с ним перед переводом.",
  manual_english: "Ручная английская версия защищена от автоматической замены.",
  source_unavailable: "Не удалось получить действующий русский оригинал.",
  source_shape_unsupported: "Данные статьи требуют проверки перед созданием рабочего черновика.",
};

const candidateBlockMessages: Record<NonNullable<ArticleTranslationItemRetryCandidate["blockReason"]>, string> = {
  candidate_missing: "Отдельная сохранённая копия кандидата этой попытки не подтверждена.",
  source_changed: "Русский оригинал изменился. Сохранённый кандидат требует проверки редактором.",
  english_changed: "Английская версия изменилась. Её данные сохранены; автоматическая замена заблокирована.",
  draft_changed: "Рабочий черновик изменён отдельно. Его текущие данные сохранены; прежний кандидат не заменяет их.",
  draft_missing: "Прежний рабочий черновик больше не найден. Он не создаётся заново из этой попытки.",
  provider_outcome_unconfirmed: "Не все результаты запросов подтверждены. Завершение учёта пока недоступно.",
};

function retrySelectionHref(query: BackfillCursorQuery, selection: RetryQuery) {
  const search = new URLSearchParams();
  for (const key of ["articleJob", "articleCursor", "libraryCursor", "writerCursor", "countryCursor"] as const) {
    if (typeof query[key] === "string") search.set(key, query[key]);
  }
  for (const [key, value] of Object.entries(selection)) {
    if (typeof value === "string") search.set(key, value);
  }
  return `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/translations?${search}`;
}

async function readRetrySelection(
  query: RetryQuery,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<RetrySelection | null> {
  if (query.retryJob === undefined) return null;
  if (!z.string().uuid().safeParse(query.retryJob).success ||
    query.retryItem !== undefined && !z.string().uuid().safeParse(query.retryItem).success ||
    query.retryOperation !== undefined && (!query.retryItem || !z.string().uuid().safeParse(query.retryOperation).success)) {
    return { items: { status: "failed", issue: "invalid" }, receipt: { status: "failed", errorCode: "invalid_input" } };
  }
  const { requireStaffRead } = await import("@/lib/admin-read-access");
  const staff = await requireStaffRead();
  if (!staff || !supabase) return { items: { status: "failed", issue: "permission" }, receipt: null };
  const { getArticleTranslationItemRetrySelection, getArticleTranslationItemRetryProgress,
    getArticleTranslationItemRetryCandidate, parseArticleTranslationItemRetryCandidateReceipt, ArticleTranslationItemRetryRpcError } =
    await import("@/lib/article-translation-item-retry");
  const { getArticleTranslationItemDomain, getArticleTranslationOrdinarySelection,
    ordinaryReceiptMatchesCandidate, parseArticleTranslationOrdinaryReceipt, ArticleTranslationOrdinaryRpcError } =
    await import("@/lib/article-translation-ordinary-rpc");
  let ordinary = false;
  try {
    ordinary = (await getArticleTranslationItemDomain(supabase, query.retryJob)).kind === "ordinary";
  } catch (error) {
    unstable_rethrow(error);
    return { items: { status: "failed", issue: "unavailable" }, receipt: { status: "failed",
      errorCode: error instanceof ArticleTranslationOrdinaryRpcError ? error.errorCode : "translation_retry_unconfirmed" } };
  }
  const selectedItem = query.retryItem;
  const reads = await Promise.allSettled([
    supabase.from("translation_job_items")
      .select("id,job_id,entity_type,entity_id,position,status,source_hash,attempt_count,max_attempts,last_error_code")
      .eq("job_id", query.retryJob).eq("entity_type", "article")
      .in("status", ["dead_letter", "conflict", "stale", "not-configured", "reviewing", "retry_wait"])
      .order("position", { ascending: true }).limit(500),
    selectedItem ? (ordinary ? getArticleTranslationOrdinarySelection : getArticleTranslationItemRetrySelection)(supabase, {
      jobId: query.retryJob, itemId: selectedItem, operationId: query.retryOperation ?? null,
    }) : Promise.resolve(null),
  ]);
  // Inspect control flow from both reads before returning an ordinary error.
  for (const read of reads) {
    if (read.status === "rejected") unstable_rethrow(read.reason);
    else if (isReadRecord(read.value) && "error" in read.value) unstable_rethrow(read.value.error);
  }
  const items = readAdminList(reads[0], value => {
    const parsed = retryItemRow.safeParse(value);
    return parsed.success && parsed.data.job_id.toLowerCase() === query.retryJob?.toLowerCase();
  }) as AdminReadResult<RetryItemRow[]>;
  const receiptRead = reads[1];
  let receipt: RetrySelection["receipt"] = !selectedItem ? null : receiptRead.status === "fulfilled" && receiptRead.value
    ? { status: "success", data: receiptRead.value } as const
    : { status: "failed", errorCode: receiptRead.status === "rejected" &&
      (receiptRead.reason instanceof ArticleTranslationItemRetryRpcError || receiptRead.reason instanceof ArticleTranslationOrdinaryRpcError)
      ? receiptRead.reason.errorCode : "translation_retry_unconfirmed" } as const;
  let progress: RetrySelection["progress"] = null;
  let candidate: RetrySelection["candidate"] = null;
  if (receipt?.status === "success" && receipt.data.operationId !== null &&
    (receipt.data.phase === "running" || receipt.data.phase === "finished")) {
    try {
      progress = { status: "success", data: await getArticleTranslationItemRetryProgress(supabase, {
        jobId: receipt.data.jobId, itemId: receipt.data.itemId, articleId: receipt.data.articleId,
        operationId: receipt.data.operationId,
      }) };
    } catch (error) {
      unstable_rethrow(error);
      progress = { status: "failed", errorCode: error instanceof ArticleTranslationItemRetryRpcError
        ? error.errorCode : "translation_retry_unconfirmed" };
    }
    try {
      candidate = { status: "success", data: await getArticleTranslationItemRetryCandidate(supabase, {
        jobId: receipt.data.jobId, itemId: receipt.data.itemId, articleId: receipt.data.articleId,
        operationId: receipt.data.operationId,
      }) };
    } catch (error) {
      unstable_rethrow(error);
      candidate = { status: "failed", errorCode: error instanceof ArticleTranslationItemRetryRpcError
        ? error.errorCode : "translation_retry_unconfirmed" };
    }
  }
  if (receipt?.status === "success" && receipt.data.phase === "finished" && candidate?.status === "success" &&
    candidate.data.candidateState === "finished") {
    const target = {
      jobId: receipt.data.jobId, itemId: receipt.data.itemId, articleId: receipt.data.articleId,
      operationId: receipt.data.operationId,
    };
    const confirmed = ordinary ? parseArticleTranslationOrdinaryReceipt(receipt.data, target, "finish")
      : parseArticleTranslationItemRetryCandidateReceipt(receipt.data, target, candidate.data);
    if (!confirmed || ordinary && !ordinaryReceiptMatchesCandidate(confirmed as ArticleTranslationOrdinaryReceipt, candidate.data)) {
      receipt = { status: "failed", errorCode: "translation_retry_unconfirmed" };
    }
  }
  return { items, receipt, progress, candidate, ordinary };
}

function BackfillCursorFields({ query, articleScan = false }: { query: BackfillCursorQuery; articleScan?: boolean }) {
  return (
    <>
      {query.articleJob !== undefined && <input type="hidden" name="articleJob" value={query.articleJob} />}
      {!articleScan && <input type="hidden" name="articleCursor" value={query.articleCursor || "0"} />}
      <input type="hidden" name="libraryCursor" value={query.libraryCursor || "0"} />
      <input type="hidden" name="writerCursor" value={query.writerCursor || "0"} />
      <input type="hidden" name="countryCursor" value={query.countryCursor || "0"} />
    </>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function countRead(
  result: PromiseSettledResult<{ count: number | null; error?: unknown }>,
): AdminReadResult<number> {
  const read = readAdminResult(result.status === "fulfilled"
    ? { status: "fulfilled", value: { data: safeCount(result.value), error: result.value?.error } }
    : result, validCount);
  return read.status === "failed" ? read : { status: "success", data: read.data as number };
}

function displayCount(value: number | null) {
  return value === null ? "Недоступно" : value;
}

function validDate(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 &&
    Number.isFinite(Date.parse(value));
}

// Read validity and the resume action's accepted IDs are separate contracts.
function supportsJobResumeId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id);
}

function validSiteCopyRow(row: Record<string, unknown>) {
  if (!isReadRecord(row.settings)) return false;
  const settings = row.settings;
  if (settings.siteCopy !== undefined) {
    if (!isReadRecord(settings.siteCopy)) return false;
    for (const locale of ["ru", "en"]) {
      const values = settings.siteCopy[locale];
      if (values !== undefined && (!isReadRecord(values) ||
        !Object.values(values).every((value) => typeof value === "string"))) return false;
    }
  }
  if (settings.premiumTranslation !== undefined) {
    if (!isReadRecord(settings.premiumTranslation)) return false;
    const machine = settings.premiumTranslation.siteCopyEn;
    if (machine !== undefined && (!isReadRecord(machine) ||
      !Object.values(machine).every(isReadRecord))) return false;
  }
  return true;
}

function validOperations(value: unknown): value is Record<string, unknown> & {
  queued: number; running: number; completed: number; attention: number;
  deadLetterItems: number; recent: Record<string, unknown>[];
} {
  return isReadRecord(value) &&
    ["queued", "running", "completed", "attention", "deadLetterItems"].every((key) => validCount(value[key])) &&
    Array.isArray(value.recent) && value.recent.every((job) =>
      isReadRecord(job) && typeof job.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(job.id) &&
      typeof job.kind === "string" && ["article", "literary_work", "writer", "country", "site_copy"].includes(job.kind) &&
      typeof job.status === "string" && ["queued", "running", "reviewing", "cancelling", "completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured", "cancelled"].includes(job.status) &&
      ["totalItems", "succeededItems", "failedItems"].every((key) => validCount(job[key])) &&
      Number(job.totalItems) <= 500 && Number(job.succeededItems) + Number(job.failedItems) <= Number(job.totalItems) &&
      (!Object.hasOwn(job, "resumeCursor") || isReadRecord(job.resumeCursor)) &&
      validDate(job.createdAt) && validDate(job.updatedAt));
}

function validProviderProbe(value: unknown) {
  return isPremiumTranslationProbe(value) && value.provider === adminEnv.premiumTranslationProvider;
}

function validEditorialCatalog(value: unknown): value is EditorialCatalog {
  return isReadRecord(value) && value.version === 1 && Array.isArray(value.countries) &&
    value.countries.every((country) => isReadRecord(country) && isReadRecord(country.fields) &&
      Array.isArray(country.writers) && country.writers.every((writer) => isReadRecord(writer) && isReadRecord(writer.fields)));
}

function LoadNotice({ label, issue, retryHref }: { label: string; issue: AdminReadIssue; retryHref: string }) {
  return <p className="notice" role="status">
    {label}: Недоступно. {adminReadMessage(issue)}{" "}
    <a href={retryHref}>Повторить загрузку</a>
  </p>;
}

const translationKindLabels: Record<string, string> = {
  article: "Статьи",
  literary_work: "Книги",
  writer: "Биографии",
  country: "Страны",
  site_copy: "Тексты интерфейса",
};

function eligibleStaticWriterBiographies(
  editorialCatalog: EditorialCatalog
) {
  let total = 0;
  for (const country of editorialCatalog.countries) {
    for (const writer of country.writers) {
      const translations = objectValue(writer.fields.biographyTranslations);
      const ru = objectValue(translations.ru);
      if (
        ru.locale === "ru" &&
        ru.method === "editorial-original" &&
        new Set(["reviewed", "verified"]).has(String(ru.status)) &&
        typeof ru.text === "string" &&
        ru.text.trim().length >= 120 &&
        Array.isArray(ru.sources) &&
        ru.sources.length > 0
      ) {
        total += 1;
      }
    }
  }
  return total;
}

function eligibleStaticCountries(
  editorialCatalog: EditorialCatalog
) {
  return editorialCatalog.countries.filter((country) => {
    const fields = country.fields;
    return (
      typeof fields.name === "string" &&
      fields.name.trim().length > 0 &&
      [fields.description, fields.history, fields.historicalNote].some(
        (value) => typeof value === "string" && value.trim().length > 0
      )
    );
  }).length;
}

export default async function PremiumTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    errorCode?: string;
    publication?: string;
    articleCursor?: string;
    articleJob?: string;
    libraryCursor?: string;
    writerCursor?: string;
    countryCursor?: string;
    selfTest?: string;
    retryJob?: string;
    retryItem?: string;
    retryOperation?: string;
  }>;
}) {
  const query = await searchParams;
  const [catalogResult] = await Promise.allSettled([loadEditorialCatalog()]);
  const catalogRead = readAdminResult(catalogResult.status === "fulfilled"
    ? { status: "fulfilled", value: { data: catalogResult.value, error: null } }
    : catalogResult, validEditorialCatalog);
  const retrySearch = new URLSearchParams();
  for (const key of ["articleCursor", "articleJob", "libraryCursor", "writerCursor", "countryCursor", "retryJob", "retryItem", "retryOperation"] as const) {
    if (query[key] !== undefined) retrySearch.set(key, query[key]);
  }
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/translations${retrySearch.size ? `?${retrySearch.toString()}` : ""}`;
  const supabase = await createServerSupabaseClient();
  const unavailableRead = { status: "rejected", reason: null } as const;

  const [
    articleCountResult,
    articleEnglishCountResult,
    workRussianCountResult,
    workEnglishCountResult,
    siteCopyResult,
    machineWorkReadiness,
    translationOperationsReadiness,
    translationOperationsStatus,
    providerSelfTestResult,
    articleSyncReadiness,
  ] = supabase
    ? await Promise.allSettled([
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .is("deleted_at", null),
        supabase
          .from("article_translations")
          .select("id", { count: "exact", head: true })
          .eq("locale", "en")
          .eq("status", "published")
          .is("deleted_at", null),
        supabase
          .from("literary_work_translations")
          .select("id", { count: "exact", head: true })
          .eq("locale", "ru")
          .in("editorial_status", ["reviewed", "verified"]),
        supabase
          .from("literary_work_translations")
          .select("id", { count: "exact", head: true })
          .eq("locale", "en")
          .in("editorial_status", ["reviewed", "verified"]),
        supabase
          .from("homepage_blocks")
          .select("settings")
          .contains("settings", { systemKey: "site-copy-overrides" })
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase.rpc("premium_machine_translation_ready"),
        supabase.rpc("translation_operations_ready"),
        supabase.rpc("get_translation_operations_status"),
        supabase
          .from("translation_provider_self_tests")
          .select(PREMIUM_TRANSLATION_PROBE_COLUMNS)
          .eq("provider", adminEnv.premiumTranslationProvider)
          .maybeSingle(),
        supabase.rpc("article_translation_sync_ready"),
      ])
    : [unavailableRead, unavailableRead, unavailableRead, unavailableRead, unavailableRead, unavailableRead, unavailableRead, unavailableRead, unavailableRead, unavailableRead];

  const articleCountRead = countRead(articleCountResult);
  const articleEnglishCountRead = countRead(articleEnglishCountResult);
  const workRussianCountRead = countRead(workRussianCountResult);
  const workEnglishCountRead = countRead(workEnglishCountResult);
  const siteCopyRead = readAdminList(siteCopyResult, validSiteCopyRow);
  const machineRead = readAdminResult(machineWorkReadiness, (data) => typeof data === "boolean");
  const operationsReadinessRead = readAdminResult(translationOperationsReadiness, (data) => typeof data === "boolean");
  const operationsRead = readAdminResult(translationOperationsStatus, validOperations);
  const probeRead = readAdminResult<PremiumTranslationProbe | null>(providerSelfTestResult, (data) => data === null || validProviderProbe(data));
  const articleSyncRead = readAdminResult(articleSyncReadiness, (data) => typeof data === "boolean");
  const siteCopySettings = siteCopyRead.status === "success"
    ? objectValue(siteCopyRead.data[0]?.settings) : {};
  const siteCopy = siteCopyRead.status === "success" ? readSiteCopyValues(siteCopySettings.siteCopy) : null;
  const premiumState = objectValue(siteCopySettings.premiumTranslation);
  const machineCopy = objectValue(premiumState.siteCopyEn);
  const runtimeReadiness = premiumTranslationRuntimeReadiness();
  const workersAi = adminEnv.premiumTranslationProvider === "cloudflare";
  const translatorModel = workersAi
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel;
  const reviewerModel = workersAi
    ? adminEnv.cloudflareTranslationReviewModel
    : adminEnv.openAiTranslationReviewModel;
  const bookDbReady = machineRead.status === "success" ? machineRead.data : null;
  const operationsReady = operationsReadinessRead.status === "success" ? operationsReadinessRead.data : null;
  const operations = operationsRead.status === "success" ? objectValue(operationsRead.data) : null;
  const recentJobs = operations && Array.isArray(operations.recent) ? operations.recent as Record<string, unknown>[] : [];
  const providerProbe = probeRead.status === "success" ? objectValue(probeRead.data) : {};
  const [identityResult] = await Promise.allSettled([premiumTranslationConfigurationIdentity()]);
  if (identityResult.status === "rejected") unstable_rethrow(identityResult.reason);
  const probeStatus = premiumTranslationProbeStatus(probeRead.status === "success" ? probeRead.data : null,
    runtimeReadiness, identityResult.status === "fulfilled" ? identityResult.value : null);
  const translationReady = probeRead.status === "success" && probeStatus === "ready";
  const selfTestBusy = providerProbe.test_in_progress === true &&
    (typeof providerProbe.cooldown_until !== "string" || Date.parse(providerProbe.cooldown_until) > Date.now());
  const eligibleWriters = catalogRead.status === "success" ? eligibleStaticWriterBiographies(catalogRead.data) : null;
  const eligibleCountries = catalogRead.status === "success" ? eligibleStaticCountries(catalogRead.data) : null;
  // A confirmed capability-off keeps the established manual bounded mode.
  // Unknown readiness or status never authorizes a compatibility fallback.
  const batchReady = translationReady && operationsReady !== null &&
    (operationsReady === false || operationsRead.status === "success");
  const articleReady = batchReady && articleSyncRead.status === "success" && articleSyncRead.data === true &&
    articleCountRead.status === "success" && articleEnglishCountRead.status === "success";
  const libraryReady = batchReady && bookDbReady === true && workRussianCountRead.status === "success" && workEnglishCountRead.status === "success";
  const writerReady = batchReady && catalogRead.status === "success";
  const countryReady = writerReady;
  const siteCopyReady = batchReady && siteCopyRead.status === "success";
  const resumeReadyByKind = { article: articleReady, literary_work: libraryReady, writer: writerReady, country: countryReady, site_copy: siteCopyReady };
  const selectedArticleJobRead = query.articleJob === undefined ? null : readAdminResult(
    (await Promise.allSettled([supabase && supportsJobResumeId(query.articleJob)
      ? supabase.rpc("get_translation_job_resume", { p_job_id: query.articleJob })
      : Promise.reject(new Error("Unavailable article job"))]))[0],
    (value) => isReadRecord(value) && typeof value.id === "string" &&
      value.id.toLowerCase() === query.articleJob?.toLowerCase() && value.kind === "article",
  );
  const selectedArticleScan = selectedArticleJobRead?.status === "success"
    ? decodeArticleTranslationResumeCursor(objectValue(selectedArticleJobRead.data).resumeCursor) : null;
  const selectedArticleStatus = selectedArticleJobRead?.status === "success" ? objectValue(selectedArticleJobRead.data).status : null;
  const canContinueArticleScan = selectedArticleScan?.kind === "scan" && !selectedArticleScan.state.exhausted &&
    selectedArticleStatus !== "cancelled" && selectedArticleStatus !== "cancelling" && selectedArticleStatus !== "reviewing";
  const retrySelection = await readRetrySelection(query, supabase);
  const retryReceipt = retrySelection?.receipt?.status === "success" ? retrySelection.receipt.data : null;
  const retryCandidate = retrySelection?.candidate?.status === "success" ? retrySelection.candidate.data : null;
  const retryOperationId = query.retryOperation ?? (retryReceipt?.phase === "ready" ? crypto.randomUUID() : null);
  const canRetryItem = translationReady && operationsReady === true && retryReceipt?.phase === "ready" &&
    retryReceipt.retryable && BigInt(retryReceipt.jobVersion) <= 9_223_372_036_854_775_805n;
  const retryArticleTranslationItemAction = retryReceipt?.phase === "ready"
    ? (await import("./article-item-retry-action")).retryArticleTranslationItemAction : undefined;
  const finalizeChangedCandidate = retrySelection?.ordinary === true && retryCandidate !== null &&
    !retryCandidate.canRecover && canFinalizeOrdinaryCandidate(retryCandidate);
  const recoverArticleTranslationItemCandidateAction = retryReceipt?.phase === "running" && retryCandidate !== null &&
    (retryCandidate.canRecover || finalizeChangedCandidate)
    ? (await import("./article-item-retry-action")).recoverArticleTranslationItemCandidateAction : undefined;
  const notices = [
    ["Показатель опубликованных статей", articleCountRead],
    ["Показатель английских статей", articleEnglishCountRead],
    ["Показатель русских карточек книг", workRussianCountRead],
    ["Показатель английских карточек книг", workEnglishCountRead],
    ["Тексты CMS", siteCopyRead], ["Редакционный каталог", catalogRead],
    ["Готовность переводов книг", machineRead],
    ["Готовность переводов статей", articleSyncRead],
    ["Готовность очереди переводов", operationsReadinessRead],
    ["Журнал очереди переводов", operationsRead],
    ["Проверка провайдера", probeRead],
  ] as const;

  const readinessChecks = [
    [
      workersAi ? "Cloudflare Workers AI binding" : "OpenAI server secret",
      probeRead.status === "failed" ? null : translationReady,
    ],
    ["Модель переводчика", Boolean(translatorModel)],
    ["Второй редакторский проход", adminEnv.openAiPremiumTranslationReview],
    ["DB: machine-translation для книг", bookDbReady],
    ["Журнал и очередь Translation Operations", operationsReady],
    ["Защита повторных переводов статей", articleSyncRead.status === "success" ? articleSyncRead.data : null],
  ] as const;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Premium English · {workersAi ? "Cloudflare Workers AI" : "OpenAI"}
          </span>
          <h1>Премиальный английский перевод</h1>
          <p>
            Модель {translatorModel} переводит полный материал.
            {adminEnv.openAiPremiumTranslationReview
              ? ` Модель ${reviewerModel} сверяет перевод с русским оригиналом и выполняет финальную редактуру.`
              : ` Модель ${reviewerModel} используется для исправления ответа, если требуется; второй редакторский проход отключён.`}{" "}
            Ручные EN-версии никогда автоматически не перезаписываются.
          </p>
        </div>
      </header>

      {translationErrorMessage(query.errorCode) && (
        <p className="form-message">{translationErrorMessage(query.errorCode)}</p>
      )}
      {query.success && (
        <p className="form-message" role="status">
          Результат операции нужно проверить по актуальному состоянию ниже.
        </p>
      )}
      {["passed", "failed"].includes(query.selfTest || "") && (
        <p className="form-message" role="status">Результат контрольного запроса показан в актуальном состоянии провайдера ниже.</p>
      )}

      {notices.map(([label, read]) => read.status === "failed" && (
        <LoadNotice key={label} label={label} issue={read.issue} retryHref={retryHref} />
      ))}
      {selectedArticleJobRead?.status === "failed" && (
        <LoadNotice label="Позиция обхода статей" issue={selectedArticleJobRead.issue} retryHref={retryHref} />
      )}
      {selectedArticleScan && (selectedArticleScan.kind !== "scan" || selectedArticleScan.state.exhausted) && (
        <p className="notice" role="status">{translationErrorMessage(selectedArticleScan.kind === "scan"
          ? "translation_scan_complete" : "translation_resume_stale")}</p>
      )}
      {(selectedArticleStatus === "cancelled" || selectedArticleStatus === "cancelling") && (
        <p className="notice" role="status">{translationErrorMessage("translation_operation_stopped")}</p>
      )}
      {selectedArticleStatus === "reviewing" && (
        <p className="notice" role="status">{translationErrorMessage("translation_retry_pending")}</p>
      )}

      <section className="dashboard-grid">
        <article className="panel">
          <span className="eyebrow">Модели</span>
          <h2>{translatorModel}</h2>
          <p>
            {adminEnv.openAiPremiumTranslationReview ? "Финальная редактура" : "Исправление ответа"}: <strong>{reviewerModel}</strong>
          </p>
          <p className="editorial-note">
            {adminEnv.openAiPremiumTranslationReview
              ? "Premium review включён: на материал выполняются два независимых модельных прохода."
              : "Premium review отключён переменной окружения."}
          </p>
        </article>
        <article className="panel">
          <span className="eyebrow">Готовность</span>
          <div className="status-list">
            {readinessChecks.map(([label, ready]) => (
              <div key={label}>
                <span>{label}</span>
                <strong style={{ color: ready ? "var(--good)" : "var(--orange-soft)" }}>
                  {ready === null ? "Недоступно" : ready ? "Готово" : "Нужно подключить"}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <span className="eyebrow">Translation Operations</span>
        <h2>{operationsReady === null ? "Состояние очереди недоступно" : operationsReady ? "Долговечный контур заданий готов" : "Нужна миграция очереди переводов"}</h2>
        <p>
          {operationsReady === null
            ? "Не удалось проверить готовность очереди. Повторите чтение данных перед запуском задания."
            : operationsReady
            ? "Каждый малый пакет сохраняет задания, элементы, попытки, статусы и следующий курсор в приватной базе без исходных текстов и сырых ответов провайдера. Кнопка продолжения - активный ограниченный staff-runner с сохранённой позиции. Service-role lease API также закрыт от браузера и готов для отдельного фонового worker, но расписание worker в этом интерфейсе не заявляется."
            : "Пока миграция Translation Operations не применена, доступны только малые ограниченные пакеты в текущем запросе. Интерфейс не выдаёт их за фоновые задания."}
        </p>
        {operationsReady && (
          <div className="status-list">
            <div><span>В очереди</span><strong>{displayCount(operations ? Number(operations.queued) : null)}</strong></div>
            <div><span>В работе</span><strong>{displayCount(operations ? Number(operations.running) : null)}</strong></div>
            <div><span>Завершённых пакетов</span><strong>{displayCount(operations ? Number(operations.completed) : null)}</strong></div>
            <div><span>Требуют внимания</span><strong>{displayCount(operations ? Number(operations.attention) : null)}</strong></div>
            <div><span>Dead-letter элементов</span><strong>{displayCount(operations ? Number(operations.deadLetterItems) : null)}</strong></div>
          </div>
        )}
        {operationsReady && recentJobs.length > 0 && (
          <div className="settings-stack" style={{ marginTop: 16 }}>
            <h3>Последние пакеты</h3>
            {recentJobs.slice(0, 6).map((job) => {
              const id = typeof job.id === "string" ? job.id : "";
              if (!id) return null;
              const articleScan = job.kind === "article" ? decodeArticleTranslationResumeCursor(job.resumeCursor) : null;
              const scanCanResume = articleScan === null || (articleScan.kind === "scan" && !articleScan.state.exhausted &&
                job.status !== "cancelled" && job.status !== "cancelling" && job.status !== "reviewing");
              return (
                <form className="status-list" action={resumeTranslationJobAction} key={id}>
                  <input type="hidden" name="job_id" value={id} />
                  <div>
                    <span>{translationKindLabels[String(job.kind)] || "Перевод"} · {String(job.status || "unknown")}</span>
                    <strong>{job.kind === "article" ? "Технически выполнено" : "Переведено"} {String(job.succeededItems)} из {String(job.totalItems)} просмотренных</strong>
                  </div>
                  {articleScan && !scanCanResume && <p>{translationErrorMessage(job.status === "reviewing" ? "translation_retry_pending" : job.status === "cancelled" || job.status === "cancelling"
                    ? "translation_operation_stopped" : articleScan.kind === "scan"
                    ? "translation_scan_complete" : "translation_resume_stale")}</p>}
                  <button className="button-secondary" type="submit" disabled={operationsReady !== true || !supportsJobResumeId(id) || !scanCanResume || !resumeReadyByKind[job.kind as keyof typeof resumeReadyByKind]} title={supportsJobResumeId(id) ? undefined : "Это задание нельзя продолжить из текущего интерфейса."}>{job.kind === "article" ? "Продолжить оставшихся кандидатов" : "Продолжить со следующего курсора"}</button>
                  {job.kind === "article" && <a href={retrySelectionHref(query, { retryJob: id })}>Выбрать неудавшийся элемент</a>}
                </form>
              );
            })}
          </div>
        )}
      </section>

      {retrySelection && (
        <section className="panel settings-stack" style={{ marginTop: 18 }}>
          <span className="eyebrow">Адресный повтор статьи</span>
          <h2>Повторить один неудавшийся элемент</h2>
          <p>Выберите отдельный элемент завершённого пакета. Остальные кандидаты и позиция обхода сохраняются.
            Новый EN сохраняется в приватный рабочий черновик; редакторская проверка требуется отдельно.</p>
          {retrySelection.items.status === "failed" ? (
            <LoadNotice label="Неудавшиеся элементы" issue={retrySelection.items.issue} retryHref={retryHref} />
          ) : retrySelection.items.data.length === 0 ? (
            <p>В выбранном пакете нет элементов в этом списке ошибок.</p>
          ) : (
            <div className="settings-stack">
              <p>Показаны элементы с ошибкой или неподтверждённым повтором из выбранного пакета, до 500 элементов.</p>
              {retrySelection.items.data.map(item => (
                <div className="status-list" key={item.id}>
                  <div><span>Элемент {item.position + 1}</span><strong>Попыток: {item.attempt_count}</strong></div>
                  <p>{item.status === "reviewing" ? translationErrorMessage("translation_retry_pending")
                    : item.last_error_code ? translationErrorMessage(item.last_error_code) : "Требует проверки."}</p>
                  <a href={retrySelectionHref(query, { retryJob: item.job_id, retryItem: item.id })}>Проверить возможность повтора</a>
                </div>
              ))}
            </div>
          )}
          {retrySelection.receipt?.status === "failed" && (
            <p className="notice" role="status">{translationErrorMessage(retrySelection.receipt.errorCode)}{" "}
              <a href={retryHref}>Проверить квитанцию</a></p>
          )}
          {retryReceipt && (
            <div className="settings-stack">
              <a href={`${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/articles/${retryReceipt.articleId}`}>Открыть статью и версии RU/EN</a>
              {retryReceipt.phase === "blocked" && retryReceipt.blockReason && (
                <p className="notice" role="status">{retryBlockMessages[retryReceipt.blockReason]}</p>
              )}
              {retryReceipt.phase === "running" && (
                <p className="notice" role="status">{translationErrorMessage("translation_retry_pending")}{" "}
                  <a href={retrySelectionHref(query, { retryJob: retryReceipt.jobId, retryItem: retryReceipt.itemId,
                    retryOperation: retryReceipt.operationId || query.retryOperation })}>Проверить квитанцию</a></p>
              )}
              {retryReceipt.phase === "finished" && retryReceipt.result && (
                <p className="notice" role="status">{retryReceipt.result.persistence === "working-draft"
                  ? `EN сохранён в рабочий черновик версии ${retryReceipt.result.workingDraftVersion}. Опубликованные RU/EN сохранены. Человеческая проверка ещё не выполнена.`
                  : retryReceipt.result.outcome === "cancelled" ? "Повтор остановлен. Опубликованные версии сохранены."
                  : "Попытка записана в журнал. Состояние рабочего черновика проверяется отдельно."}</p>
              )}
              {retrySelection.candidate?.status === "failed" && (
                <p className="notice" role="status">Кандидат перевода: {translationErrorMessage(retrySelection.candidate.errorCode)}
                  {" "}<a href={retryHref}>Проверить сохранённый кандидат</a></p>
              )}
              {retryCandidate && (
                <div className="settings-stack">
                  {retryCandidate.candidateState === "staged" && retryCandidate.blockReason === null && (
                    <p className="notice" role="status">Проверенный машинный EN сохранён в приватный рабочий черновик
                      версии {retryCandidate.workingDraftVersion}. Учёт этой попытки ещё не завершён.
                      Редакторская проверка и публикация выполняются отдельно.</p>
                  )}
                  {retryCandidate.candidateState === "finished" && retryCandidate.blockReason === null && (
                    <p>Сохранённый кандидат версии {retryCandidate.workingDraftVersion} связан с квитанцией этой попытки.</p>
                  )}
                  {retryCandidate.blockReason && <p className="notice" role="status">{candidateBlockMessages[retryCandidate.blockReason]}</p>}
                  {recoverArticleTranslationItemCandidateAction && retryCandidate.candidateHash && (
                    <form action={recoverArticleTranslationItemCandidateAction}>
                      <p>{finalizeChangedCandidate
                        ? "Завершается учёт исходной попытки с изменённым источником или английской версией. Сохранённые тексты остаются доступными редактору."
                        : "Завершается исходная попытка по сохранённому кандидату. Провайдер повторно не вызывается."}</p>
                      <input type="hidden" name="job_id" value={retryCandidate.jobId} />
                      <input type="hidden" name="item_id" value={retryCandidate.itemId} />
                      <input type="hidden" name="operation_id" value={retryCandidate.operationId} />
                      <input type="hidden" name="candidate_hash" value={retryCandidate.candidateHash} />
                      <TranslationSubmitButton pendingLabel="Проверяю сохранённый результат...">{finalizeChangedCandidate
                        ? "Завершить учёт изменившейся попытки" : "Завершить учёт сохранённого перевода"}</TranslationSubmitButton>
                    </form>
                  )}
                </div>
              )}
              {retrySelection.progress?.status === "failed" && (
                <p className="notice" role="status">Журнал запросов: {translationErrorMessage(retrySelection.progress.errorCode)}
                  {" "}<a href={retryHref}>Повторить чтение журнала</a></p>
              )}
              {retrySelection.progress?.status === "success" && (
                <div className="settings-stack">
                  <p>Допусков запросов: {retrySelection.progress.data.providerCalls} из 4.
                    {" "}Запись допуска не подтверждает, что провайдер принял запрос.</p>
                  {retrySelection.progress.data.startedAt && <p>Начало попытки: {formatDate(retrySelection.progress.data.startedAt)}</p>}
                  {retrySelection.progress.data.calls.length === 0 && <p>В журнале нет записей запросов этой попытки.
                    {" "}Отсутствие записи само по себе не разрешает новый перевод.</p>}
                  {retrySelection.progress.data.calls.map((call, index) => (
                    <div key={call.callId}>
                      <strong>{index + 1}. {call.pass === "translation" ? "Перевод" : call.pass === "review" ? "Машинная сверка" : "Исправление формата"}: {call.model}</strong>
                      <p>{call.responseReceivedAt === null ? "Результат запроса не подтверждён."
                        : "Получение ответа записано. Проверка текста и его сохранение подтверждаются отдельно."}</p>
                      {call.requestId && <p>ID запроса: {call.requestId}</p>}
                      {call.responseId && <p>ID ответа: {call.responseId}</p>}
                    </div>
                  ))}
                </div>
              )}
              {retryReceipt.phase === "ready" && retryOperationId && (
                <form action={retryArticleTranslationItemAction}>
                  <p>Чтение квитанции само перевод не запускает. Отправка формы повторит только выбранный элемент.</p>
                  <input type="hidden" name="job_id" value={retryReceipt.jobId} />
                  <input type="hidden" name="item_id" value={retryReceipt.itemId} />
                  <input type="hidden" name="operation_id" value={retryOperationId} />
                  <input type="hidden" name="expected_job_version" value={retryReceipt.jobVersion} />
                  <input type="hidden" name="expected_attempt_count" value={retryReceipt.attemptCount} />
                  <input type="hidden" name="source_hash" value={retryReceipt.sourceHash || ""} />
                  <TranslationSubmitButton disabled={!canRetryItem} pendingLabel="Проверяю и перевожу...">Повторить только этот элемент</TranslationSubmitButton>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      <section className="panel" style={{ marginTop: 18 }}>
        <span className="eyebrow">Runtime self-test</span>
        <h2>Реальная проверка провайдера</h2>
        <div className="status-list">
          <div><span>CONFIGURED</span><strong>{runtimeReadiness.configured ? "ДА" : "НЕТ"}</strong></div>
          <div><span>BINDING FOUND</span><strong>{runtimeReadiness.bindingFound ? "ДА" : "НЕТ"}</strong></div>
          <div><span>TEST PASSED</span><strong>{probeRead.status === "failed" ? "Недоступно" : translationReady ? "ДА" : probeStatus === "pending" ? "ВЫПОЛНЯЕТСЯ" : probeStatus === "failed" ? "НЕТ" : "НУЖНА ПРОВЕРКА"}</strong></div>
          <div><span>LAST TEST</span><strong>{probeRead.status === "failed" ? "Недоступно" : typeof providerProbe.last_test_at === "string" ? formatDate(providerProbe.last_test_at, true) : "-"}</strong></div>
          <div><span>LATENCY</span><strong>{probeRead.status === "failed" ? "Недоступно" : typeof providerProbe.latency_ms === "number" ? `${providerProbe.latency_ms} мс` : "-"}</strong></div>
          <div><span>LAST ERROR</span><strong>{probeRead.status === "failed" ? "Недоступно" : translationErrorMessage(providerProbe.last_error_code) || "-"}</strong></div>
        </div>
        <p>
          Self-test делает короткие запросы к обеим выбранным моделям, проверяет binding,
          JSON Schema и задержку. Ответ и секреты не сохраняются; повторный запуск ограничен
          серверной паузой в пять минут. После смены моделей или режима перевода нужна новая проверка.
        </p>
        <form action={runPremiumTranslationSelfTestAction}>
          <button className="button-secondary" type="submit" disabled={operationsReady !== true || operationsRead.status === "failed" || probeRead.status === "failed" || identityResult.status === "rejected" || !runtimeReadiness.configured || !runtimeReadiness.bindingFound || selfTestBusy}>
            Выполнить self-test
          </button>
        </form>
      </section>

      <section className="stats-grid" style={{ marginTop: 18 }}>
        <article className="stat-card">
          <span>Опубликованные статьи</span>
          <strong>{displayCount(articleCountRead.status === "success" ? articleCountRead.data : null)}</strong>
          <small>EN published: {displayCount(articleEnglishCountRead.status === "success" ? articleEnglishCountRead.data : null)}</small>
        </article>
        <article className="stat-card">
          <span>Книжные RU-карточки</span>
          <strong>{displayCount(workRussianCountRead.status === "success" ? workRussianCountRead.data : null)}</strong>
          <small>EN reviewed/verified: {displayCount(workEnglishCountRead.status === "success" ? workEnglishCountRead.data : null)}</small>
        </article>
        <article className="stat-card">
          <span>Биографии с lawful RU</span>
          <strong>{displayCount(eligibleWriters)}</strong>
          <small>кандидатов на безопасный EN</small>
        </article>
        <article className="stat-card">
          <span>Страны с содержательным профилем</span>
          <strong>{displayCount(eligibleCountries)}</strong>
          <small>готовы к premium EN</small>
        </article>
        <article className="stat-card">
          <span>CMS-тексты</span>
          <strong>{displayCount(siteCopy ? Object.keys(siteCopy.ru).length : null)}</strong>
          <small>машинных EN: {displayCount(siteCopyRead.status === "success" ? Object.keys(machineCopy).length : null)}</small>
        </article>
      </section>

      <section className="dashboard-grid" style={{ marginTop: 18 }}>
        <form className="panel settings-stack" action={translatePremiumArticleBatchAction}>
          <BackfillCursorFields query={query} articleScan />
          <span className="eyebrow">Статьи</span>
          <h2>Догнать опубликованный архив</h2>
          <p>
            За один запуск обрабатываются не более двух устаревших/отсутствующих EN.
            Новый EN сохраняется в приватный рабочий черновик. Машинная сверка
            не заменяет человеческую проверку; публикация выполняется отдельно.
            Опубликованные RU/EN сохраняются.
            Каждый пакет сохраняет фиксированное окно до 500 кандидатов и позицию в нём.
            Новые публикации позади просмотренной позиции или за верхней границей,
            а также изменения уже просмотренных статей проверяются новым обходом.
            Продолжение не повторяет неудавшиеся элементы.
          </p>
          <a href={`${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/articles`}>Открыть статьи и рабочие черновики для редакторской проверки</a>
          {query.articleJob !== undefined && <TranslationSubmitButton disabled={!articleReady || !canContinueArticleScan}>
            Продолжить оставшихся кандидатов
          </TranslationSubmitButton>}
          <button className="button-secondary" type="submit" name="articleScanIntent" value="fresh" disabled={!articleReady}>
            Начать новый обход архива
          </button>
        </form>

        <form className="panel settings-stack" action={translatePremiumLibraryBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Библиотека «Проба Пера»</span>
          <h2>Премиальный EN книг</h2>
          <p>
            До четырёх проверенных RU-карточек за запуск. Ручной EN имеет абсолютный
            приоритет и не заменяется моделью. Новый машинный EN сохраняется отдельно
            и ждёт проверки редактора в карточке книги; прежний EN остаётся на месте.
            Перевод модели не запускает публикацию. Позиция обхода сохраняется
            между пакетами, поэтому архив постепенно проходит целиком.
          </p>
          <TranslationSubmitButton disabled={!libraryReady}>
            Перевести следующий пакет книг
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumWriterBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Писатели</span>
          <h2>Премиальный EN биографий</h2>
          <p>
            Переводятся только проверенные редакционные RU-оригиналы с provenance.
            По три новых биографии за запуск; следующий пакет продолжает с места,
            на котором закончился предыдущий.
          </p>
          <TranslationSubmitButton disabled={!writerReady}>
            Перевести следующий пакет биографий
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumCountryBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Страны</span>
          <h2>Премиальный EN профилей стран</h2>
          <p>
            История, описание, литературные периоды, движения, факты и места переводятся
            по две страны за запуск. Курсор переносится между пакетами; коды, координаты,
            годы и числовые показатели не меняются.
            Новый машинный EN ждёт отдельного подтверждения в карточке страны;
            прежний EN сохраняется, публикация автоматически не запускается.
          </p>
          <TranslationSubmitButton disabled={!countryReady}>
            Перевести следующий пакет стран
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumSiteCopyBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Интерфейс</span>
          <h2>Догнать CMS site-copy</h2>
          <p>
            До 50 русских CMS-переопределений за один двухпроходный запрос.
            Существующий ручной английский не меняется.
          </p>
          <TranslationSubmitButton disabled={!siteCopyReady}>
            Перевести site-copy
          </TranslationSubmitButton>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Правила качества</h2>
        <p>
          Переводчик не имеет права менять URL, ISBN, даты, идентификаторы, координаты
          и защищённую HTML-структуру. Для статей после модели выполняются обычные
          release-checks; книги, биографии и страны проходят структурные ограничения,
          provenance/source-hash проверки и отсутствие случайной кириллицы. При конфликте
          версии результат не записывается.
        </p>
      </section>
    </>
  );
}
