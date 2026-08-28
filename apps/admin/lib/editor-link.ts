import { isSafePublicHref } from "./public-href";

export function validateEditorLinkHref(value: string) {
  const href = value.trim();
  if (!href) return { ok: true as const, href: "" };
  if (isSafePublicHref(href, { allowHash: true, allowMailto: true })) {
    return { ok: true as const, href };
  }
  return {
    ok: false as const,
    error:
      "Укажите HTTPS-ссылку, адрес внутри сайта, якорь #раздел или mailto:адрес.",
  };
}
