import type { WriterBiographyDisplay } from "../data/writerBiographyDisplay";

export const WRITER_DETAIL_VIEWS = [
  "biography",
  "works",
  "sources",
] as const;

export type WriterDetailView = (typeof WRITER_DETAIL_VIEWS)[number];

export type WriterBiographyPublicStatus = {
  code: "verified" | "reviewed" | "archive" | "pending";
  label: string;
  detail: string;
  sourceCount: number;
};

export function writerBiographyPublicStatus(
  biography: WriterBiographyDisplay | null
): WriterBiographyPublicStatus {
  if (!biography) {
    return {
      code: "pending",
      label: "В редакционной очереди",
      detail: "Проверенная биография готовится",
      sourceCount: 0,
    };
  }

  if (biography.kind === "legacy-unverified") {
    return {
      code: "archive",
      label: "Архивная справка · не проверена",
      detail: "Источники ещё не зафиксированы",
      sourceCount: 0,
    };
  }

  const sourceCount = biography.sources.length;
  const verified =
    biography.editorialStatus === "verified" && sourceCount > 0;
  return {
    code: verified ? "verified" : "reviewed",
    label: verified ? "Подтверждено источниками" : "Проверено редакцией",
    detail:
      sourceCount > 0
        ? "Источники зафиксированы"
        : "Источники ещё не зафиксированы",
    sourceCount,
  };
}

export function writerDetailViewForKey(
  current: WriterDetailView,
  key: string
): WriterDetailView | null {
  if (key === "Home") return WRITER_DETAIL_VIEWS[0];
  if (key === "End") return WRITER_DETAIL_VIEWS[WRITER_DETAIL_VIEWS.length - 1];
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;

  const direction = key === "ArrowRight" ? 1 : -1;
  const currentIndex = WRITER_DETAIL_VIEWS.indexOf(current);
  const nextIndex =
    (currentIndex + direction + WRITER_DETAIL_VIEWS.length) %
    WRITER_DETAIL_VIEWS.length;
  return WRITER_DETAIL_VIEWS[nextIndex];
}
