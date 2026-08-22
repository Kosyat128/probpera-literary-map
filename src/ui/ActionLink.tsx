import type { AnchorHTMLAttributes, ReactNode } from "react";

import {
  uiActionClassName,
  type UiActionSize,
  type UiActionSurface,
  type UiActionVariant,
} from "./Button";

type ActionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  endIcon?: ReactNode;
  size?: UiActionSize;
  startIcon?: ReactNode;
  surface?: UiActionSurface;
  variant?: UiActionVariant;
};

export default function ActionLink({
  children,
  className = "",
  endIcon,
  size = "md",
  startIcon,
  surface = "light",
  variant = "secondary",
  ...props
}: ActionLinkProps) {
  return (
    <a
      {...props}
      className={uiActionClassName({ className, size, surface, variant })}
    >
      {startIcon && <span className="ui-action__icon" aria-hidden="true">{startIcon}</span>}
      <span className="ui-action__label">{children}</span>
      {endIcon && <span className="ui-action__icon" aria-hidden="true">{endIcon}</span>}
    </a>
  );
}
