import type { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { replaceMediaSlotAt } from "./EditorialBlock";

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
