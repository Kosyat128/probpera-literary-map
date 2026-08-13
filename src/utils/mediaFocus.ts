import type { CSSProperties } from "react";

const defaultMediaFocus = 0.5;

export function normalizeMediaFocus(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return defaultMediaFocus;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultMediaFocus;
  return Math.min(1, Math.max(0, numeric));
}

export function mediaFocusPosition(x: unknown, y: unknown) {
  const horizontal = Math.round(normalizeMediaFocus(x) * 10_000) / 100;
  const vertical = Math.round(normalizeMediaFocus(y) * 10_000) / 100;
  return `${horizontal}% ${vertical}%`;
}

export function mediaFocusStyle(x: unknown, y: unknown): CSSProperties {
  return { objectPosition: mediaFocusPosition(x, y) };
}
