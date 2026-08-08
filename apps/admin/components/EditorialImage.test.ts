import type { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { updateEditorialImageAt } from "./EditorialImage";

vi.mock("./EditorialImageView", () => ({ default: () => null }));

function imageEditor(node: {
  type: { name: string };
  attrs: Record<string, unknown>;
}) {
  const transaction = {
    setNodeMarkup: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  transaction.setNodeMarkup.mockReturnValue(transaction);
  transaction.scrollIntoView.mockReturnValue(transaction);

  const dispatch = vi.fn();
  const setNodeSelection = vi.fn();
  const nodeAt = vi.fn(() => node);
  const editor = {
    state: {
      doc: { nodeAt },
      tr: transaction,
    },
    view: { dispatch },
    commands: { setNodeSelection },
  } as unknown as Editor;

  return {
    dispatch,
    editor,
    nodeAt,
    setNodeSelection,
    transaction,
  };
}

describe("updateEditorialImageAt", () => {
  it("updates the exact expected image and preserves its other attributes", () => {
    const harness = imageEditor({
      type: { name: "image" },
      attrs: {
        src: "https://cdn.example/old.webp",
        alt: "Old alt",
        caption: "Old caption",
        layout: "left",
        title: "Keep this title",
      },
    });

    const updated = updateEditorialImageAt(
      harness.editor,
      17,
      {
        src: "https://cdn.example/new.webp",
        alt: "Old alt",
        caption: "Old caption",
        layout: "left",
      },
      "https://cdn.example/old.webp"
    );

    expect(updated).toBe(true);
    expect(harness.nodeAt).toHaveBeenCalledWith(17);
    expect(harness.transaction.setNodeMarkup).toHaveBeenCalledWith(
      17,
      undefined,
      {
        src: "https://cdn.example/new.webp",
        alt: "Old alt",
        caption: "Old caption",
        layout: "left",
        title: "Keep this title",
      }
    );
    expect(harness.dispatch).toHaveBeenCalledWith(harness.transaction);
    expect(harness.setNodeSelection).toHaveBeenCalledWith(17);
  });

  it("refuses to update when the saved position now points to another image", () => {
    const harness = imageEditor({
      type: { name: "image" },
      attrs: { src: "https://cdn.example/different.webp" },
    });

    const updated = updateEditorialImageAt(
      harness.editor,
      17,
      { src: "https://cdn.example/new.webp" },
      "https://cdn.example/old.webp"
    );

    expect(updated).toBe(false);
    expect(harness.transaction.setNodeMarkup).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(harness.setNodeSelection).not.toHaveBeenCalled();
  });

  it("refuses to update when the saved position no longer contains an image", () => {
    const harness = imageEditor({
      type: { name: "paragraph" },
      attrs: {},
    });

    const updated = updateEditorialImageAt(
      harness.editor,
      17,
      { src: "https://cdn.example/new.webp" },
      "https://cdn.example/old.webp"
    );

    expect(updated).toBe(false);
    expect(harness.transaction.setNodeMarkup).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
  });
});
