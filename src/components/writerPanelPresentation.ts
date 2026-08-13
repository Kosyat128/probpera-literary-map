import type { WriterBiographyDisplay } from "../data/writerBiographyDisplay";

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

  const verified = biography.editorialStatus === "verified";
  return {
    code: verified ? "verified" : "reviewed",
    label: verified ? "Подтверждено источниками" : "Проверено редакцией",
    detail: "Источники зафиксированы",
    sourceCount: biography.sources.length,
  };
}
