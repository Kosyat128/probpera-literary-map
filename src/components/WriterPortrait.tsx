import { useEffect, useState, type CSSProperties } from "react";

import type { WriterProfile } from "../data/countries/types";

type WriterPortraitProps = {
  writer: WriterProfile;
  className?: string;
  decorative?: boolean;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
};

export function writerDisplayName(writer: WriterProfile) {
  return writer.name || writer.fullName || "Автор";
}

export function writerInitials(writer: WriterProfile) {
  const parts = writerDisplayName(writer)
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
  const source = portraitUrl(writer.portrait);
  const [failed, setFailed] = useState(false);
  const name = writerDisplayName(writer);
  const hasPortrait = Boolean(source && !failed);

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
          ? `Фирменная заглушка портрета: ${name}`
          : undefined
      }
    >
      <span className="writer-portrait-initials" aria-hidden="true">
        {writerInitials(writer)}
      </span>
      {hasPortrait && (
        <img
          src={source}
          alt={decorative ? "" : writer.portraitAlt || `Портрет: ${name}`}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
