import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import {
  publicationRetryInputSchema, publicationRetryReceiptSchema, publicationRetryTimestampEqual,
  type PublicationRetryInput, type PublicationRetryReceipt,
} from "./publication-retry-contract";

export async function admitPublicationRetry(client: SupabaseClient,
  input: PublicationRetryInput, currentStaffActorId: string): Promise<PublicationRetryReceipt> {
  const requested = publicationRetryInputSchema.parse(input);
  const actorId = publicationRetryInputSchema.shape.operationId.parse(currentStaffActorId); // From fresh requireStaff, never FormData.
  const response = await client.rpc("admit_public_build_retry", {
    p_outbox_id: requested.outboxId,
    p_retry_operation_id: requested.operationId,
    p_expected_updated_at: requested.expectedUpdatedAt,
  });
  unstable_rethrow(response?.error);
  if (!response || response.error) throw new Error("Retry admission is unconfirmed");
  const receipt = publicationRetryReceiptSchema.parse(response.data);
  if (receipt.requested.outboxId !== requested.outboxId || receipt.requested.operationId !== requested.operationId
    || receipt.requested.expectedUpdatedAt !== requested.expectedUpdatedAt || receipt.source.outboxId !== requested.outboxId) {
    throw new Error("Retry receipt does not bind the submitted request");
  }
  if (receipt.canDispatch !== (receipt.outcome === "admitted")
    || (receipt.dispatch !== null) !== receipt.canDispatch) throw new Error("Retry grant is inconsistent");
  if (receipt.rootOutboxId !== (receipt.source.retryOfOutboxId ?? receipt.source.outboxId)
    || (receipt.outcome === "root-required") !== (receipt.source.retryOfOutboxId !== null)) {
    throw new Error("Retry root observation is inconsistent");
  }
  if (receipt.observed && ((receipt.observed.retryOfOutboxId !== null) !== (receipt.observed.operationId !== null)
    || (receipt.observed.outboxId === receipt.source.outboxId
      ? receipt.observed.retryOfOutboxId !== receipt.source.retryOfOutboxId
      : receipt.observed.retryOfOutboxId !== receipt.rootOutboxId))) {
    throw new Error("Observed retry does not belong to the requested root");
  }
  if (receipt.outcome === "complete" && receipt.source.status !== "deployed" && receipt.observed?.status !== "deployed") {
    throw new Error("Completion is not a stored observation");
  }
  if (receipt.outcome === "admitted" || receipt.outcome === "replay") {
    if (!receipt.observed || receipt.observed.operationId !== requested.operationId
      || receipt.observed.retryOfOutboxId !== requested.outboxId || receipt.observed.actorId !== actorId
      || receipt.rootOutboxId !== requested.outboxId || receipt.source.retryOfOutboxId !== null) {
      throw new Error("Retry actor/source/operation binding is inconsistent");
    }
    if (receipt.outcome === "admitted" && (receipt.source.status !== "failed" || receipt.observed.status !== "requested")) {
      throw new Error("Fresh retry does not bind an eligible source and new child");
    }
    if (receipt.outcome === "admitted" && !publicationRetryTimestampEqual(receipt.source.updatedAt, requested.expectedUpdatedAt)) {
      throw new Error("Fresh retry source version differs from the submitted precise native timestamp");
    }
  }
  // active/complete observations may contain a DIFFERENT existing operation ID.
  // They are metadata, not a transfer of that operation's one-time grant.
  // Never call generic enqueue_public_build_request or legacy audit fallback here.
  return receipt;
}
