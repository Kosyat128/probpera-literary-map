"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  message: string;
  className?: string;
};

export default function ConfirmSubmitButton({
  children,
  message,
  className = "button-secondary",
}: Props) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
