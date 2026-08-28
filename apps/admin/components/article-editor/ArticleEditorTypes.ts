import type { Ref, RefCallback } from "react";

export type ArticleEditorLocale = "ru" | "en";

export type ArticlePublicationStatus =
  | "draft"
  | "review"
  | "scheduled"
  | "published"
  | "hidden"
  | "archived";

export type ArticleTranslationStatus =
  | "draft"
  | "review"
  | "approved"
  | "published"
  | "stale"
  | "archived";

export type ArticleValidationCheck = {
  label: string;
  ok: boolean;
};

export type ArticlePanelSectionRef = RefCallback<HTMLElement>;
export type ArticleFileInputRef = Ref<HTMLInputElement>;
export type MarkRussianSourceChanged = () => void;
export type MarkArticleDirty = () => void;
export type ArticleValueChange<Value> = (value: Value) => void;

