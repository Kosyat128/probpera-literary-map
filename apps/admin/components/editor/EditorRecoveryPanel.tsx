"use client";

import type { EditorAutosaveRecovery } from "@/lib/editor-autosave";

export default function EditorRecoveryPanel({
  recovery,
  onRestore,
  onDiscard,
}: {
  recovery: EditorAutosaveRecovery;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const updatedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(recovery.updatedAt));

  return (
    <section className="editor-recovery-panel" aria-labelledby="editor-recovery-title">
      <div>
        <strong id="editor-recovery-title">
          {recovery.state === "conflict"
            ? "Найдена автокопия другой версии"
            : "Найдена серверная автокопия"}
        </strong>
        <p>
          Сохранена {updatedAt}. Восстановление выполняется только после вашего
          подтверждения и не меняет опубликованный материал.
        </p>
      </div>
      <div className="editor-recovery-actions">
        <button type="button" className="button-secondary" onClick={onRestore}>
          Восстановить в редактор
        </button>
        <button type="button" className="button-secondary" onClick={onDiscard}>
          Удалить автокопию
        </button>
      </div>
    </section>
  );
}
