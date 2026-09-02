type EditorHeadingNode = {
  type?: { name?: string };
  attrs?: Record<string, unknown>;
  textContent?: string;
};

export type EditorHeadingDocument = {
  descendants: (
    visitor: (node: EditorHeadingNode, position: number) => boolean | void
  ) => void;
};

export type EditorImageDocumentKind = "article" | "page";

const MAX_IMAGE_TEXT_LENGTH = 500;
const MAX_CONTEXT_SEGMENT_LENGTH = 180;

function normalizedText(value: unknown, maximum = MAX_CONTEXT_SEGMENT_LENGTH) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maximum)
    : "";
}

function fileLabel(fileName: string) {
  const label = normalizedText(
    fileName
      .replace(/\.[^.]+$/u, "")
      .replace(/[_-]+/gu, " "),
    MAX_IMAGE_TEXT_LENGTH
  );
  return /[а-яё]/iu.test(label) ? label : "";
}

export function nearestEditorHeading(
  document: EditorHeadingDocument | null | undefined,
  position: number | null | undefined
) {
  if (!document) return "";
  const boundary = Number.isFinite(position)
    ? Math.max(0, Math.trunc(Number(position)))
    : Number.POSITIVE_INFINITY;
  let nearestPosition = -1;
  let nearestHeading = "";

  document.descendants((node, nodePosition) => {
    if (nodePosition >= boundary || node.type?.name !== "heading") return;
    const level = Number(node.attrs?.level);
    if (level < 2 || level > 6) return;
    const heading = normalizedText(node.textContent);
    if (!heading || nodePosition < nearestPosition) return;
    nearestPosition = nodePosition;
    nearestHeading = heading;
  });

  return nearestHeading;
}

export function suggestEditorImageAltText({
  document,
  position,
  title,
  fileName = "",
  kind,
}: {
  document?: EditorHeadingDocument | null;
  position?: number | null;
  title: string;
  fileName?: string;
  kind: EditorImageDocumentKind;
}) {
  const documentTitle = normalizedText(title);
  const heading = nearestEditorHeading(document, position);
  const subject = kind === "article" ? "статье" : "странице";
  const owner = kind === "article" ? "статьи" : "страницы";
  let value = "";

  if (heading && documentTitle) {
    value = `Иллюстрация к разделу «${heading}» ${owner} «${documentTitle}»`;
  } else if (heading) {
    value = `Иллюстрация к разделу «${heading}»`;
  } else if (documentTitle) {
    value = `Иллюстрация к ${subject} «${documentTitle}»`;
  } else {
    value = fileLabel(fileName) || `Иллюстрация к ${subject}`;
  }

  return value.slice(0, MAX_IMAGE_TEXT_LENGTH);
}

export function resolveEditorImageAltText({
  currentAlt,
  fallbackAlt,
  suggestedAlt,
  decorative = false,
}: {
  currentAlt?: unknown;
  fallbackAlt?: unknown;
  suggestedAlt: string;
  decorative?: boolean;
}) {
  if (decorative) return "";
  const current =
    typeof currentAlt === "string"
      ? currentAlt.trim().slice(0, MAX_IMAGE_TEXT_LENGTH)
      : "";
  if (current.length >= 3) return current;
  const fallback =
    typeof fallbackAlt === "string"
      ? fallbackAlt.trim().slice(0, MAX_IMAGE_TEXT_LENGTH)
      : "";
  return fallback.length >= 3
    ? fallback
    : suggestedAlt.trim().slice(0, MAX_IMAGE_TEXT_LENGTH);
}
