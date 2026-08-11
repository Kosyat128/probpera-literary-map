"use client";

import { useMemo, useState } from "react";

import { saveSiteCopyAction } from "@/app/(dashboard)/site-copy/actions";
import type { SiteCopyDefinition } from "@/lib/site-copy-catalog";

type SiteCopyValues = { ru: Record<string, string>; en: Record<string, string> };

function isPrimaryDefinition(definition: SiteCopyDefinition) {
  return !["Весь интерфейс", "Названия стран"].includes(definition.group);
}

export default function SiteCopyEditor({
  definitions,
  values,
}: {
  definitions: readonly SiteCopyDefinition[];
  values: SiteCopyValues;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Основные поля");
  const [draft, setDraft] = useState<SiteCopyValues>(() => ({
    ru: { ...values.ru },
    en: { ...values.en },
  }));
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const groups = useMemo(
    () => Array.from(new Set(definitions.map((item) => item.group))),
    [definitions]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleDefinitions = useMemo(
    () =>
      definitions.filter((definition) => {
        const groupMatches =
          group === "Все разделы" ||
          (group === "Основные поля"
            ? isPrimaryDefinition(definition)
            : definition.group === group);
        const queryMatches =
          !normalizedQuery ||
          `${definition.label} ${definition.defaultRu} ${definition.defaultEn || ""} ${definition.key}`
            .toLocaleLowerCase("ru")
            .includes(normalizedQuery);
        return groupMatches && queryMatches;
      }),
    [definitions, group, normalizedQuery]
  );
  const updateDraft = (key: string, locale: "ru" | "en", value: string) => {
    setDraft((current) => ({
      ...current,
      [locale]: { ...current[locale], [key]: value },
    }));
    setDirtyKeys((current) => new Set(current).add(key));
  };

  return (
    <form className="site-copy-editor" action={saveSiteCopyAction}>
      <section className="panel site-copy-toolbar">
        <label className="field">
          <span>Поиск текста</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например: глобус, закрыть, календарь…"
          />
        </label>
        <label className="field">
          <span>Часть сайта</span>
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option>Основные поля</option>
            <option>Все разделы</option>
            {groups.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="site-copy-toolbar-status">
          <strong>{visibleDefinitions.length}</strong>
          <span>полей показано</span>
        </div>
      </section>

      {Array.from(dirtyKeys).map((key) => (
        <span hidden key={`submitted-${key}`}>
          <input type="hidden" name="copy_key" value={key} />
          <input type="hidden" name="copy_ru" value={draft.ru[key] || ""} />
          <input type="hidden" name="copy_en" value={draft.en[key] || ""} />
        </span>
      ))}

      <section className="site-copy-grid" aria-live="polite">
        {visibleDefinitions.map((definition) => (
            <article className="panel site-copy-card" key={definition.key}>
              <header>
                <div>
                  <span className="badge">{definition.group}</span>
                  <h2>{definition.label}</h2>
                </div>
                <code>{definition.key}</code>
              </header>
              <div className="site-copy-locales">
                <label className="field">
                  <span>Русский вариант</span>
                  {definition.multiline ? (
                    <textarea
                      value={draft.ru[definition.key] || ""}
                      onChange={(event) =>
                        updateDraft(definition.key, "ru", event.target.value)
                      }
                      placeholder={definition.defaultRu}
                    />
                  ) : (
                    <input
                      value={draft.ru[definition.key] || ""}
                      onChange={(event) =>
                        updateDraft(definition.key, "ru", event.target.value)
                      }
                      placeholder={definition.defaultRu}
                    />
                  )}
                  <small>Пусто — исходный текст: {definition.defaultRu}</small>
                </label>
                <label className="field">
                  <span>English · необязательно</span>
                  {definition.multiline ? (
                    <textarea
                      value={draft.en[definition.key] || ""}
                      onChange={(event) =>
                        updateDraft(definition.key, "en", event.target.value)
                      }
                      placeholder={definition.defaultEn || "Системный английский перевод"}
                    />
                  ) : (
                    <input
                      value={draft.en[definition.key] || ""}
                      onChange={(event) =>
                        updateDraft(definition.key, "en", event.target.value)
                      }
                      placeholder={definition.defaultEn || "Системный английский перевод"}
                    />
                  )}
                  <small>
                    Пусто — используется текущий английский перевод сайта.
                  </small>
                </label>
              </div>
            </article>
        ))}
      </section>

      {!visibleDefinitions.length && (
        <section className="panel empty-state">
          <div>
            <h2>Текст не найден</h2>
            <p>Измените запрос или добавьте точную исходную строку ниже.</p>
          </div>
        </section>
      )}

      <details className="panel site-copy-custom">
        <summary>Добавить точную строку, которой ещё нет в каталоге</summary>
        <p>
          Скопируйте исходный русский текст с сайта без изменений. После
          сохранения он станет отдельным управляемым полем.
        </p>
        <label className="field">
          <span>Исходная строка на сайте</span>
          <textarea name="custom_source" maxLength={1_190} />
        </label>
        <div className="site-copy-locales">
          <label className="field">
            <span>Новый русский вариант</span>
            <textarea name="custom_ru" maxLength={4_000} />
          </label>
          <label className="field">
            <span>English · необязательно</span>
            <textarea name="custom_en" maxLength={4_000} />
          </label>
        </div>
      </details>

      <div className="site-copy-submit">
        <p>
          Сохраняются только заполненные замены. Пустое поле возвращает
          системный текст и не стирает его из кода.
        </p>
        <button className="button" type="submit">
          Сохранить и опубликовать тексты
        </button>
      </div>
    </form>
  );
}
