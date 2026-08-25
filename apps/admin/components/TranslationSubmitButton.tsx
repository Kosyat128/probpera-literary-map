"use client";

import { useFormStatus } from "react-dom";

export default function TranslationSubmitButton({
  children,
  disabled = false,
  pendingLabel = "Перевожу…",
}: {
  children: React.ReactNode;
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
