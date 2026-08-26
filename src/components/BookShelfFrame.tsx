import type { CSSProperties, ReactNode } from "react";

import type { BookShelfViewMode } from "./BookShelfControls";

type Props = {
  viewMode: BookShelfViewMode;
  children: ReactNode;
  liveMessage: string;
  themeStyle?: CSSProperties;
};

export default function BookShelfFrame({
  viewMode,
  children,
  liveMessage,
  themeStyle,
}: Props) {
  return (
    <div
      className={`book-shelf-frame is-${viewMode}`}
      data-book-shelf-mode={viewMode}
      style={themeStyle}
    >
      <div className="book-shelf-frame__library-backdrop" aria-hidden="true" />
      <div className="book-shelf-frame__atmosphere" aria-hidden="true" />
      {children}
      <p className="book-shelf-frame__live" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
    </div>
  );
}
