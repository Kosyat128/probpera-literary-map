import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type UiActionSize = "sm" | "md" | "lg";
export type UiActionSurface = "light" | "dark";
export type UiActionVariant = "primary" | "secondary" | "text";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  endIcon?: ReactNode;
  loading?: boolean;
  size?: UiActionSize;
  startIcon?: ReactNode;
  surface?: UiActionSurface;
  variant?: UiActionVariant;
};

export function uiActionClassName({
  className = "",
  loading = false,
  size = "md",
  surface = "light",
  variant = "secondary",
}: {
  className?: string;
  loading?: boolean;
  size?: UiActionSize;
  surface?: UiActionSurface;
  variant?: UiActionVariant;
}) {
  return [
    "ui-action",
    `ui-action--${variant}`,
    `ui-action--${size}`,
    `ui-action--${surface}`,
    loading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  className = "",
  disabled,
  endIcon,
  loading = false,
  size = "md",
  startIcon,
  surface = "light",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps, ref) {
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      className={uiActionClassName({ className, loading, size, surface, variant })}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {loading && <span className="ui-action__spinner" aria-hidden="true" />}
      {startIcon && <span className="ui-action__icon" aria-hidden="true">{startIcon}</span>}
      <span className="ui-action__label">{children}</span>
      {endIcon && <span className="ui-action__icon" aria-hidden="true">{endIcon}</span>}
    </button>
  );
});

export default Button;
