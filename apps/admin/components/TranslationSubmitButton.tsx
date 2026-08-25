"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function TranslationSubmitButton({
  children,
  disabled = false,
  pendingLabel = "Перевожу…",
}: {
  children: ReactNode;
  disabled?: boolean;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="button"
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
