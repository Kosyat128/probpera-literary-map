import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import type { UiActionSize, UiActionSurface } from "./Button";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  "aria-label": string;
  icon: ReactNode;
  loading?: boolean;
  size?: UiActionSize;
  surface?: UiActionSurface;
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  "aria-label": ariaLabel,
  className = "",
  disabled,
  icon,
  loading = false,
  size = "md",
  surface = "light",
  type = "button",
  ...props
}: IconButtonProps, ref) {
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      className={[
        "ui-icon-button",
        `ui-icon-button--${size}`,
        `ui-icon-button--${surface}`,
        loading ? "is-loading" : "",
        className,
      ].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {loading && <span className="ui-action__spinner" aria-hidden="true" />}
      <span className="ui-action__icon" aria-hidden="true">{icon}</span>
    </button>
  );
});

export default IconButton;
