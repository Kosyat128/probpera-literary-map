import { describe, expect, it } from "vitest";

import type { WorkProfile } from "./countries/types";
import { buildBookArchive } from "./bookArchive";
import { bookArchiveCountries } from "./countries";
import {
  selectBookMetadataLabels,
  selectBookOriginalLanguage,
  selectBookText,
  selectBookWriterName,
  selectWriterDisplayName,
  selectWriterYears,
} from "./bookLocalization";

const book: WorkProfile = {
  id: "the-old-man-and-the-sea",
  title: "Старик и море",
  description: "Русское поле совместимости.",
  translations: {
    ru: {
      locale: "ru",
      title: "Старик и море",
      description: "Проверенная русская аннотация из двух предложений. Второе предложение завершает текст.",
      sourceLanguage: "ru",
      status: "verified",
      sourceUrls: ["https://example.org/book"],
      method: "editorial-original",
      reviewedAt: "2026-08-08",
    },
    en: {
      locale: "en",
      title: "The Old Man and the Sea",
      description: "A verified English annotation in two sentences. The second sentence completes the text.",
      sourceLanguage: "en",
      status: "verified",
      sourceUrls: ["https://example.org/book"],
      method: "editorial-original",
      reviewedAt: "2026-08-08",
    },
  },
};

describe("локализация книжной карточки", () => {
  it("даёт каждой видимой книге профессиональное имя автора на английском", () => {
    const archiveBooks = buildBookArchive(bookArchiveCountries);
    const invalidWriterNames = archiveBooks
      .map((publicBook) => ({
        book: `${publicBook.countryId}:${publicBook.writerId}:${publicBook.id}`,
        writerName: selectBookWriterName(publicBook, "en"),
      }))
      .filter(
        ({ writerName }) =>
          !writerName.trim() ||
          /^(?:author|writer)$/iu.test(writerName.trim()) ||
          /\p{Script=Cyrillic}/u.test(writerName)
      );

    expect(archiveBooks).toHaveLength(9_729);
    expect(invalidWriterNames).toEqual([]);
  });

  it("выбирает только русскую locale-запись", () => {
    expect(selectBookText(book, "ru")).toEqual({
      locale: "ru",
      title: "Старик и море",
      description:
        "Проверенная русская аннотация из двух предложений. Второе предложение завершает текст.",
    });
  });

  it("выбирает только английскую locale-запись", () => {
    expect(selectBookText(book, "en")).toEqual({
      locale: "en",
      title: "The Old Man and the Sea",
      description:
        "A verified English annotation in two sentences. The second sentence completes the text.",
    });
  });

  it("не подставляет русский top-level текст при отсутствии English", () => {
    const withoutEnglish: WorkProfile = {
      ...book,
      translations: { ru: book.translations!.ru },
    };

    expect(selectBookText(withoutEnglish, "en")).toEqual({
      locale: "en",
      title: "",
      description: "",
    });
  });

  it("не пропускает русские метаданные и имя автора в английский режим", () => {
    const localizedBook = {
      ...book,
      originalLanguage: "английский",
      genres: ["роман", "novel"],
      tags: ["море", "survival"],
      writerName: "Эрнест Хемингуэй",
      writer: {
        id: "ernest-hemingway",
        name: "Эрнест Хемингуэй",
        fullName: "Ernest Hemingway",
      },
    };

    expect(selectBookWriterName(localizedBook, "en")).toBe(
      "Ernest Hemingway"
    );
    expect(selectBookOriginalLanguage(localizedBook, "en")).toBe("English");
    expect(
      selectBookMetadataLabels(localizedBook, "en", (label) =>
        label === "роман" ? "novel" : label
      )
    ).toEqual(["novel", "survival"]);
    expect(
      selectWriterDisplayName(
        { id: "unknown", name: "Только русское имя" },
        "en"
      )
    ).toBe("Author");
    expect(
      selectBookWriterName(
        {
          ...book,
          writer: { id: "j_r_r_tolkien", name: "Джон Толкин" },
        },
        "en"
      )
    ).toBe("J. R. R. Tolkien");
    expect(
      selectBookWriterName(
        {
          ...book,
          writer: { id: "miguel_de_cervantes", name: "Мигель де Сервантес" },
        },
        "en"
      )
    ).toBe("Miguel de Cervantes");
    expect(
      selectBookWriterName(
        {
          ...book,
          writer: { id: "unknown_writer", name: "Неизвестный" },
        },
        "en"
      )
    ).toBe("Author");
    expect(
      selectWriterYears(
        {
          id: "dated",
          years: "род. 1899 — ум. 1977",
          birthDate: "1899-01-01",
          deathDate: "1977-01-01",
        },
        "en"
      )
    ).toBe("1899–1977");
  });
});
