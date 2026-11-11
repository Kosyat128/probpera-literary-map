"use client";

// Next's installed React runtime supplies this hook; the shared public app keeps
// React18 types, whose existing canary declarations expose the same signature.
import type {} from "react/canary";
import { useActionState, useState } from "react";

import type { PublicationRetryActionResult, PublicationRetryInput } from "@/lib/publication-retry-contract";

export default function PublicationRetryForm({ request, action, catalog }: {
  request: PublicationRetryInput;
  action: (data: FormData) => Promise<PublicationRetryActionResult>;
  catalog: { term: string; status: string; page: number };
}) {
  // Preserve the server-rendered UUID and raw version through result renders
  // and unrelated parent refreshes. A changed source version remounts this form.
  const [intent] = useState(() => request);
  const [result, formAction, pending] = useActionState(
    (_previous: PublicationRetryActionResult, data: FormData) => action(data),
    { state: "ready" } as PublicationRetryActionResult,
  );
  return <form action={formAction}>
    <input type="hidden" name="outbox_id" value={intent.outboxId} />
    <input type="hidden" name="retry_operation_id" value={intent.operationId} />
    <input type="hidden" name="expected_updated_at" value={intent.expectedUpdatedAt} />
    <input type="hidden" name="catalog_q" value={catalog.term} />
    <input type="hidden" name="catalog_status" value={catalog.status} />
    <input type="hidden" name="catalog_page" value={catalog.page} />
    <button className="button-secondary" type="submit" disabled={pending}>
      {pending ? "Проверяем запрос…" : result.state === "ready" ? "Повторить" : "Проверить это намерение"}
    </button>
    {result.state !== "ready" && <p className="form-message" role="status">{result.message}</p>}
  </form>;
}
