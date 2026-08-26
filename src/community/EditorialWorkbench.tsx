import { useEffect, useMemo, useState } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";

const STORAGE_KEY = "probpera-editorial-draft";

type Draft = {
  title: string;
  section: string;
  description: string;
  imageUrl: string;
  sourceNotes: string;
  contentHtml: string;
};

const emptyDraft: Draft = {
  title: "",
  section: "book-opinions",
  description: "",
  imageUrl: "",
  sourceNotes: "",
  contentHtml: "",
};

function readDraft(): Draft {
  try {
    const saved = JSON.parse(readWebStorage("local", STORAGE_KEY) || "null");
    return saved && typeof saved === "object"
      ? { ...emptyDraft, ...saved }
      : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export default function EditorialWorkbench() {
  const { t, number } = useInterfaceLanguage();
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [message, setMessage] = useState("");
  const slug = useMemo(() => slugify(draft.title), [draft.title]);
  const words = draft.contentHtml
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  useEffect(() => {
    writeWebStorage("local", STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage(t("Черновик сохранён на этом устройстве."));
  };

  const exportDraft = () => {
    const payload = {
      id: slug || `draft-${Date.now()}`,
      ...draft,
      wordCount: words,
      editorial: {
        status: "draft",
        exportedAt: new Date().toISOString(),
      },
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${payload.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(t("Редакционный JSON подготовлен."));
  };

  const copySocialCard = async () => {
    const text = `${draft.title}\n\n${draft.description}\n\n#ПробаПера #литература`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage(t("Анонс для социальных сетей скопирован."));
    } catch {
      setMessage(
        t("Не удалось скопировать автоматически - выделите текст вручную.")
      );
    }
  };

  return (
    <section className="editorial-workbench">
      <header>
        <div>
          <span className="section-kicker">{t("Редакционная мастерская")}</span>
          <h3>{t("Черновик новой публикации")}</h3>
          <p>
            {t(
              "Форма сохраняет материал локально, проверяет обязательные поля и подготавливает JSON для публикационного архива."
            )}
          </p>
        </div>
        <div>
          <strong>{number(words)}</strong>
          <span>{t("слов")}</span>
        </div>
      </header>

      <div className="editorial-workbench-grid">
        <div className="editorial-workbench-form">
          <label>
            {t("Заголовок")}
            <input
              value={draft.title}
              maxLength={160}
              onChange={(event) => update("title", event.target.value)}
              placeholder={t("Точный редакционный заголовок")}
            />
          </label>
          <label>
            {t("Раздел")}
            <select
              value={draft.section}
              onChange={(event) => update("section", event.target.value)}
            >
              <option value="book-opinions">{t("Мнение о книге")}</option>
              <option value="screen-adaptations">{t("Книга и экранизация")}</option>
              <option value="writers-world">{t("Писатели мира")}</option>
              <option value="awards">{t("Литературные премии")}</option>
              <option value="folklore">{t("Фольклор и мифология")}</option>
              <option value="language">{t("Русский язык")}</option>
              <option value="literary-essays">{t("О литературе и культуре")}</option>
              <option value="miscellaneous">{t("Разное")}</option>
            </select>
          </label>
          <label>
            {t("Краткое описание")}
            <textarea
              value={draft.description}
              maxLength={320}
              rows={3}
              onChange={(event) => update("description", event.target.value)}
              placeholder={t("Для карточки, поиска и социальных сетей")}
            />
          </label>
          <label>
            {t("Изображение и источник")}
            <input
              type="url"
              value={draft.imageUrl}
              onChange={(event) => update("imageUrl", event.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            {t("Источники и редакционные заметки")}
            <textarea
              value={draft.sourceNotes}
              rows={4}
              onChange={(event) => update("sourceNotes", event.target.value)}
              placeholder={t(
                "Название источника, ссылка, что именно подтверждает"
              )}
            />
          </label>
          <label>
            {t("Текст статьи")}
            <textarea
              value={draft.contentHtml}
              rows={14}
              onChange={(event) => update("contentHtml", event.target.value)}
              placeholder={t("<h2>Вступление</h2><p>Текст…</p>")}
            />
          </label>
        </div>

        <aside className="editorial-workbench-preview">
          <span>{t("Предпросмотр карточки")}</span>
          {draft.imageUrl ? (
            <img src={draft.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <div aria-hidden="true">
              <img
                className="brand-fallback-logo"
                src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
          )}
          <small>{draft.section}</small>
          <h4>{draft.title || t("Заголовок будущей публикации")}</h4>
          <p>
            {draft.description ||
              t("Краткое описание поможет читателю понять тему материала.")}
          </p>
          <code>/articles/{slug || "novaya-statya"}/</code>
          <ul>
            <li className={draft.title.length >= 12 ? "is-ready" : ""}>
              {t("Содержательный заголовок")}
            </li>
            <li className={draft.description.length >= 80 ? "is-ready" : ""}>
              {t("SEO-описание не короче 80 знаков")}
            </li>
            <li className={draft.imageUrl ? "is-ready" : ""}>
              {t("Указана иллюстрация")}
            </li>
            <li className={draft.sourceNotes.length >= 20 ? "is-ready" : ""}>
              {t("Зафиксированы источники")}
            </li>
            <li className={words >= 500 ? "is-ready" : ""}>
              {t("Основной текст готов")}
            </li>
          </ul>
          <div>
            <button
              type="button"
              disabled={!draft.title || words < 50}
              onClick={exportDraft}
            >
              {t("Экспортировать JSON")}
            </button>
            <button
              type="button"
              disabled={!draft.title || !draft.description}
              onClick={() => void copySocialCard()}
            >
              {t("Скопировать анонс")}
            </button>
          </div>
          {message && <output>{message}</output>}
        </aside>
      </div>
    </section>
  );
}
