import type { DragEvent } from "react";

import { CLIENT_IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/client-image-upload";

import type {
  ArticleEditorLocale,
  ArticleFileInputRef,
  ArticlePanelSectionRef,
  ArticleValueChange,
  MarkArticleDirty,
  MarkRussianSourceChanged,
} from "./ArticleEditorTypes";

export type CoverEditorProps = {
  locale: ArticleEditorLocale;
  sectionRef?: ArticlePanelSectionRef;
  fileInputRef: ArticleFileInputRef;
  coverUrl: string;
  coverAlt: string;
  isUploading: boolean;
  uploadDisabled: boolean;
  onOpenPicker: () => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onCoverUrlChange: ArticleValueChange<string>;
  onCoverAltChange: ArticleValueChange<string>;
  markRussianSourceChanged: MarkRussianSourceChanged;
  markDirty: MarkArticleDirty;
};

export default function CoverEditor({
  locale,
  sectionRef,
  fileInputRef,
  coverUrl,
  coverAlt,
  isUploading,
  uploadDisabled,
  onOpenPicker,
  onUploadFile,
  onCoverUrlChange,
  onCoverAltChange,
  markRussianSourceChanged,
  markDirty,
}: CoverEditorProps) {
  const uploadFirstFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void onUploadFile(file);
  };
  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    uploadFirstFile(event.dataTransfer.files);
  };

  return (
    <section ref={sectionRef} className="panel settings-stack">
      <h2>Обложка</h2>
      <input
        ref={fileInputRef}
        className="visually-hidden-file"
        type="file"
        accept={CLIENT_IMAGE_ACCEPT_ATTRIBUTE}
        onChange={(event) => uploadFirstFile(event.target.files)}
      />
      <button
        className={
          isUploading ? "cover-upload-zone is-uploading" : "cover-upload-zone"
        }
        type="button"
        onClick={onOpenPicker}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        disabled={uploadDisabled}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={
              coverAlt ||
              (locale === "en"
                ? "Article cover preview"
                : "Предпросмотр обложки статьи")
            }
          />
        ) : (
          <span className="cover-upload-mark" aria-hidden="true">
            ＋
          </span>
        )}
        <strong>
          {isUploading
            ? "Загружаем обложку…"
            : coverUrl
              ? "Нажмите, чтобы заменить обложку"
              : "Выбрать обложку с компьютера"}
        </strong>
        <small>
          Автоподгонка без обрезки · JPEG, PNG, WebP или AVIF · исходник до 20 МБ
        </small>
      </button>
      <label className="field">
        <span>Адрес изображения</span>
        <input
          type="url"
          name="cover_external_url"
          value={coverUrl}
          onChange={(event) => onCoverUrlChange(event.target.value)}
          placeholder="https://…"
        />
      </label>
      <label className="field">
        <span>
          {locale === "en"
            ? "Image description (English)"
            : "Описание изображения"}
        </span>
        <textarea
          value={coverAlt}
          onChange={(event) => {
            onCoverAltChange(event.target.value);
            if (locale === "ru") markRussianSourceChanged();
            markDirty();
          }}
          maxLength={500}
          placeholder={
            locale === "en"
              ? "Describe the image for accessibility and search"
              : "Что изображено - для доступности и поиска"
          }
        />
      </label>
    </section>
  );
}

