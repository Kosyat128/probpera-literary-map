import { selectBookText } from "../data/bookLocalization";
import { isPublicBook } from "../data/bookQuality";
import type {
  WorkDistinction,
  WorkLocale,
  WorkProfile,
  WriterProfile,
} from "../data/countries/types";
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

export const WRITER_RECORD_STATUS_ORDER = [
  "verified",
  "reviewed",
  "legacy",
] as const;

export type WriterRecordStatus =
  (typeof WRITER_RECORD_STATUS_ORDER)[number];

export type WriterRecordStatusPresentation = {
  code: WriterRecordStatus;
  label: string;
  detail: string;
};

export type WriterPanelDistinction = {
  id: string;
  kind: "work-distinction";
  label: string;
  organization: string;
  year?: number;
  sourceUrl: string;
  sourceCount: number;
  status: Exclude<WriterRecordStatus, "legacy">;
  workTitle: string;
};

export type WriterPanelWork = {
  id: string;
  title: string;
  status: Exclude<WriterRecordStatus, "legacy">;
  sourceCount: number;
  sourceUrl?: string;
  distinctions: WriterPanelDistinction[];
};

export type WriterPanelAward =
  | WriterPanelDistinction
  | {
      id: string;
      kind: "writer-award";
      label: string;
      sourceCount: number;
      sourceUrl?: string;
      status: WriterRecordStatus;
    };

export type WriterRecordGroup<T> = {
  status: WriterRecordStatus;
  records: T[];
};

const recordStatusStrength: Record<WriterRecordStatus, number> = {
  legacy: 0,
  reviewed: 1,
  verified: 2,
};

function normalizedRecordLabel(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[«»“”„'".,:;!?()[\]{}]/gu, "")
    .replace(/\s+/gu, " ");
}

function uniqueUrls(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

function publicWorkStatus(
  work: WorkProfile,
  locale: WorkLocale
): Exclude<WriterRecordStatus, "legacy"> {
  return work.editorial?.status === "verified" &&
    work.translations?.[locale]?.status === "verified"
    ? "verified"
    : "reviewed";
}

function distinctionId(
  work: WorkProfile,
  distinction: WorkDistinction,
  index: number
) {
  return [
    "distinction",
    work.id,
    normalizedRecordLabel(distinction.label) || index,
    distinction.year || "",
  ].join(":");
}

function presentWorkDistinction(
  work: WorkProfile,
  workTitle: string,
  status: Exclude<WriterRecordStatus, "legacy">,
  distinction: WorkDistinction,
  index: number
): WriterPanelDistinction {
  return {
    id: distinctionId(work, distinction, index),
    kind: "work-distinction",
    label: distinction.label.trim(),
    organization: distinction.organization.trim(),
    year: distinction.year,
    sourceUrl: distinction.sourceUrl.trim(),
    sourceCount: distinction.sourceUrl.trim() ? 1 : 0,
    status,
    workTitle,
  };
}

/**
 * Visitor-facing works are derived only from the existing publication gate.
 * Legacy `writer.works` titles intentionally remain outside this selector.
 */
export function writerWorksForPanel(
  writer: WriterProfile,
  locale: WorkLocale
): WriterPanelWork[] {
  const byTitle = new Map<string, WriterPanelWork>();

  for (const work of writer.workDetails || []) {
    if (!isPublicBook(work)) continue;
    const title = selectBookText(work, locale).title.trim();
    const normalizedTitle = normalizedRecordLabel(title);
    if (!normalizedTitle) continue;

    const status = publicWorkStatus(work, locale);
    const sourceUrls = uniqueUrls([
      ...(work.sources || []).map((source) => source.url),
      work.sourceUrl,
    ]);
    const distinctions = (work.distinctions || [])
      .filter((distinction) => Boolean(distinction.label.trim()))
      .map((distinction, index) =>
        presentWorkDistinction(work, title, status, distinction, index)
      );
    const presented: WriterPanelWork = {
      id: work.id,
      title,
      status,
      sourceCount: sourceUrls.length,
      sourceUrl: sourceUrls[0],
      distinctions,
    };
    const existing = byTitle.get(normalizedTitle);
    if (!existing) {
      byTitle.set(normalizedTitle, presented);
      continue;
    }

    const strongest =
      recordStatusStrength[presented.status] >
      recordStatusStrength[existing.status]
        ? presented.status
        : existing.status;
    const distinctionKeys = new Set(
      existing.distinctions.map((item) =>
        normalizedRecordLabel(
          `${item.label}|${item.organization}|${item.year || ""}|${item.sourceUrl}`
        )
      )
    );
    const mergedDistinctions = [
      ...existing.distinctions,
      ...presented.distinctions.filter((item) => {
        const key = normalizedRecordLabel(
          `${item.label}|${item.organization}|${item.year || ""}|${item.sourceUrl}`
        );
        if (distinctionKeys.has(key)) return false;
        distinctionKeys.add(key);
        return true;
      }),
    ].map((item) => ({ ...item, status: strongest }));

    byTitle.set(normalizedTitle, {
      ...existing,
      status: strongest,
      sourceCount: Math.max(existing.sourceCount, presented.sourceCount),
      sourceUrl: existing.sourceUrl || presented.sourceUrl,
      distinctions: mergedDistinctions,
    });
  }

  return [...byTitle.values()];
}

function isMatchingOfficialNobelAward(value: string, year: number) {
  return (
    /(?:nobel|нобел)/iu.test(value) &&
    new RegExp(`(?:^|\\D)${year}(?:\\D|$)`, "u").test(value)
  );
}

/**
 * Keeps raw award strings visible without upgrading their trust level. Only an
 * official Nobel record is source-verified; a published biography source that
 * explicitly covers awards can raise raw strings to reviewed. Structured work
 * distinctions inherit the status of their already-public work record.
 */
export function writerAwardsForPanel(
  writer: WriterProfile,
  biography: WriterBiographyDisplay | null,
  locale: WorkLocale
): WriterPanelAward[] {
  const awardSources =
    biography?.kind === "published"
      ? biography.sources.filter((source) => source.fields.includes("awards"))
      : [];
  const rawStatus: WriterRecordStatus = awardSources.length
    ? "reviewed"
    : "legacy";
  const rawSourceUrl = awardSources[0]?.url;
  const rawAwards = (writer.awards || [])
    .map((label) => label.trim())
    .filter(Boolean);
  const officialNobel = writer.nobelAward;
  const officialNobelIndex = officialNobel
    ? rawAwards.findIndex((label) =>
        isMatchingOfficialNobelAward(label, officialNobel.year)
      )
    : -1;
  const awards: WriterPanelAward[] = [];

  rawAwards.forEach((label, index) => {
    const official = officialNobel && index === officialNobelIndex;
    awards.push({
      id: `award:${normalizedRecordLabel(label) || index}`,
      kind: "writer-award",
      label,
      sourceCount: official
        ? officialNobel.sources.length
        : awardSources.length,
      sourceUrl: official
        ? officialNobel.sources[0]?.url
        : rawSourceUrl,
      status: official ? "verified" : rawStatus,
    });
  });

  if (officialNobel && officialNobelIndex < 0) {
    awards.unshift({
      id: `award:nobel:${officialNobel.year}`,
      kind: "writer-award",
      label:
        locale === "en"
          ? `Nobel Prize in Literature ${officialNobel.year}`
          : `Нобелевская премия по литературе ${officialNobel.year} года`,
      sourceCount: officialNobel.sources.length,
      sourceUrl: officialNobel.sources[0]?.url,
      status: "verified",
    });
  }

  for (const work of writerWorksForPanel(writer, locale)) {
    awards.push(...work.distinctions);
  }

  const byLabel = new Map<string, WriterPanelAward>();
  for (const award of awards) {
    const context =
      award.kind === "work-distinction" ? award.workTitle : "writer";
    const key = normalizedRecordLabel(`${award.label}|${context}`);
    const existing = byLabel.get(key);
    if (
      !existing ||
      recordStatusStrength[award.status] >
        recordStatusStrength[existing.status]
    ) {
      byLabel.set(key, award);
    }
  }

  return [...byLabel.values()];
}

export function groupWriterRecordsByStatus<
  T extends { status: WriterRecordStatus },
>(records: readonly T[]): WriterRecordGroup<T>[] {
  return WRITER_RECORD_STATUS_ORDER.flatMap((status) => {
    const matching = records.filter((record) => record.status === status);
    return matching.length ? [{ status, records: matching }] : [];
  });
}

export function writerRecordStatusPresentation(
  status: WriterRecordStatus
): WriterRecordStatusPresentation {
  if (status === "verified") {
    return {
      code: status,
      label: "Подтверждено источниками",
      detail: "Структурированная запись с зафиксированным источником",
    };
  }
  if (status === "reviewed") {
    return {
      code: status,
      label: "Проверено редакцией",
      detail: "Запись прошла редакционную проверку",
    };
  }
  return {
    code: status,
    label: "Архивная запись",
    detail: "Источник ещё не зафиксирован",
  };
}

export function writerBiographyPublicStatus(
  biography: WriterBiographyDisplay | null
): WriterBiographyPublicStatus {
  if (!biography) {
    return {
      code: "pending",
      label: "В редакционной очереди",
      detail: "Биография готовится к редакционной проверке",
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
