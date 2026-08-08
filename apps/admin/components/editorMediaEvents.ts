export const EDITOR_IMAGE_REPLACE_EVENT =
  "probpera:editor-image-replace" as const;
export const EDITOR_MEDIA_SLOT_EVENT = "probpera:editor-media-slot" as const;

export type EditorImageReplaceDetail = {
  position: number;
  attributes: Record<string, unknown>;
};

export type EditorMediaSlotDetail = {
  position: number;
  file?: File;
};

export function requestEditorImageReplacement(
  detail: EditorImageReplaceDetail
) {
  window.dispatchEvent(
    new CustomEvent<EditorImageReplaceDetail>(EDITOR_IMAGE_REPLACE_EVENT, {
      detail,
    })
  );
}

export function requestEditorMediaSlot(
  detail: EditorMediaSlotDetail
) {
  window.dispatchEvent(
    new CustomEvent<EditorMediaSlotDetail>(EDITOR_MEDIA_SLOT_EVENT, {
      detail,
    })
  );
}
