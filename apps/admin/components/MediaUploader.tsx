"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withClientAdminPath } from "@/lib/admin-path";
import { prepareClientImage } from "@/lib/client-image-upload";

export default function MediaUploader() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(formData: FormData) {
    setPending(true);
    setMessage("Подготавливаем изображение без обрезки…");
    try {
      const sourceFile = formData.get("file");
      if (!(sourceFile instanceof File)) {
        throw new Error("Выберите изображение для загрузки.");
      }
      const prepared = await prepareClientImage(sourceFile, "inline");
      formData.set("file", prepared.file);
      formData.set("image_usage", "inline");
      formData.set("client_width", String(prepared.width));
      formData.set("client_height", String(prepared.height));
      setMessage("Загружаем подготовленное изображение…");

      const response = await fetch(withClientAdminPath("/api/media/upload"), {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Файл не загружен.");
      setMessage("Изображение оптимизировано и добавлено в медиатеку.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Файл не загружен.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="panel settings-stack" action={upload}>
      <h2>Добавить изображение</h2>
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
      {message && <p className={message.includes("добавлено") ? "form-message form-success" : "form-message"}>{message}</p>}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Обрабатываем…" : "Загрузить в медиатеку"}
      </button>
    </form>
  );
}
