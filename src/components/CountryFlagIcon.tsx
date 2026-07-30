import { useEffect, useMemo, useState } from "react";

import { countryFlag } from "../utils/countryFlag";

type Props = {
  code?: string;
  countryName: string;
  className?: string;
  size?: number;
  decorative?: boolean;
};

export function countryFlagAssetPath(code?: string) {
  const normalized = code?.trim().toLowerCase();
  if (!normalized || !/^[a-z]{2}$/.test(normalized)) return null;
  return `${import.meta.env.BASE_URL}assets/country-flags/${normalized}.svg`;
}

export default function CountryFlagIcon({
  code,
  countryName,
  className = "",
  size = 52,
  decorative = false,
}: Props) {
  const source = useMemo(() => countryFlagAssetPath(code), [code]);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [source]);

  if (!source || failed) {
    return (
      <span
        className={`country-flag-icon country-flag-icon--fallback ${className}`.trim()}
        aria-hidden={decorative || undefined}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : `Флаг: ${countryName}`}
        style={{ width: size, height: size }}
      >
        {countryFlag(code)}
      </span>
    );
  }

  return (
    <img
      className={`country-flag-icon ${className}`.trim()}
      src={source}
      alt={decorative ? "" : `Флаг: ${countryName}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
