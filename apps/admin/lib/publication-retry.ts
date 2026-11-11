import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import { triggerPublicBuild } from "./public-build";
import { publicationRetryInputSchema, type PublicationRetryActionResult, type PublicationRetryInput } from "./publication-retry-contract";
import { admitPublicationRetry } from "./publication-retry-rpc";

/** A retry never enters the ordinary enqueue/legacy compatibility path. */
export async function requestPublicationRetry(input: {
  supabase: SupabaseClient; actorId: string; request: PublicationRetryInput;
}): Promise<PublicationRetryActionResult> {
  const parsed = publicationRetryInputSchema.safeParse(input.request);
  if (!parsed.success) return { state: "invalid", message: "Намерение повтора не определено. Обновите очередь." };
  let receipt;
  try { receipt = await admitPublicationRetry(input.supabase, parsed.data, input.actorId); }
  catch (error) {
    unstable_rethrow(error);
    return { state: "unconfirmed", message: "Регистрация повтора не подтверждена. Проверьте это же намерение; новый запуск не отправлен." };
  }
  if (receipt.outcome !== "admitted") return {
    state: "observed", operationId: receipt.requested.operationId, rootOutboxId: receipt.rootOutboxId,
    outcome: receipt.outcome, observed: receipt.observed,
    message: receipt.outcome === "complete" ? "В очереди уже есть подтверждённое завершение. Новый запуск не отправлен."
      : receipt.outcome === "stale" ? "Состояние исходного запроса изменилось. Обновите очередь перед новым действием."
      : receipt.outcome === "root-required" ? `Это запись повтора. Используйте исходный запрос №${receipt.rootOutboxId}; новый запуск не отправлен.`
      : "Это намерение или предыдущий повтор уже зарегистрировано. Повторный запуск не отправлен.",
  };
  // The strict adapter allows only a fresh, child-bound one-time grant here.
  const operationId = receipt.requested.operationId, outboxId = receipt.observed!.outboxId;
  let build;
  try { build = await triggerPublicBuild(receipt.dispatch!.reason); }
  catch (error) {
    unstable_rethrow(error);
    return { state: "queued", operationId, outboxId, externalStart: "unconfirmed",
      message: "Запрос повтора сохранён. Внешний запуск не подтверждён; проверьте это же намерение без нового запуска." };
  }
  if (!build.ok) return { state: "queued", operationId, outboxId, externalStart: "unconfirmed",
    message: "Запрос повтора сохранён, внешний запуск не подтверждён. Проверьте это же намерение без нового запуска." };
  let confirmed = false;
  try {
    const marked = await input.supabase.rpc("mark_public_build_dispatched", { p_outbox_id: outboxId, p_provider: build.provider });
    unstable_rethrow(marked?.error);
    confirmed = Boolean(marked && !marked.error && marked.data === true);
  } catch (error) { unstable_rethrow(error); }
  // A lost/false/malformed mark cannot erase known external acceptance or cause
  // another trigger. The required admission audit committed in the native RPC.
  return { state: "started", operationId, outboxId, dispatchPersistence: confirmed ? "confirmed" : "unconfirmed",
    message: confirmed ? "Провайдер принял запуск, отметка в очереди сохранена. Публичная версия проверяется отдельно."
      : "Провайдер принял запуск, но отметка в очереди не подтверждена. Не отправляйте новый запуск; проверьте это же намерение." };
}
