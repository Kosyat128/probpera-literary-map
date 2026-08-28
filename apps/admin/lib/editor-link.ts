import { isSafePublicHref } from "./public-href";

export const editorLinkRelFlags = ["nofollow", "sponsored", "ugc"] as const;
export const EDITOR_INTERNAL_LINK_SEARCH_LIMIT = 12;
export const EDITOR_INTERNAL_LINK_SEARCH_MAX_QUERY = 120;

export type EditorLinkRelFlag = (typeof editorLinkRelFlags)[number];

export type EditorLinkAttributes = {
  href: string;
  target: "_blank" | null;
  rel: string | null;
};

export type EditorLinkDraft = {
  href: string;
  openInNewTab: boolean;
  relFlags: EditorLinkRelFlag[];
};

function isSafeEditorMailto(href: string) {
  if (!href.toLocaleLowerCase("en").startsWith("mailto:")) return true;
  const address = href.slice("mailto:".length);
  return (
    address.length <= 320 &&
    !/[?\r\n]/u.test(address) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address)
  );
}

export function normalizeEditorInternalLinkSearch(value: string) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, EDITOR_INTERNAL_LINK_SEARCH_MAX_QUERY);
}

export function editorInternalLinkSearchPattern(value: string) {
  const normalized = normalizeEditorInternalLinkSearch(value);
  if (normalized.length < 2) return null;
  const escaped = normalized.replace(/[\\%_]/gu, (character) => `\\${character}`);
  return `%${escaped}%`;
}

export function validateEditorLinkHref(value: string) {
  const href = value.trim();
  if (!href) return { ok: true as const, href: "" };
  if (
    !/[\u0000-\u001f\u007f]/u.test(href) &&
    isSafeEditorMailto(href) &&
    isSafePublicHref(href, { allowHash: true, allowMailto: true })
  ) {
    return { ok: true as const, href };
  }
  return {
    ok: false as const,
    error:
      "Укажите HTTPS-ссылку, адрес внутри сайта, якорь #раздел или mailto:адрес.",
  };
}

export function editorLinkRelFlagsFromValue(value: unknown) {
  const tokens = new Set(
    typeof value === "string"
      ? value
          .toLocaleLowerCase("en")
          .split(/\s+/u)
          .filter(Boolean)
      : []
  );
  return editorLinkRelFlags.filter((flag) => tokens.has(flag));
}

export function editorLinkDraftFromAttributes(
  attributes: Record<string, unknown> | null | undefined
): EditorLinkDraft {
  return {
    href: typeof attributes?.href === "string" ? attributes.href : "",
    openInNewTab: attributes?.target === "_blank",
    relFlags: editorLinkRelFlagsFromValue(attributes?.rel),
  };
}

export function normalizeEditorLinkAttributes(input: EditorLinkDraft) {
  const hrefResult = validateEditorLinkHref(input.href);
  if (!hrefResult.ok) return hrefResult;
  if (!hrefResult.href) {
    return {
      ok: true as const,
      attributes: {
        href: "",
        target: null,
        rel: null,
      } satisfies EditorLinkAttributes,
    };
  }

  const selectedFlags = new Set(input.relFlags);
  const rel = [
    ...(input.openInNewTab ? ["noopener", "noreferrer"] : []),
    ...editorLinkRelFlags.filter((flag) => selectedFlags.has(flag)),
  ];
  return {
    ok: true as const,
    attributes: {
      href: hrefResult.href,
      target: input.openInNewTab ? "_blank" : null,
      rel: rel.length ? rel.join(" ") : null,
    } satisfies EditorLinkAttributes,
  };
}

export function sanitizeEditorAnchorAttributes(
  attributes: Record<string, string>
) {
  const normalized = normalizeEditorLinkAttributes({
    href: attributes.href || "",
    openInNewTab: attributes.target === "_blank",
    relFlags: editorLinkRelFlagsFromValue(attributes.rel),
  });
  const next = { ...attributes };
  if (!normalized.ok || !normalized.attributes.href) {
    delete next.href;
    delete next.target;
    delete next.rel;
    return next;
  }
  next.href = normalized.attributes.href;
  if (normalized.attributes.target) {
    next.target = normalized.attributes.target;
  } else {
    delete next.target;
  }
  if (normalized.attributes.rel) {
    next.rel = normalized.attributes.rel;
  } else {
    delete next.rel;
  }
  return next;
}
