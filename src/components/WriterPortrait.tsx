import { useEffect, useState, type CSSProperties } from "react";

import { selectWriterDisplayName } from "../data/bookLocalization";
import type { WriterProfile } from "../data/countries/types";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { CmsMarkerAttributes } from "../cms/directEditBridge";

type WriterPortraitProps = {
  writer: WriterProfile;
  className?: string;
  decorative?: boolean;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
  cmsMarker?: CmsMarkerAttributes;
};

export function writerDisplayName(
  writer: WriterProfile,
  language: "ru" | "en" = "ru"
) {
  return selectWriterDisplayName(writer, language);
}

function portraitUrl(source?: string) {
  const normalized = source?.trim();
  if (!normalized) return "";
  if (/^(https?:|data:|blob:)/u.test(normalized)) return normalized;
  return `${import.meta.env.BASE_URL}${normalized.replace(/^\/+/, "")}`;
}

const approvedPortraitRightsStatuses = new Set([
  "public-domain",
  "licensed",
  "permission",
]);

/**
 * Runtime publication remains fail-closed even if a partial CMS override
 * reaches WriterProfile. A portrait is displayable only as a complete,
 * reviewed rights bundle; a bare URL is never treated as an image approval.
 */
export function writerHasApprovedPortrait(writer: WriterProfile): boolean {
  const rights = writer.portraitRights;
  const sourceUrl = writer.portraitSourceUrl?.trim() || "";

  if (
    !writer.portrait?.trim() ||
    !writer.portraitAlt?.trim() ||
    !sourceUrl ||
    !rights ||
    !approvedPortraitRightsStatuses.has(rights.status) ||
    !rights.licenseName?.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(rights.checkedAt || "") ||
    rights.sourceUrl?.trim() !== sourceUrl
  ) {
    return false;
  }

  if (
    rights.status === "licensed" &&
    (!rights.licenseUrl?.trim() || !rights.creator?.trim())
  ) {
    return false;
  }

  return true;
}

export function approvedWriterPortraitUrl(writer: WriterProfile): string {
  return writerHasApprovedPortrait(writer) ? portraitUrl(writer.portrait) : "";
}

export default function WriterPortrait({
  writer,
  className = "",
  decorative = false,
  loading = "lazy",
  style,
  cmsMarker,
}: WriterPortraitProps) {
  const { language, t } = useInterfaceLanguage();
  const source = approvedWriterPortraitUrl(writer);
  const [failed, setFailed] = useState(false);
  const name = writerDisplayName(writer, language);
  const hasPortrait = Boolean(source && !failed);
  const storedAlt = writer.portraitAlt?.trim() || "";
  const localizedAlt =
    language === "en" && /\p{Script=Cyrillic}/u.test(storedAlt)
      ? ""
      : storedAlt;

  useEffect(() => setFailed(false), [source]);

  return (
    <span
      {...cmsMarker}
      className={`writer-portrait-media${hasPortrait ? " has-image" : " is-empty"}${
        className ? ` ${className}` : ""
      }`}
      style={style}
      aria-hidden={decorative || !hasPortrait || undefined}
    >
      {hasPortrait && (
        <img
          src={source}
          alt={decorative ? "" : localizedAlt || `${t("Портрет")}: ${name}`}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
