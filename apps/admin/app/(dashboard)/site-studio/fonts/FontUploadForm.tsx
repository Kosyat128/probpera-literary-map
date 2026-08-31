"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { withClientAdminPath } from "@/lib/admin-path";

import styles from "./page.module.css";

type UploadState =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

export default function FontUploadForm() {
  const router = useRouter();
  const [upload, setUpload] = useState<UploadState>({ state: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    const isVariable = payload.get("isVariable") === "true";
    const weightMin = Number(payload.get("weightMin"));
    const weightMax = Number(payload.get("weightMax"));
    if (!isVariable && weightMin !== weightMax) {
      setUpload({
        state: "error",
        message:
          "Для обычного шрифта укажите одинаковую насыщенность от и до. Диапазон доступен вариативному шрифту.",
      });
      return;
    }
    setUpload({ state: "uploading" });
    try {
      const response = await fetch(withClientAdminPath("/api/site-fonts/upload"), {
        method: "POST",
        body: payload,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; displayName?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "Не удалось загрузить шрифт.");
      }
      form.reset();
      setUpload({
        state: "success",
        message: `Шрифт «${result?.displayName || "без названия"}» добавлен.`,
      });
      router.refresh();
    } catch (error) {
      setUpload({
        state: "error",
        message:
          error instanceof Error ? error.message : "Не удалось загрузить шрифт.",
      });
    }
  }

  return (
    <form className={styles.uploadForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label className="field">
          <span>Файл WOFF2 или WOFF</span>
          <input
            name="file"
            type="file"
            accept=".woff2,.woff,font/woff2,font/woff"
            required
          />
          <small>До 2 МБ. Внешние ссылки и CSS-импорты не принимаются.</small>
        </label>
        <label className="field">
          <span>Название в редакции</span>
          <input name="displayName" maxLength={120} required />
        </label>
        <label className="field">
          <span>Название семейства</span>
          <input name="familyName" maxLength={120} required />
        </label>
        <label className="field">
          <span>Начертание</span>
          <select name="style" defaultValue="normal">
            <option value="normal">Обычное</option>
            <option value="italic">Курсив</option>
            <option value="oblique">Наклонное</option>
          </select>
        </label>
        <label className="field">
          <span>Насыщенность от</span>
          <input name="weightMin" type="number" min={1} max={1000} defaultValue={400} required />
        </label>
        <label className="field">
          <span>Насыщенность до</span>
          <input name="weightMax" type="number" min={1} max={1000} defaultValue={400} required />
        </label>
        <label className="field">
          <span>Тип файла</span>
          <select name="isVariable" defaultValue="false">
            <option value="false">Обычный шрифт</option>
            <option value="true">Вариативный шрифт</option>
          </select>
        </label>
        <label className="field">
          <span>Лицензия</span>
          <input
            name="licenseName"
            minLength={2}
            maxLength={180}
            placeholder="Например, OFL 1.1 или собственная лицензия"
            required
          />
        </label>
        <label className={`field ${styles.wideField}`}>
          <span>Ссылка на лицензию</span>
          <input name="licenseUrl" type="url" maxLength={2048} placeholder="https://…" />
        </label>
      </div>
      <div className={styles.formActions}>
        <button className="button" type="submit" disabled={upload.state === "uploading"}>
          {upload.state === "uploading" ? "Проверяем и загружаем…" : "Добавить шрифт"}
        </button>
        <p
          className={upload.state === "error" ? styles.errorMessage : styles.statusMessage}
          role={upload.state === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {upload.state === "success" || upload.state === "error"
            ? upload.message
            : "Файл проверяется по расширению, MIME, сигнатуре и SHA-256."}
        </p>
      </div>
    </form>
  );
}
