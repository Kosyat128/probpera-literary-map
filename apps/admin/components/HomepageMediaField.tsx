"use client";

import { useRef, useState } from "react";

export type HomepageMediaOption = {
  id: string;
  label: string;
  publicUrl: string;
};

function apiPath(path: string) {
  if (typeof window === "undefined") return path;
  const hasAdminPrefix =
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/");
  return `${hasAdminPrefix ? "/admin" : ""}${path}`;
}

function fileLabel(file: File) {
  const value = file.name
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return value.length >= 3 ? value.slice(0, 500) : "Фоновое изображение главной страницы";
}

export default function HomepageMediaField({
  value,
  media,
}: {
  value?: string | null;
  media: HomepageMediaOption[];
}) {
  const [selectedId, setSelectedId] = useState(value || "");
  const [options, setOptions] = useState(media);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((asset) => asset.id === selectedId);

  const upload = async (file: File) => {
    const acceptedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ]);
    if (!acceptedTypes.has(file.type)) {
      setError("Выберите JPEG, PNG, WebP или AVIF.");
      return;
    }
    if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
      setError("Размер файла должен быть не больше 12 МБ.");
      return;
    }

    const altText = fileLabel(file);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt_text", altText);
    formData.set("caption", "");
    formData.set("creator", "");
    formData.set("source_url", "");
    formData.set("license_name", "");
    formData.set("license_url", "");
    formData.set("collection_name", "Главная страница");
    formData.set("image_usage", "hero");

    setUploading(true);
    setError("");
    setMessage("Загружаем и оптимизируем изображение…");
    try {
      const response = await fetch(apiPath("/api/media/upload"), {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.id || !result.url) {
        throw new Error(result.error || "Не удалось загрузить изображение.");
      }
      const option = { id: result.id, label: altText, publicUrl: result.url };
      setOptions((current) => [option, ...current.filter((item) => item.id !== option.id)]);
      setSelectedId(option.id);
      setMessage("Изображение загружено и выбрано. Нажмите «Сохранить блок».");
    } catch (uploadError) {
      setMessage("");
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить изображение."
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="homepage-media-field">
      <select
        name="background_media_id"
        value={selectedId}
        onChange={(event) => {
          setSelectedId(event.target.value);
          setMessage("");
          setError("");
        }}
      >
        <option value="">Без фонового изображения</option>
        {options.map((asset) => (
          <option value={asset.id} key={asset.id}>{asset.label}</option>
        ))}
      </select>
      <input
        ref={inputRef}
        className="visually-hidden-file"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        className={uploading ? "homepage-media-drop is-uploading" : "homepage-media-drop"}
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        disabled={uploading}
      >
        {selected?.publicUrl ? (
          <img src={selected.publicUrl} alt={selected.label} />
        ) : (
          <span aria-hidden="true">＋</span>
        )}
        <strong>{uploading ? "Оптимизируем…" : "Загрузить фон с компьютера"}</strong>
        <small>Нажмите или перетащите изображение · до 12 МБ</small>
      </button>
      {message && <small className="is-success" role="status">{message}</small>}
      {error && <small className="is-error" role="alert">{error}</small>}
    </div>
  );
}
