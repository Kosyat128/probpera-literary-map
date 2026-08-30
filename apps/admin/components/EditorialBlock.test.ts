import type { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { insertEditorialGallery, replaceMediaSlotAt } from "./EditorialBlock";

vi.mock("./EditorialBlockView", () => ({ default: () => null }));

function blockEditor(node: {
  type: { name: string };
  attrs: Record<string, unknown>;
  nodeSize: number;
}) {
  const replacement = { type: "image", attrs: { src: "replacement" } };
  const create = vi.fn(() => replacement);
  const transaction = {
    replaceWith: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  transaction.replaceWith.mockReturnValue(transaction);
  transaction.scrollIntoView.mockReturnValue(transaction);

  const dispatch = vi.fn();
  const focus = vi.fn();
  const nodeAt = vi.fn(() => node);
  const editor = {
    state: {
      doc: { nodeAt },
      schema: { nodes: { image: { create } } },
      tr: transaction,
    },
    view: { dispatch },
    commands: { focus },
  } as unknown as Editor;

  return {
    create,
    dispatch,
    editor,
    focus,
    nodeAt,
    replacement,
    transaction,
  };
}

describe("replaceMediaSlotAt", () => {
  it("replaces only the media slot at the captured position", () => {
    const harness = blockEditor({
      type: { name: "editorialBlock" },
      attrs: { kind: "media", reveal: "fade-up" },
      nodeSize: 9,
    });
    const attributes = {
      src: "https://cdn.example/new.webp",
      alt: "Description",
      caption: "Caption",
      layout: "wide" as const,
    };

    const replaced = replaceMediaSlotAt(harness.editor, 24, attributes);

    expect(replaced).toBe(true);
    expect(harness.nodeAt).toHaveBeenCalledWith(24);
    expect(harness.create).toHaveBeenCalledWith(attributes);
    expect(harness.transaction.replaceWith).toHaveBeenCalledWith(
      24,
      33,
      harness.replacement
    );
    expect(harness.dispatch).toHaveBeenCalledWith(harness.transaction);
    expect(harness.focus).toHaveBeenCalledOnce();
  });

  it("refuses to replace when the captured position moved to another block", () => {
    const harness = blockEditor({
      type: { name: "editorialBlock" },
      attrs: { kind: "fact" },
      nodeSize: 7,
    });

    const replaced = replaceMediaSlotAt(harness.editor, 24, {
      src: "https://cdn.example/new.webp",
      alt: "Description",
    });

    expect(replaced).toBe(false);
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.transaction.replaceWith).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(harness.focus).not.toHaveBeenCalled();
  });

  it("refuses invalid positions before reading or changing the document", () => {
    const harness = blockEditor({
      type: { name: "editorialBlock" },
      attrs: { kind: "media" },
      nodeSize: 9,
    });

    const replaced = replaceMediaSlotAt(harness.editor, -1, {
      src: "https://cdn.example/new.webp",
      alt: "Description",
    });

    expect(replaced).toBe(false);
    expect(harness.nodeAt).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
  });
});

describe("insertEditorialGallery", () => {
  it("inserts twelve ordered items with stable structured settings", () => {
    const insertContent = vi.fn();
    const chain = {
      focus: vi.fn(),
      insertContent,
      run: vi.fn(),
    };
    chain.focus.mockReturnValue(chain);
    insertContent.mockReturnValue(chain);
    chain.run.mockReturnValue(true);
    const editor = { chain: vi.fn(() => chain) } as unknown as Editor;
    const mediaId = (index: number) =>
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const items = Array.from({ length: 12 }, (_, index) => ({
      mediaId: mediaId(index),
      src: `https://cdn.example.test/${index + 1}.webp`,
      alt: `Кадр ${index + 1}`,
      caption: `Подпись ${index + 1}`,
      credit: `Архив ${index + 1}`,
      source: `https://archive.example.test/${index + 1}`,
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    }));

    insertEditorialGallery(editor, items, "статье", {
      id: "gallery-stable-01",
      columnsDesktop: 4,
      columnsTablet: 3,
      columnsMobile: 2,
      gap: "spacious",
      aspect: "16-9",
      fit: "cover",
    });

    const document = insertContent.mock.calls[0]?.[0] as {
      attrs: Record<string, unknown>;
      content: Array<{ type: string; attrs?: Record<string, unknown> }>;
    };
    expect(document.attrs).toMatchObject({
      kind: "gallery",
      galleryVersion: 1,
      galleryId: "gallery-stable-01",
      galleryColumnsDesktop: 4,
      galleryColumnsTablet: 3,
      galleryColumnsMobile: 2,
      galleryGap: "spacious",
      galleryAspect: "16-9",
      galleryFit: "cover",
    });
    expect(document.content).toHaveLength(13);
    expect(document.content.slice(1).map((item) => item.attrs?.src)).toEqual(
      items.map((item) => item.src)
    );
    expect(document.content[12]?.attrs).toMatchObject({
      mediaId: mediaId(11),
      alt: "Кадр 12",
      caption: "Подпись 12",
      credit: "Архив 12",
      source: "https://archive.example.test/12",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });
  });
});
