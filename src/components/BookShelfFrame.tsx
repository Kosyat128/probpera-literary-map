import type { AriaAttributes, CSSProperties, ReactNode } from "react";

import type { BookShelfViewMode } from "./BookShelfControls";

export type BookShelfLiveRegionConfig = Readonly<{
  /** Overrides the legacy liveMessage content when supplied. */
  message?: ReactNode;
  priority?: "polite" | "assertive";
  atomic?: boolean;
  busy?: boolean;
  relevant?: AriaAttributes["aria-relevant"];
  label?: string;
}>;

type Props = {
  viewMode: BookShelfViewMode;
  children: ReactNode;
  liveMessage: string;
  liveRegion?: BookShelfLiveRegionConfig;
  themeStyle?: CSSProperties;
};

export default function BookShelfFrame({
  viewMode,
  children,
  liveMessage,
  liveRegion,
  themeStyle,
}: Props) {
  const priority = liveRegion?.priority || "polite";
  const announcement = liveRegion?.message ?? liveMessage;
  return (
    <div
      className={`book-shelf-frame is-${viewMode}`}
      data-book-shelf-mode={viewMode}
      style={themeStyle}
    >
      <div className="book-shelf-frame__library-backdrop" aria-hidden="true" />
      <div className="book-shelf-frame__atmosphere" aria-hidden="true" />
      {children}
      <p
        className="book-shelf-frame__live"
        role={priority === "assertive" ? "alert" : "status"}
        aria-live={priority}
        aria-atomic={liveRegion?.atomic ?? true}
        aria-busy={liveRegion?.busy || undefined}
        aria-relevant={liveRegion?.relevant || "additions text"}
        aria-label={liveRegion?.label}
        data-book-shelf-live-region=""
        data-priority={priority}
      >
        {announcement}
      </p>
    </div>
  );
}
