import { useEffect, useState, type CSSProperties } from "react";

import { selectWriterDisplayName } from "../data/bookLocalization";
import type { WriterProfile } from "../data/countries/types";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type WriterPortraitProps = {
  writer: WriterProfile;
  className?: string;
  decorative?: boolean;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
};

export function writerDisplayName(
  writer: WriterProfile,
  language: "ru" | "en" = "ru"
) {
  return selectWriterDisplayName(writer, language);
}

export function writerInitials(
  writer: WriterProfile,
  language: "ru" | "en" = "ru"
) {
  const parts = writerDisplayName(writer, language)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  const selected = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return (
    selected
      .filter((part): part is string => Boolean(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("ru") || "ПП"
  );
}

function portraitUrl(source?: string) {
  const normalized = source?.trim();
  if (!normalized) return "";
  if (/^(https?:|data:|blob:)/u.test(normalized)) return normalized;
  return `${import.meta.env.BASE_URL}${normalized.replace(/^\/+/, "")}`;
}

export default function WriterPortrait({
  writer,
  className = "",
  decorative = false,
  loading = "lazy",
  style,
}: WriterPortraitProps) {
  const { language, t } = useInterfaceLanguage();
  const source = portraitUrl(writer.portrait);
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
      className={`writer-portrait-media${hasPortrait ? " has-image" : " is-placeholder"}${
        className ? ` ${className}` : ""
      }`}
      style={style}
      aria-hidden={decorative || undefined}
      role={!decorative && !hasPortrait ? "img" : undefined}
      aria-label={
        !decorative && !hasPortrait
          ? `${t("Фирменная заглушка портрета")}: ${name}`
          : undefined
      }
    >
      <span className="writer-portrait-initials" aria-hidden="true">
        {writerInitials(writer, language)}
      </span>
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
