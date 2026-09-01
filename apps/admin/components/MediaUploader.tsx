"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { republishMediaAction } from "@/app/(dashboard)/media/actions";
import { uploadEditorImage } from "@/lib/editor-image-upload";
import { CLIENT_IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/client-image-upload";

type UploadPublicationState = "started" | "queued" | "queue-error";

export default function MediaUploader() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"info" | "success" | "error">("info");
  const [publication, setPublication] = useState<UploadPublicationState | null>(null);
  const [uploadedMediaIds, setUploadedMediaIds] = useState<string[]>([]);
  const [usage, setUsage] = useState<"cover" | "hero" | "gallery" | "inline">("inline");

  async function upload(formData: FormData) {
    setPending(true);
    setPublication(null);
    setUploadedMediaIds([]);
    setMessageKind("info");
    setMessage("Проверяем выбранные изображения…");
    let completed = 0;
    const queueErrorIds: string[] = [];
    try {
      const sourceFiles = formData
        .getAll("file")
        .filter((value): value is File => value instanceof File && value.size > 0);
      if (!sourceFiles.length) {
        throw new Error("Выберите хотя бы одно изображение для загрузки.");
      }
      if (sourceFiles.length > 20) {
        throw new Error("За один раз можно безопасно загрузить не более 20 изображений.");
      }
      const sharedMetadata = {
        altText: String(formData.get("alt_text") || ""),
        caption: String(formData.get("caption") || ""),
        creator: String(formData.get("creator") || ""),
        sourceUrl: String(formData.get("source_url") || ""),
        licenseName: String(formData.get("license_name") || ""),
        licenseUrl: String(formData.get("license_url") || ""),
        collectionName: String(formData.get("collection_name") || "Общее"),
      };
      let startedCount = 0;
      let queuedCount = 0;
      for (const [index, sourceFile] of sourceFiles.entries()) {
        const position = `${index + 1} из ${sourceFiles.length}`;
        const result = await uploadEditorImage(sourceFile, {
          usage,
          ...sharedMetadata,
          onProgress(stage) {
            setMessage(
              stage === "prepare"
                ? `Подготавливаем файл ${position} без обрезки…`
                : `Загружаем файл ${position}…`
            );
          },
        });
        if (!result.mediaId || !result.publication) {
          throw new Error("Файл загружен, но сервер вернул неполный статус публикации. Обновите медиатеку.");
        }
        completed += 1;
        if (result.publication === "started") startedCount += 1;
        if (result.publication === "queued") queuedCount += 1;
        if (result.publication === "queue-error") {
          queueErrorIds.push(result.mediaId);
          setUploadedMediaIds([...queueErrorIds]);
        }
      }
      setUploadedMediaIds(queueErrorIds);
      if (queueErrorIds.length) {
        setPublication("queue-error");
        setMessageKind("error");
        setMessage(
          `Загружено ${completed} файлов, но для ${queueErrorIds.length} не удалось записать запрос публикации. Файлы сохранены; повторите публикацию ниже.`
        );
      } else if (queuedCount > 0) {
        setPublication("queued");
        setMessageKind("success");
        setMessage(`Загружено ${completed} файлов. Обновления сохранены в резервной очереди публикации.`);
      } else {
        setPublication("started");
        setMessageKind("success");
        setMessage(`Оптимизировано и загружено ${startedCount} файлов. Публичная сборка запущена.`);
      }
      router.refresh();
    } catch (error) {
      if (queueErrorIds.length) setPublication("queue-error");
      setMessageKind("error");
      const reason = error instanceof Error ? error.message : "Файл не загружен.";
      setMessage(completed > 0
        ? `Загружено ${completed} файлов, затем операция остановилась: ${reason}`
        : reason);
    } finally {
      setPending(false);
    }
  }

  return <>
    <form className="panel settings-stack" action={upload}>
      <h2>Добавить изображение</h2>
      <label className="field">
        <span>Назначение и оптимизация</span>
        <select value={usage} onChange={(event) => setUsage(event.target.value as typeof usage)}>
          <option value="inline">Иллюстрация в тексте · до 2000 × 2000</option>
          <option value="hero">Большой фон / главная · до 2400 × 1600</option>
          <option value="cover">Книжная обложка · до 1800 × 2700</option>
          <option value="gallery">Галерея · до 2000 × 2000</option>
        </select>
        <small>Пропорции сохраняются; кадрирование настраивается позже фокусом и эффектами.</small>
      </label>
      <label className="upload-zone">
        <input name="file" type="file" accept={CLIENT_IMAGE_ACCEPT_ATTRIBUTE} multiple required />
        <strong>Растровые изображения всех распространённых форматов</strong>
        <p>JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC/HEIF и JPEG XL - если формат декодируется вашим браузером. До 20 файлов за операцию; каждый исходник будет подогнан без обрезки, очищен от метаданных и сохранён отдельным неизменяемым WebP. SVG и другие исполняемые документы запрещены.</p>
      </label>
      <label className="field">
        <span>Общее описание для выбранных файлов *</span>
        <input name="alt_text" required minLength={3} maxLength={500} />
        <small>При массовой загрузке эти метаданные применяются ко всем файлам; затем каждый файл можно уточнить отдельно.</small>
      </label>
      <label className="field">
        <span>Подпись</span>
        <input name="caption" maxLength={1000} />
      </label>
      <label className="field">
        <span>Автор изображения</span>
        <input name="creator" maxLength={240} />
      </label>
      <label className="field">
        <span>Ссылка на источник</span>
        <input name="source_url" type="url" placeholder="https://…" />
      </label>
      <label className="field">
        <span>Лицензия или основание использования</span>
        <input name="license_name" maxLength={180} placeholder="Public Domain, CC BY-SA 4.0…" />
      </label>
      <label className="field">
        <span>Ссылка на лицензию</span>
        <input name="license_url" type="url" placeholder="https://…" />
      </label>
      <label className="field">
        <span>Коллекция</span>
        <input name="collection_name" defaultValue="Общее" required />
      </label>
      {message && (
        <p
          className={`form-message${messageKind === "success" ? " form-success" : messageKind === "error" ? " form-error" : ""}`}
          role={messageKind === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Обрабатываем…" : "Оптимизировать и загрузить"}
      </button>
    </form>
    {publication === "queue-error" && uploadedMediaIds.map((mediaId) => (
      <form className="panel settings-stack" action={republishMediaAction} key={mediaId}>
        <input type="hidden" name="id" value={mediaId} />
        <p className="form-message form-error" role="alert">
          Файл {mediaId} уже в медиатеке. Повторная отправка не загрузит его второй раз.
        </p>
        <button className="button button-secondary" type="submit">
          Повторить публикацию этого файла
        </button>
      </form>
    ))}
  </>;
}
