import { describe, expect, it } from "vitest";

import {
  buildBookArchive,
  buildPublicBookArchive,
  resolveBookArchivePublicTarget,
} from "../bookArchive";
import { isPublicBook } from "../bookQuality";
import { countBiographySentences, isGenericBiographyText } from "../writerBiography";
import {
  bookArchiveCountries,
  countries,
  writerBiographyFactReviewSourceCountries,
} from "./index";
import type { Country } from "./types";
import {
  mergeWriterBiographyLegacyCorrections,
  quarantinedWriterIdentities,
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
  writerPublicProfileFactCorrections,
} from "./writerBiographyLegacyCorrections";

function key(countryId: string, writerId: string) {
  return `${countryId}:${writerId}`;
}

describe("legacy writer biography curation", () => {
  it("keeps the manually sourced correction queue exact and auditable", () => {
    expect(writerBiographyLegacyCorrections).toHaveLength(55);
    expect(quarantinedWriterIdentities).toHaveLength(58);
    expect(writerIdentityCorrections).toHaveLength(2);
    expect(writerPublicProfileFactCorrections).toHaveLength(29);

    const correctionKeys = writerBiographyLegacyCorrections.map((item) =>
      key(item.countryId, item.writerId)
    );
    const quarantineKeys = quarantinedWriterIdentities.map((item) =>
      key(item.countryId, item.writerId)
    );

    expect(new Set(correctionKeys).size).toBe(correctionKeys.length);
    expect(new Set(quarantineKeys).size).toBe(quarantineKeys.length);
    expect(correctionKeys.filter((item) => quarantineKeys.includes(item))).toEqual(
      []
    );
    expect(
      writerBiographyLegacyCorrections.every(
        (item) =>
          countBiographySentences(item.text) === 2 &&
          !isGenericBiographyText(item.text) &&
          item.evidence.length > 0 &&
          item.evidence.every((source) => /^https:\/\//u.test(source.url))
      )
    ).toBe(true);
  });

  it("repairs two resolvable identity records and removes their false ids", () => {
    const publicKeys = new Set(
      countries.flatMap((country) =>
        country.writers.map((writer) => key(country.id, writer.id))
      )
    );

    expect(publicKeys.has("chile:marta_brunet")).toBe(true);
    expect(publicKeys.has("japan:kataoka_teppei")).toBe(true);
    expect(
      publicKeys.has("chile:carmen_martin_gaite_chile_relation")
    ).toBe(false);
    expect(publicKeys.has("japan:yasunari_kawabata_additional")).toBe(false);
  });

  it("publishes every corrected short Russian biography and hides quarantined identities", () => {
    const legacyCorrectionRecords = new Map(
      writerBiographyFactReviewSourceCountries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const publicRecords = new Map(
      countries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );

    for (const item of writerBiographyLegacyCorrections) {
      expect(
        legacyCorrectionRecords.get(key(item.countryId, item.writerId))?.bio
      ).toBe(item.text);
    }
    for (const item of quarantinedWriterIdentities) {
      expect(publicRecords.has(key(item.countryId, item.writerId))).toBe(false);
    }
  });

  it("changes only bio on a corrected writer and does not promote its status", () => {
    const fixture: Country[] = [
      {
        id: "australia",
        name: "Австралия",
        writers: [
          {
            id: "gregory_david_roberts",
            name: "Грегори Дэвид Робертс",
            bio: "Служебный текст",
            works: ["Шантарам"],
            awards: ["Без изменений"],
            tags: ["проза"],
            editorial: { status: "draft" },
          },
        ],
      },
    ];

    const [writer] = mergeWriterBiographyLegacyCorrections(fixture)[0].writers;
    expect(writer).toEqual({
      ...fixture[0].writers[0],
      bio: writerBiographyLegacyCorrections[0].text,
    });
    expect(writer.biographyTranslations).toBeUndefined();
    expect(writer.editorial?.status).toBe("draft");
  });

  it("removes a proven false public work attribution without changing the book source", () => {
    const publicWriter = countries
      .find((country) => country.id === "colombia")
      ?.writers.find((writer) => writer.id === "hector_abad_faciolince");
    const bookSourceWriter = bookArchiveCountries
      .find((country) => country.id === "colombia")
      ?.writers.find((writer) => writer.id === "hector_abad_faciolince");

    expect(publicWriter?.works).toEqual([
      "Angosta",
      "El olvido que seremos",
      "La oculta",
    ]);
    expect(publicWriter?.works).not.toContain("Мы увидимся в августе");
    expect(bookSourceWriter?.works).toContain("Мы увидимся в августе");

    const publicTshibanda = countries
      .find((country) => country.id === "democratic_republic_of_congo")
      ?.writers.find((writer) => writer.id === "pie_tshibanda");
    const bookSourceTshibanda = bookArchiveCountries
      .find((country) => country.id === "democratic_republic_of_congo")
      ?.writers.find((writer) => writer.id === "pie_tshibanda");
    expect(publicTshibanda?.works).toEqual(["Un fou noir au pays des Blancs"]);
    expect(bookSourceTshibanda?.works).toContain("Я не чёрный, я человек");

    const publicPaludan = countries
      .find((country) => country.id === "denmark")
      ?.writers.find((writer) => writer.id === "jacob_paludan");
    const bookSourcePaludan = bookArchiveCountries
      .find((country) => country.id === "denmark")
      ?.writers.find((writer) => writer.id === "jacob_paludan");
    expect(publicPaludan?.works).toEqual([
      "Fugle omkring Fyret",
      "Markerne modnes",
      "Jørgen Stein",
    ]);
    expect(bookSourcePaludan?.works).toEqual(["Жюль Верн"]);

    const publicMontalvo = countries
      .find((country) => country.id === "ecuador")
      ?.writers.find((writer) => writer.id === "juan_montalvo");
    const bookSourceMontalvo = bookArchiveCountries
      .find((country) => country.id === "ecuador")
      ?.writers.find((writer) => writer.id === "juan_montalvo");
    expect(publicMontalvo?.works).not.toContain("Космополитическая геометрия");
    expect(bookSourceMontalvo?.works).toContain("Космополитическая геометрия");

    const publicSylvain = countries
      .find((country) => country.id === "republic_of_congo")
      ?.writers.find((writer) => writer.id === "sylvain_bemba");
    const bookSourceSylvain = bookArchiveCountries
      .find((country) => country.id === "republic_of_congo")
      ?.writers.find((writer) => writer.id === "sylvain_bemba");
    expect(publicSylvain?.works).toEqual([
      "Le Soleil est parti à M’Pemba",
      "L’Homme qui tua le crocodile",
    ]);
    expect(bookSourceSylvain?.works).toEqual([]);

    const publicLupe = countries
      .find((country) => country.id === "ecuador")
      ?.writers.find((writer) => writer.id === "lupe_rumazo");
    const bookSourceLupe = bookArchiveCountries
      .find((country) => country.id === "ecuador")
      ?.writers.find((writer) => writer.id === "lupe_rumazo");
    expect(publicLupe).toMatchObject({
      years: "1933–",
      birthDate: "1933-10-14",
      deathDate: "",
      works: ["Carta larga sin final", "Peste blanca, peste negra"],
    });
    expect(bookSourceLupe).toMatchObject({
      years: "1904–2004",
      birthDate: "1904-10-14",
      deathDate: "2004-01-21",
    });
  });

  it("keeps the canonical book queue unchanged while risky writers stay hidden", () => {
    const archive = buildBookArchive(bookArchiveCountries);
    const publicArchive = buildPublicBookArchive(bookArchiveCountries);
    const publicWriterKeys = new Set(
      countries.flatMap((country) =>
        country.writers.map((writer) => key(country.id, writer.id))
      )
    );
    const booksWhoseWriterCardIsQuarantined = archive.filter(
      (book) => !publicWriterKeys.has(key(book.countryId, book.writerId))
    );
    const publicTargets = archive.map((book) =>
      resolveBookArchivePublicTarget(countries, book)
    );

    expect(archive).toHaveLength(9_712);
    expect(publicArchive).toHaveLength(31);
    expect(archive.filter((book) => !isPublicBook(book))).toHaveLength(9_681);
    expect(booksWhoseWriterCardIsQuarantined).toHaveLength(40);
    expect(booksWhoseWriterCardIsQuarantined.every((book) => !isPublicBook(book))).toBe(
      true
    );
    expect(publicTargets.filter((target) => !target)).toHaveLength(40);
    expect(
      publicTargets
        .filter((target) => target)
        .every((target) =>
          publicWriterKeys.has(key(target!.country.id, target!.writer!.id))
        )
    ).toBe(true);
    expect(
      booksWhoseWriterCardIsQuarantined.map(
        (book) => `${book.countryId}:${book.writerId}:${book.id}`
      )
    ).toContain(
      "argentina:adolfo_perez_zelas:legacy-adolfo_perez_zelas-изобретение-мореля"
    );
  });
});
