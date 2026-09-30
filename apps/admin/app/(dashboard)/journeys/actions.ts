"use server";

import { requireStaff } from "../../../lib/auth";
import {
  validateBookyJourneyDraftActivity, evaluateBookyJourneyDraftActivity,
  type JourneyDraftActivityValidationResult, type JourneyDraftActivityEvaluationResult,
} from "../../../lib/booky-journey-activity-validation";

/** Validate current draft data only. All content stays in the existing public
 * source owners; this action neither writes data nor produces review receipts. */
export async function validateBookyJourneyDraftActivityAction(serializedDraft: string): Promise<JourneyDraftActivityValidationResult> {
  const rejected = (field: string, message: string): JourneyDraftActivityValidationResult =>
    Object.freeze({ ok: false as const, errors: Object.freeze([Object.freeze({ field, message })]) });
  try {
    const session = await requireStaff();
    if (!session?.user || session.mfa.checkError)
      return rejected("activity.auth", "Не удалось подтвердить сессию редактора. Форма сохранена; проверку можно повторить.");
    // Load current canonical/public views only after the staff/MFA guard.
    const { getBookyJourneyDraftCatalog } = await import("../../../lib/booky-journey-catalog");
    const { countries, bookArchiveCountries } = await import("../../../../../src/data/countries/index");
    const { buildPublicBookArchive } = await import("../../../../../src/data/bookArchive");
    const catalog = getBookyJourneyDraftCatalog();
    const publicBooks = buildPublicBookArchive(bookArchiveCountries);
    return validateBookyJourneyDraftActivity(serializedDraft, catalog, { publicCountries: countries, publicBooks });
  } catch {
    return rejected("activity", "Серверная проверка задания недоступна. Форма сохранена; повторите действие.");
  }
}

/** Temporary answer preview against freshly authorized static public data.
 * No selected answer or verdict is written to any content/progress store. */
export async function evaluateBookyJourneyDraftActivityAction(serializedDraft: string, choiceId: string): Promise<JourneyDraftActivityEvaluationResult> {
  const rejected = (field: string, message: string): JourneyDraftActivityEvaluationResult =>
    Object.freeze({ ok: false as const, errors: Object.freeze([Object.freeze({ field, message })]) });
  try {
    const session = await requireStaff();
    if (!session?.user || session.mfa.checkError)
      return rejected("activity.auth", "Не удалось подтвердить сессию редактора. Выбранный ответ не проверен; повторите действие.");
    const { getBookyJourneyDraftCatalog } = await import("../../../lib/booky-journey-catalog");
    const { countries, bookArchiveCountries } = await import("../../../../../src/data/countries/index");
    const { buildPublicBookArchive } = await import("../../../../../src/data/bookArchive");
    const catalog = getBookyJourneyDraftCatalog();
    const publicBooks = buildPublicBookArchive(bookArchiveCountries);
    return evaluateBookyJourneyDraftActivity(serializedDraft, choiceId, catalog, { publicCountries: countries, publicBooks });
  } catch {
    return rejected("activity", "Серверная проверка ответа недоступна. Выбранный ответ не проверен; повторите действие.");
  }
}
