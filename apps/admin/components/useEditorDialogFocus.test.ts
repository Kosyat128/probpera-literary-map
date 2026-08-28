import { afterEach, describe, expect, it, vi } from "vitest";

import { trapEditorDialogFocus } from "./useEditorDialogFocus";

type FocusableStub = {
  focus: ReturnType<typeof vi.fn>;
  hidden: boolean;
  getAttribute: ReturnType<typeof vi.fn>;
  closest: ReturnType<typeof vi.fn>;
};

function focusableStub(): FocusableStub {
  return {
    focus: vi.fn(),
    hidden: false,
    getAttribute: vi.fn(() => null),
    closest: vi.fn(() => null),
  };
}

function dialogStub(elements: FocusableStub[]) {
  return {
    querySelectorAll: vi.fn(() => elements),
    contains: vi.fn((element: unknown) =>
      elements.includes(element as FocusableStub)
    ),
    focus: vi.fn(),
  } as unknown as HTMLElement;
}

function keyboardEventStub({
  shiftKey = false,
}: {
  shiftKey?: boolean;
} = {}) {
  return {
    key: "Tab",
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as Parameters<typeof trapEditorDialogFocus>[0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared editor dialog focus trap", () => {
  it("wraps forward Tab from the last control to the first", () => {
    const first = focusableStub();
    const last = focusableStub();
    const dialog = dialogStub([first, last]);
    const event = keyboardEventStub();
    vi.stubGlobal("document", { activeElement: last });

    trapEditorDialogFocus(event, dialog);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("wraps reverse Tab from the first control to the last", () => {
    const first = focusableStub();
    const last = focusableStub();
    const dialog = dialogStub([first, last]);
    const event = keyboardEventStub({ shiftKey: true });
    vi.stubGlobal("document", { activeElement: first });

    trapEditorDialogFocus(event, dialog);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();
  });

  it("recovers focus that arrived outside the dialog", () => {
    const first = focusableStub();
    const dialog = dialogStub([first]);
    const event = keyboardEventStub();
    vi.stubGlobal("document", { activeElement: focusableStub() });

    trapEditorDialogFocus(event, dialog);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("keeps keyboard focus on the dialog when no controls are available", () => {
    const dialog = dialogStub([]);
    const event = keyboardEventStub();
    vi.stubGlobal("document", { activeElement: null });

    trapEditorDialogFocus(event, dialog);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dialog.focus).toHaveBeenCalledOnce();
  });
});
