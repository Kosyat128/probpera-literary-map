import type { CSSProperties } from "react";
import type { BookShelfSpineHit } from "../books/bookShelfPointer";

export default function BookShelfSpineTooltip({ book, hit, index, total, locale }: {
  book: { title: string; writer: string; year?: number };
  hit: BookShelfSpineHit | null;
  index: number;
  total: number;
  locale: "ru" | "en";
}) {
  const style = hit ? {
    "--spine-tooltip-x": `${hit.x}px`,
    "--spine-tooltip-y": `${Math.max(8, hit.y - hit.height / 2 - 12)}px`,
  } as CSSProperties : undefined;
  return (
    <div id="book-spine-tooltip" role="tooltip" className="book-spine-tooltip"
      data-position={hit ? "spine" : "keyboard"} style={style}>
      <strong>{book.title}</strong>
      <span>{book.writer}{book.year ? ` · ${book.year}` : ""}</span>
      <small>{locale === "en" ? `${index + 1} of ${total}` : `${index + 1} из ${total}`}</small>
    </div>
  );
}
