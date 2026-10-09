"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT,
  decodeArticleTranslationResumeCursor,
  parseArticleTranslationScanState,
  type ArticleTranslationScanState,
} from "@/lib/article-translation-scan";
import { ensurePublishedArticlePremiumEnglish } from "@/lib/auto-translate-published-article-premium";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { translationBackfillCursorParams } from "@/lib/translation-backfill-cursor";
import { translationErrorCode } from "@/lib/translation-errors";
import { createTranslationOperationBudget } from "@/lib/translation-operation-budget";
import { premiumTranslationRuntimeGate } from "@/lib/translation-runtime-gate";
import { premiumTranslationRuntimeMetadata } from "@/lib/premium-translation-runtime";
import { ArticleTranslationOrdinaryRpcError, checkpointArticleTranslationSyncRun, getArticleTranslationItemDomain, getArticleTranslationSyncCompletionCursor,
  type ArticleTranslationObservedItem, type ArticleTranslationSyncRun } from "@/lib/article-translation-ordinary-rpc";
import { completeArticleTranslationScan } from "@/lib/article-translation-scan-completion";
import type { TranslationRunItem } from "@/lib/translation-run-record";
import type { TranslationErrorCode } from "@/lib/translation-errors";

const MAX_ARTICLE_TRANSLATIONS = 2;
const ARTICLE_SCAN_PAGE_SIZE = 100;
const MAX_ARTICLE_SCAN = ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT;
// Existing two item cap, at most translation/repair/review/repair per item.
const MAX_ARTICLE_PROVIDER_CALLS = MAX_ARTICLE_TRANSLATIONS * 4;
// The previous per-pass OpenAI timeout was five minutes; share that ceiling.
const ARTICLE_OPERATION_DEADLINE_MS = 300_000;
const candidateRows = z.array(z.object({ id: z.string().uuid() })).max(MAX_ARTICLE_SCAN);

function translationsUrl(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) {
      params.set(key, String(value));
    }
  }
  return `/translations${params.size ? `?${params}` : ""}`;
}

async function readScan<T>(request: PromiseLike<T>) {
  try {
    return { ok: true, result: await request } as const;
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false } as const;
  }
}

export async function translatePremiumArticleBatchAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const freshIntent = formData.get("articleScanIntent") === "fresh";
  const jobValue = freshIntent ? null : formData.get("articleJob");
  const articleJob = typeof jobValue === "string" ? jobValue.trim() : "";
  const { libraryCursor, writerCursor, countryCursor } = translationBackfillCursorParams(formData);
  const cursorParams = { libraryCursor, writerCursor, countryCursor };
  const returnParams = { ...cursorParams, ...(articleJob ? { articleJob } : {}) };
  if (jobValue !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(articleJob)) {
    redirect(translationsUrl({ ...cursorParams, errorCode: "invalid_input" }));
  }
  const legacyCursor = formData.get("articleCursor");
  if (!freshIntent && !articleJob && legacyCursor !== null && legacyCursor !== "0" && legacyCursor !== "") {
    redirect(translationsUrl({ ...cursorParams, errorCode: "translation_resume_stale" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(translationsUrl({ ...returnParams, errorCode: "database_unavailable" }));
  }
  const operationBudget = createTranslationOperationBudget({
    maxAttempts: MAX_ARTICLE_TRANSLATIONS,
    maxProviderCalls: MAX_ARTICLE_PROVIDER_CALLS,
    deadlineMs: ARTICLE_OPERATION_DEADLINE_MS,
  });
  let scan: ArticleTranslationScanState;
  let persistedArticleCursor: Record<string, unknown> = {};
  let legacyContinuationCursor: Record<string, unknown> | null = null;
  let ordinaryContinuation: ArticleTranslationSyncRun | null = null;
  let durableJobId = articleJob || crypto.randomUUID();
  let durableJobVersion = "0";
  let hasDurableJob = false;
  let chunkItemLimit = MAX_ARTICLE_SCAN;
  if (articleJob) {
    let domain;
    try { domain = await getArticleTranslationItemDomain(supabase, articleJob); }
    catch (error) { unstable_rethrow(error); redirect(translationsUrl({ ...returnParams, errorCode: error instanceof ArticleTranslationOrdinaryRpcError ? error.errorCode : "database_read_failed" })); }
    const receipt = domain.kind === "ordinary" ? domain.run : domain.job;
    if (receipt.status === "cancelled" || receipt.status === "cancelling") {
      redirect(translationsUrl({ ...returnParams, errorCode: "translation_operation_stopped" }));
    }
    if (receipt.status === "reviewing" || receipt.status === "running") {
      redirect(translationsUrl({ ...returnParams, errorCode: "translation_retry_pending" }));
    }
    const cursor = decodeArticleTranslationResumeCursor(receipt.resumeCursor);
    if (cursor.kind !== "scan") {
      redirect(translationsUrl({ ...returnParams, errorCode: "translation_resume_stale" }));
    }
    scan = cursor.state;
    if (domain.kind === "legacy") legacyContinuationCursor = domain.job.resumeCursor;
    else ordinaryContinuation = domain.run;
    if (domain.kind === "ordinary" && domain.run.totalItems < MAX_ARTICLE_SCAN) {
      hasDurableJob = true; durableJobVersion = domain.run.jobVersion; persistedArticleCursor = domain.run.resumeCursor;
      chunkItemLimit = MAX_ARTICLE_SCAN - domain.run.totalItems;
    } else {
      // Explicit Continue anchors a new bounded run to the authoritative saved cursor.
      // The historical or full terminal job and its outcomes remain immutable.
      durableJobId = crypto.randomUUID();
    }
    if (scan.exhausted) {
      redirect(translationsUrl({ ...returnParams, errorCode: "translation_scan_complete" }));
    }
  } else {
    const upperRead = await readScan(supabase.from("articles").select("id")
      .eq("status", "published").is("deleted_at", null)
      .order("id", { ascending: false }).limit(1));
    if (!upperRead.ok) redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
    const upper = upperRead.result;
    unstable_rethrow(upper.error);
    const upperRows = candidateRows.max(1).safeParse(upper.data);
    if (upper.error || !upperRows.success) {
      redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
    }
    if (!upperRows.data.length) {
      redirect(translationsUrl({ ...cursorParams, success: "Опубликованных кандидатов на момент чтения нет. Для новых материалов начните новый обход." }));
    }
    scan = { version: 1, order: "id", upperId: upperRows.data[0].id,
      afterId: null, pendingIds: [], nextIndex: 0, lastWindow: false, exhausted: false };
  }
  if (!(await premiumTranslationRuntimeGate(supabase))) {
    redirect(translationsUrl({ ...returnParams, errorCode: "translation_not_configured" }));
  }

  let translated = 0;
  let current = 0;
  let manual = 0;
  let manualStale = 0;
  let manualUnknown = 0;
  let unknown = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  let confirmedProviderCalls = 0;
  let firstError = "";
  let scanReadFailed = false;
  let firstErrorCode: TranslationErrorCode | undefined;
  let pendingOperation: { jobId: string; itemId: string; operationId: string } | null = null;
  const runItems: TranslationRunItem[] = [];
  const observedItems: ArticleTranslationObservedItem[] = [];

  while (
    translated < MAX_ARTICLE_TRANSLATIONS &&
    !operationBudget.exhaustedReason() &&
    !firstError &&
    runItems.length < chunkItemLimit &&
    !scan.exhausted
  ) {
    if (scan.nextIndex === scan.pendingIds.length && scan.pendingIds.length) {
      scan = { ...scan, afterId: scan.pendingIds.at(-1)!, pendingIds: [], nextIndex: 0,
        exhausted: scan.lastWindow };
    }
    if (scan.exhausted) break;
    if (!scan.pendingIds.length) {
      let selection = supabase.from("articles").select("id", { count: "exact" })
        .eq("status", "published").is("deleted_at", null)
        .order("id", { ascending: true }).lte("id", scan.upperId)
        .limit(MAX_ARTICLE_SCAN);
      if (scan.afterId !== null) selection = selection.gt("id", scan.afterId);
      const windowRead = await readScan(selection);
      if (!windowRead.ok) {
        if (runItems.length) { scanReadFailed = true; break; }
        redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
      }
      const window = windowRead.result;
      unstable_rethrow(window.error);
      const rows = candidateRows.safeParse(window.data);
      const count = window.count;
      if (window.error || !rows.success || typeof count !== "number" ||
        !Number.isSafeInteger(count) || count < 0 || rows.data.length !== Math.min(count, MAX_ARTICLE_SCAN)) {
        if (runItems.length) { scanReadFailed = true; break; }
        redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
      }
      const next = parseArticleTranslationScanState({ ...scan,
        pendingIds: rows.data.map(row => row.id), nextIndex: 0,
        lastWindow: count <= MAX_ARTICLE_SCAN, exhausted: count === 0 });
      if (!next) {
        if (runItems.length) { scanReadFailed = true; break; }
        redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
      }
      scan = next;
      if (scan.exhausted) break;
    }
    // Keep each server-side IN query within the previous 100-ID page budget.
    const articleIds = scan.pendingIds.slice(scan.nextIndex, scan.nextIndex + ARTICLE_SCAN_PAGE_SIZE);
    const eligibleRead = await readScan(supabase.from("articles").select("id")
      .in("id", articleIds.map(id => id.toLowerCase())).eq("status", "published").is("deleted_at", null));
    if (!eligibleRead.ok) {
      if (runItems.length) { scanReadFailed = true; break; }
      redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
    }
    const eligible = eligibleRead.result;
    unstable_rethrow(eligible.error);
    const eligibleRows = candidateRows.safeParse(eligible.data);
    const requestedIds = new Set(articleIds.map(id => id.toLowerCase()));
    if (eligible.error || !eligibleRows.success ||
      eligibleRows.data.some(row => !requestedIds.has(row.id.toLowerCase())) ||
      new Set(eligibleRows.data.map(row => row.id.toLowerCase())).size !== eligibleRows.data.length) {
      if (runItems.length) { scanReadFailed = true; break; }
      redirect(translationsUrl({ ...returnParams, errorCode: "database_read_failed" }));
    }
    const eligibleIds = new Set(eligibleRows.data.map(row => row.id.toLowerCase()));
    for (const articleId of articleIds) {
      if (
        translated >= MAX_ARTICLE_TRANSLATIONS ||
        operationBudget.exhaustedReason() ||
        firstError ||
        runItems.length >= chunkItemLimit
      ) break;
      processed += 1;
      if (!eligibleIds.has(articleId.toLowerCase())) {
        runItems.push({ entityId: articleId, state: "skipped" });
        observedItems.push({ entityId: articleId, state: "skipped" });
        skipped += 1;
        scan = { ...scan, nextIndex: scan.nextIndex + 1 };
        continue;
      }
      const result = await ensurePublishedArticlePremiumEnglish({
        supabase,
        actorId: session.user.id,
        articleId,
        operationBudget,
        ordinaryRun: {
          jobId: durableJobId, expectedJobVersion: durableJobVersion, expectedCursor: persistedArticleCursor,
          resumeCursor: { articleScan: scan.nextIndex + 1 === scan.pendingIds.length
            ? { ...scan, afterId: scan.pendingIds.at(-1)!, pendingIds: [], nextIndex: 0, exhausted: scan.lastWindow }
            : { ...scan, nextIndex: scan.nextIndex + 1 } },
          onReceipt(receipt) {
            hasDurableJob = true; durableJobVersion = receipt.jobVersion;
            persistedArticleCursor = { articleScan: scan.nextIndex + 1 === scan.pendingIds.length
              ? { ...scan, afterId: scan.pendingIds.at(-1)!, pendingIds: [], nextIndex: 0, exhausted: scan.lastWindow }
              : { ...scan, nextIndex: scan.nextIndex + 1 } };
          },
        },
      });
      const operation = result.ordinaryOperation;
      if (operation && operation.receipt?.phase !== "finished") {
        firstError = "Ordinary article translation result was not confirmed";
        firstErrorCode = result.ordinaryErrorCode ?? "translation_retry_unconfirmed";
        if (operation.receipt?.phase === "running" || ["translation_retry_unconfirmed", "translation_retry_pending"].includes(firstErrorCode)) pendingOperation = operation;
        break;
      }
      // The budget includes reservations refused before dispatch; only the
      // validated terminal receipt confirms the operation's provider calls.
      confirmedProviderCalls += operation?.receipt?.result?.providerCalls ?? 0;
      if (!operation && !["current", "manual", "skipped"].includes(result.state)) {
        firstError = result.error || "Translation read was not confirmed";
        firstErrorCode = result.ordinaryErrorCode ?? translationErrorCode(firstError);
        failed += 1;
        break;
      }
      if (!operation) observedItems.push({ entityId: articleId, state: result.state as "current" | "manual" | "skipped", ...(result.sourceHash ? { sourceHash: result.sourceHash } : {}) });
      runItems.push({
        entityId: articleId,
        state: result.state,
        error: result.error,
        model: result.model,
        sourceHash: result.sourceHash,
      });
      scan = { ...scan, nextIndex: scan.nextIndex + 1 };
      if (result.state === "translated") translated += 1;
      else if (result.state === "current") current += 1;
      else if (result.state === "manual") {
        manual += 1;
        if (result.freshness === "stale") manualStale += 1;
        if (result.freshness === "unknown") manualUnknown += 1;
      }
      else if (result.state === "failed") {
        failed += 1;
        firstError = result.error || "";
        firstErrorCode = result.ordinaryErrorCode;
      } else if (result.state === "conflict" || result.state === "stale") failed += 1;
      else {
        skipped += 1;
        if (result.freshness === "unknown") unknown += 1;
        if (result.state === "not-configured") firstError = "translation not configured";
      }
    }

    if (scan.nextIndex === scan.pendingIds.length) {
      scan = { ...scan, afterId: scan.pendingIds.at(-1)!, pendingIds: [], nextIndex: 0,
        exhausted: scan.lastWindow };
    }
  }

  if (pendingOperation) {
    redirect(translationsUrl({ ...cursorParams, articleJob: pendingOperation.jobId, retryJob: pendingOperation.jobId,
      retryItem: pendingOperation.itemId, retryOperation: pendingOperation.operationId, errorCode: "translation_retry_pending" }));
  }
  if (firstErrorCode === "translation_migration_required") {
    redirect(translationsUrl({ ...returnParams, errorCode: firstErrorCode }));
  }
  let nextArticleJob: string | null = hasDurableJob ? durableJobId : null;
  try {
    if (articleJob && (legacyContinuationCursor !== null || ordinaryContinuation !== null) && scan.exhausted && runItems.length === 0) {
      const expectedCursor = ordinaryContinuation !== null
        ? await getArticleTranslationSyncCompletionCursor(supabase, ordinaryContinuation, session.user.id)
        : legacyContinuationCursor;
      const completed = await completeArticleTranslationScan({ supabase, jobId: articleJob, expectedCursor });
      if (completed.outcome !== "confirmed") redirect(translationsUrl({ ...returnParams, errorCode: completed.errorCode }));
      nextArticleJob = completed.jobId;
    } else if (hasDurableJob || observedItems.length) {
      const run = await checkpointArticleTranslationSyncRun(supabase, { jobId: durableJobId, expectedJobVersion: durableJobVersion,
        expectedCursor: persistedArticleCursor, resumeCursor: { articleScan: scan }, observedItems,
        provider: premiumTranslationRuntimeMetadata().provider, actorId: session.user.id });
      nextArticleJob = run.jobId;
    }
  } catch (error) {
    unstable_rethrow(error);
    redirect(translationsUrl({ ...cursorParams, ...(hasDurableJob ? { articleJob: durableJobId } : articleJob ? { articleJob } : {}),
      errorCode: error instanceof ArticleTranslationOrdinaryRpcError ? error.errorCode : "translation_run_record_unconfirmed" }));
  }

  revalidatePath("/translations");
  revalidatePath("/articles");
  const budget = operationBudget.snapshot();
  const stopReason = operationBudget.exhaustedReason();
  const stopMessage = stopReason === "deadline"
    ? " Достигнут лимит времени; новые запросы не запускаются."
    : stopReason ? " Достигнут лимит попыток или запросов; обработан ограниченный пакет."
    : runItems.length >= chunkItemLimit && !scan.exhausted ? " Достигнут лимит элементов задачи; продолжение сохраняет позицию обхода." : "";
  const scanMessage = scan.exhausted
    ? " Кандидаты в пределах верхней границы просмотрены на момент чтения. Новые публикации и изменения уже просмотренных статей требуют нового обхода."
    : " Продолжение обходит оставшихся кандидатов; неудавшиеся элементы повторно не запускаются.";
  redirect(
    translationsUrl({
      ...cursorParams,
      success: `Статьи: EN сохранено в рабочие черновики ${translated}, актуальных ${current}, ручных ${manual} (RU изменён: ${manualStale}, свежесть неизвестна: ${manualUnknown}), пропущено ${skipped} (свежесть неизвестна: ${unknown}), ошибок ${failed}. Человеческая проверка и публикация выполняются отдельно; опубликованные RU/EN сохранены. Просмотрено ${processed}, попыток ${budget.attempts}, запросов провайдера ${confirmedProviderCalls}.${stopMessage}${scanMessage}`,
      errorCode: scanReadFailed ? "database_read_failed" : firstError ? firstErrorCode ?? translationErrorCode(firstError) : null,
      articleJob: nextArticleJob || (scan.exhausted ? null : articleJob),
    })
  );
}
