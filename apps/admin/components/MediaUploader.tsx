"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { republishMediaAction } from "@/app/(dashboard)/media/actions";
import { withClientAdminPath } from "@/lib/admin-path";
import { prepareClientImage } from "@/lib/client-image-upload";

type UploadPublicationState = "started" | "queued" | "queue-error";

export default function MediaUploader() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"info" | "success" | "error">("info");
  const [publication, setPublication] = useState<UploadPublicationState | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState("");
  const [usage, setUsage] = useState<"cover" | "hero" | "gallery" | "inline">("inline");

  async function upload(formData: FormData) {
    setPending(true);
    setPublication(null);
    setUploadedMediaId("");
    setMessageKind("info");
    setMessage("Подготавливаем изображение без обрезки…");
    try {
      const sourceFile = formData.get("file");
      if (!(sourceFile instanceof File)) {
        throw new Error("Выберите изображение для загрузки.");
      }
      const prepared = await prepareClientImage(sourceFile, usage);
      formData.set("file", prepared.file);
      formData.set("image_usage", usage);
      formData.set("client_width", String(prepared.width));
      formData.set("client_height", String(prepared.height));
      setMessage("Загружаем подготовленное изображение…");

      const response = await fetch(withClientAdminPath("/api/media/upload"), {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        publication?: UploadPublicationState;
      };
      if (!response.ok) throw new Error(result.error || "Файл не загружен.");
      if (!result.id || !result.publication) {
        throw new Error("Изображение загружено, но сервер вернул неполный статус публикации. Обновите медиатеку.");
      }
      setUploadedMediaId(result.id);
      setPublication(result.publication);
      if (result.publication === "started") {
        setMessageKind("success");
        setMessage("Изображение оптимизировано, добавлено в медиатеку, публичная сборка запущена.");
      } else if (result.publication === "queued") {
        setMessageKind("success");
        setMessage("Изображение добавлено в медиатеку и сохранено в резервной очереди публикации.");
      } else {
        setMessageKind("error");
        setMessage("Изображение сохранено, но запрос публикации записать не удалось. Повторите публикацию.");
      }
      router.refresh();
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Файл не загружен.");
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
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required />
        <strong>JPEG, PNG, WebP или AVIF</strong>
        <p>Исходник до 20 МБ. Он будет подогнан без обрезки, очищен от метаданных и сохранён в WebP.</p>
      </label>
      <label className="field">
        <span>Описание для незрячих читателей *</span>
        <input name="alt_text" required minLength={3} maxLength={500} />
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
    {publication === "queue-error" && uploadedMediaId && (
      <form className="panel settings-stack" action={republishMediaAction}>
        <input type="hidden" name="id" value={uploadedMediaId} />
        <p className="form-message form-error" role="alert">
          Файл уже в медиатеке. Повторная отправка не загрузит его второй раз.
        </p>
        <button className="button button-secondary" type="submit">
          Повторить публикацию
        </button>
      </form>
    )}
  </>;
}
