import { describe, expect, it } from "vitest";

import { buildBookArchive } from "./bookArchive";
import { bookArchiveCountries } from "./countries";

const expectedBooks = [
  ["beloved", "Возлюбленная", "Тони Моррисон", 1987, "usa", "beloved-editorial"],
  ["hamlet", "Гамлет", "Уильям Шекспир", 1603, "england", "hamlet-editorial"],
  ["norwegian-wood", "Норвежский лес", "Харуки Мураками", 1987, "japan", "norwegian-wood-editorial"],
  ["les-miserables", "Отверженные", "Виктор Гюго", 1862, "france", "les-miserables-editorial"],
  ["the-stranger", "Посторонний", "Альбер Камю", 1942, "france", "the-stranger-editorial"],
  ["crime-and-punishment", "Преступление и наказание", "Фёдор Михайлович Достоевский", 1866, "russia", "crime-and-punishment-editorial"],
  ["war-and-peace", "Война и мир", "Лев Николаевич Толстой", 1869, "russia", "war-and-peace-editorial"],
  ["nineteen-eighty-four", "1984", "Джордж Оруэлл", 1949, "england", "nineteen-eighty-four-editorial"],
  ["the-cherry-orchard", "Вишнёвый сад", "Антон Павлович Чехов", 1904, "russia", "cherry-orchard-editorial"],
  ["the-sea-wolf", "Морской волк", "Джек Лондон", 1904, "usa", "sea-wolf-editorial"],
  ["fathers-and-sons", "Отцы и дети", "Иван Сергеевич Тургенев", 1862, "russia", "fathers-and-sons-editorial"],
] as const;

describe("редакционные обложки книжного архива", () => {
  const archive = buildBookArchive(bookArchiveCountries);

  it.each(expectedBooks)(
    "%s: книга, автор, год и страна согласованы",
    (id, title, writerName, firstPublished, countryId, coverSlug) => {
      const matches = archive.filter((book) => book.id === id);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        title,
        writerName,
        firstPublished,
        countryId,
        coverUrl: `brand/book-covers/${coverSlug}.webp`,
        coverThumbnailUrl: `brand/book-covers/thumbs/${coverSlug}.webp`,
        coverRights: { status: "editorial-original" },
      });
    }
  );
});
