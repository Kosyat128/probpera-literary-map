"use client";

import { unstable_rethrow } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { parsePageCreateResult } from "@/lib/page-create-result";

/** DRAFT: known pre-insert refusal stays in this original uncontrolled form.
 * Successful native redirects still propagate; unknown results grant no retry.
 */
export default function CreatePageForm({ action, children }: {
  action: (formData: FormData) => Promise<unknown>;
  children: ReactNode;
}) {
  const busyRef = useRef(false);
  const blockedRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    try {
      const result = parsePageCreateResult(await action(formData));
      if (result) {
        setMessage(result.message);
      } else {
        blockedRef.current = true; setBlocked(true);
        setMessage("Результат создания не подтверждён. Текст оставлен в форме. Проверьте список страниц перед новой отправкой.");
      }
    } catch (error) {
      unstable_rethrow(error);
      blockedRef.current = true; setBlocked(true);
      setMessage("Результат создания не подтверждён. Текст оставлен в форме. Проверьте список страниц перед новой отправкой.");
    } finally {
      busyRef.current = false; setPending(false);
    }
  }
  return <form className="panel settings-stack" action={submit}
    onReset={event => event.preventDefault()}
    onSubmit={event => {
      if (busyRef.current || blockedRef.current) { event.preventDefault(); return; }
      busyRef.current = true; setPending(true); setMessage("");
    }}>
    {children}
    <button className="button" type="submit" disabled={pending || blocked}>
      {pending ? "Создание черновика..." : "Создать черновик"}
    </button>
    {message && <p role="alert">{message}</p>}
  </form>;
}
