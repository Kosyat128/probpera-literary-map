import { useEffect, useMemo, useState } from "react";

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
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
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
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [message, setMessage] = useState("");
  const slug = useMemo(() => slugify(draft.title), [draft.title]);
  const words = draft.contentHtml
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("Черновик сохранён на этом устройстве.");
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
    setMessage("Редакционный JSON подготовлен.");
  };

  const copySocialCard = async () => {
    const text = `${draft.title}\n\n${draft.description}\n\n#ПробаПера #литература`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Анонс для социальных сетей скопирован.");
    } catch {
      setMessage("Не удалось скопировать автоматически — выделите текст вручную.");
    }
  };

  return (
    <section className="editorial-workbench">
      <header>
        <div>
          <span className="section-kicker">Редакционная мастерская</span>
          <h3>Черновик новой публикации</h3>
          <p>
            Форма сохраняет материал локально, проверяет обязательные поля и
            подготавливает JSON для публикационного архива.
          </p>
        </div>
        <div>
          <strong>{words.toLocaleString("ru-RU")}</strong>
          <span>слов</span>
        </div>
      </header>

      <div className="editorial-workbench-grid">
        <div className="editorial-workbench-form">
          <label>
            Заголовок
            <input
              value={draft.title}
              maxLength={160}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Точный редакционный заголовок"
            />
          </label>
          <label>
            Раздел
            <select
              value={draft.section}
              onChange={(event) => update("section", event.target.value)}
            >
              <option value="book-opinions">Мнение о книге</option>
              <option value="screen-adaptations">Книга и экранизация</option>
              <option value="writers-world">Писатели мира</option>
              <option value="awards">Литературные премии</option>
              <option value="folklore">Фольклор и мифология</option>
              <option value="language">Русский язык</option>
              <option value="literary-essays">О литературе и культуре</option>
            </select>
          </label>
          <label>
            Краткое описание
            <textarea
              value={draft.description}
              maxLength={320}
              rows={3}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Для карточки, поиска и социальных сетей"
            />
          </label>
          <label>
            Изображение и источник
            <input
              type="url"
              value={draft.imageUrl}
              onChange={(event) => update("imageUrl", event.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            Источники и редакционные заметки
            <textarea
              value={draft.sourceNotes}
              rows={4}
              onChange={(event) => update("sourceNotes", event.target.value)}
              placeholder="Название источника, ссылка, что именно подтверждает"
            />
          </label>
          <label>
            Текст статьи
            <textarea
              value={draft.contentHtml}
              rows={14}
              onChange={(event) => update("contentHtml", event.target.value)}
              placeholder="<h2>Вступление</h2><p>Текст…</p>"
            />
          </label>
        </div>

        <aside className="editorial-workbench-preview">
          <span>Предпросмотр карточки</span>
          {draft.imageUrl ? (
            <img src={draft.imageUrl} alt="" />
          ) : (
            <div aria-hidden="true">
              <img
                className="brand-fallback-logo"
                src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
                alt=""
              />
            </div>
          )}
          <small>{draft.section}</small>
          <h4>{draft.title || "Заголовок будущей публикации"}</h4>
          <p>
            {draft.description ||
              "Краткое описание поможет читателю понять тему материала."}
          </p>
          <code>/articles/{slug || "novaya-statya"}/</code>
          <ul>
            <li className={draft.title.length >= 12 ? "is-ready" : ""}>
              Содержательный заголовок
            </li>
            <li className={draft.description.length >= 80 ? "is-ready" : ""}>
              SEO-описание не короче 80 знаков
            </li>
            <li className={draft.imageUrl ? "is-ready" : ""}>
              Указана иллюстрация
            </li>
            <li className={draft.sourceNotes.length >= 20 ? "is-ready" : ""}>
              Зафиксированы источники
            </li>
            <li className={words >= 500 ? "is-ready" : ""}>
              Основной текст готов
            </li>
          </ul>
          <div>
            <button
              type="button"
              disabled={!draft.title || words < 50}
              onClick={exportDraft}
            >
              Экспортировать JSON
            </button>
            <button
              type="button"
              disabled={!draft.title || !draft.description}
              onClick={() => void copySocialCard()}
            >
              Скопировать анонс
            </button>
          </div>
          {message && <output>{message}</output>}
        </aside>
      </div>
    </section>
  );
}
