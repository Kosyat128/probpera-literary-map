import { readFileSync } from "node:fs";
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
  writerBiographyPublicProfileFactCorrectionsBatch32,
} from "./writerBiographyPublicProfileFactCorrectionsBatch32";
import {
  writerBiographyPublicProfileFactCorrectionsBatch33,
} from "./writerBiographyPublicProfileFactCorrectionsBatch33";
import {
  writerBiographyPublicProfileFactCorrectionsBatch34,
} from "./writerBiographyPublicProfileFactCorrectionsBatch34";
import {
  writerBiographyPublicProfileFactCorrectionsBatch35,
} from "./writerBiographyPublicProfileFactCorrectionsBatch35";
import {
  writerBiographyPublicProfileFactCorrectionsBatch36,
} from "./writerBiographyPublicProfileFactCorrectionsBatch36";
import {
  writerBiographyPublicProfileFactCorrectionsBatch37,
} from "./writerBiographyPublicProfileFactCorrectionsBatch37";
import {
  writerBiographyPublicProfileFactCorrectionsBatch38,
} from "./writerBiographyPublicProfileFactCorrectionsBatch38";
import {
  writerBiographyPublicProfileFactCorrectionsBatch39,
} from "./writerBiographyPublicProfileFactCorrectionsBatch39";
import {
  writerBiographyPublicProfileFactCorrectionsBatch40,
} from "./writerBiographyPublicProfileFactCorrectionsBatch40";
import {
  writerBiographyPublicProfileFactCorrectionsBatch41,
} from "./writerBiographyPublicProfileFactCorrectionsBatch41";
import {
  writerBiographyPublicProfileFactCorrectionsBatch42,
} from "./writerBiographyPublicProfileFactCorrectionsBatch42";
import {
  writerBiographyPublicProfileFactCorrectionsBatch43,
} from "./writerBiographyPublicProfileFactCorrectionsBatch43";
import {
  writerBiographyPublicProfileFactCorrectionsBatch44,
} from "./writerBiographyPublicProfileFactCorrectionsBatch44";
import {
  writerBiographyPublicProfileFactCorrectionsBatch45,
} from "./writerBiographyPublicProfileFactCorrectionsBatch45";
import {
  writerBiographyPublicProfileFactCorrectionsBatch46,
} from "./writerBiographyPublicProfileFactCorrectionsBatch46";
import {
  writerBiographyPublicProfileFactCorrectionsBatch47,
} from "./writerBiographyPublicProfileFactCorrectionsBatch47";
import {
  writerBiographyPublicProfileFactCorrectionsBatch48,
} from "./writerBiographyPublicProfileFactCorrectionsBatch48";
import {
  writerBiographyPublicProfileFactCorrectionsBatch49,
} from "./writerBiographyPublicProfileFactCorrectionsBatch49";
import {
  writerBiographyPublicProfileFactCorrectionsBatch50,
} from "./writerBiographyPublicProfileFactCorrectionsBatch50";
import {
  writerBiographyPublicProfileFactCorrectionsBatch51,
} from "./writerBiographyPublicProfileFactCorrectionsBatch51";
import {
  writerBiographyPublicProfileFactCorrectionsBatch52,
} from "./writerBiographyPublicProfileFactCorrectionsBatch52";
import {
  writerBiographyPublicProfileFactCorrectionsBatch53,
} from "./writerBiographyPublicProfileFactCorrectionsBatch53";
import {
  writerBiographyPublicProfileFactCorrectionsBatch54,
} from "./writerBiographyPublicProfileFactCorrectionsBatch54";
import {
  writerBiographyPublicProfileFactCorrectionsBatch55,
} from "./writerBiographyPublicProfileFactCorrectionsBatch55";
import {
  writerBiographyPublicProfileFactCorrectionsBatch56,
} from "./writerBiographyPublicProfileFactCorrectionsBatch56";
import {
  writerBiographyPublicProfileFactCorrectionsBatch57,
} from "./writerBiographyPublicProfileFactCorrectionsBatch57";
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

function expectProfilePatch(
  actual: Country["writers"][number] | undefined,
  patch: Partial<Country["writers"][number]>,
  label: string
) {
  const { works, ...scalarPatch } = patch;
  expect(actual, label).toMatchObject(scalarPatch);
  if (works) {
    expect(actual?.works, label).toEqual(expect.arrayContaining([...works]));
  }
}

describe("legacy writer biography curation", () => {
  it("keeps detailed fact reviews outside the public profile runtime boundary", () => {
    const runtimeSources = [
      "writerBiographyPublicProfileFactCorrectionsBatch32.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch33.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch34.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch35.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch36.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch37.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch38.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch39.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch40.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch41.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch42.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch43.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch44.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch45.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch46.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch47.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch48.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch49.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch50.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch51.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch52.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch53.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch54.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch55.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch56.ts",
      "writerBiographyPublicProfileFactCorrectionsBatch57.ts",
      "writerBiographyLegacyCorrections.ts",
    ].map((fileName) =>
      readFileSync(new URL(fileName, import.meta.url), "utf8")
    );

    for (const source of runtimeSources) {
      expect(source).not.toMatch(/writerBiographyFactReviewBatch(?:32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57)/);
    }
  });

  it("keeps the manually sourced correction queue exact and auditable", () => {
    expect(writerBiographyLegacyCorrections).toHaveLength(55);
    expect(quarantinedWriterIdentities).toHaveLength(97);
    expect(writerIdentityCorrections).toHaveLength(2);
    expect(writerPublicProfileFactCorrections).toHaveLength(755);
    expect(writerBiographyPublicProfileFactCorrectionsBatch32).toHaveLength(34);
    expect(writerBiographyPublicProfileFactCorrectionsBatch33).toHaveLength(14);
    expect(writerBiographyPublicProfileFactCorrectionsBatch34).toHaveLength(17);
    expect(writerBiographyPublicProfileFactCorrectionsBatch35).toHaveLength(32);
    expect(writerBiographyPublicProfileFactCorrectionsBatch36).toHaveLength(35);
    expect(writerBiographyPublicProfileFactCorrectionsBatch37).toHaveLength(31);
    expect(writerBiographyPublicProfileFactCorrectionsBatch38).toHaveLength(20);
    expect(writerBiographyPublicProfileFactCorrectionsBatch39).toHaveLength(39);
    expect(writerBiographyPublicProfileFactCorrectionsBatch40).toHaveLength(39);
    expect(writerBiographyPublicProfileFactCorrectionsBatch41).toHaveLength(36);
    expect(writerBiographyPublicProfileFactCorrectionsBatch42).toHaveLength(38);
    expect(writerBiographyPublicProfileFactCorrectionsBatch43).toHaveLength(37);
    expect(writerBiographyPublicProfileFactCorrectionsBatch44).toHaveLength(40);
    expect(writerBiographyPublicProfileFactCorrectionsBatch45).toHaveLength(37);
    expect(writerBiographyPublicProfileFactCorrectionsBatch46).toHaveLength(5);
    expect(writerBiographyPublicProfileFactCorrectionsBatch47).toHaveLength(14);
    expect(writerBiographyPublicProfileFactCorrectionsBatch48).toHaveLength(12);
    expect(writerBiographyPublicProfileFactCorrectionsBatch49).toHaveLength(14);
    expect(writerBiographyPublicProfileFactCorrectionsBatch50).toHaveLength(31);
    expect(writerBiographyPublicProfileFactCorrectionsBatch51).toHaveLength(11);
    expect(writerBiographyPublicProfileFactCorrectionsBatch52).toHaveLength(31);
    expect(writerBiographyPublicProfileFactCorrectionsBatch53).toHaveLength(29);
    expect(writerBiographyPublicProfileFactCorrectionsBatch54).toHaveLength(29);
    expect(writerBiographyPublicProfileFactCorrectionsBatch55).toHaveLength(32);
    expect(writerBiographyPublicProfileFactCorrectionsBatch56).toHaveLength(28);
    expect(writerBiographyPublicProfileFactCorrectionsBatch57).toHaveLength(19);

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

  it("publishes the source-backed batch 29 profile corrections only on writer cards", () => {
    const publicDamas = countries
      .find((country) => country.id === "french_guiana")
      ?.writers.find((writer) => writer.id === "leon_gontran_damas");
    const publicTabidze = countries
      .find((country) => country.id === "georgia")
      ?.writers.find((writer) => writer.id === "galaktion_tabidze");
    const bookDamas = bookArchiveCountries
      .find((country) => country.id === "french_guiana")
      ?.writers.find((writer) => writer.id === "leon_gontran_damas");
    const bookTabidze = bookArchiveCountries
      .find((country) => country.id === "georgia")
      ?.writers.find((writer) => writer.id === "galaktion_tabidze");

    expect(publicDamas?.name).toBe("Леон-Гонтран Дамас");
    expect(publicTabidze).toMatchObject({
      years: "1891-1959",
      birthDate: "1891-11-17",
    });
    expect(bookDamas?.name).toBe("Леон-Гонтан Дамас");
    expect(bookTabidze).toMatchObject({
      years: "1892-1959",
      birthDate: "1892-11-17",
    });
  });

  it("publishes batch 30 profile facts only on writer cards and preserves the book source", () => {
    const publicWriters = new Map(
      countries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const bookWriters = new Map(
      bookArchiveCountries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );

    expect(publicWriters.get("ghana:ama_ata_aidoo")).toMatchObject({
      name: "Ама Ата Айду",
      birthDate: "1942-03-23",
    });
    expect(publicWriters.get("ghana:joseph_casely_hayford")).toMatchObject({
      name: "Джозеф Эфраим Кейсли-Хейфорд",
      birthDate: "1866",
      deathDate: "1930-08-11",
    });
    expect(publicWriters.get("germany:sebastian_brant")).toMatchObject({
      years: "1458-1521",
      birthDate: "1458",
    });
    expect(publicWriters.get("ghana:martin_egblewogbe")?.birthDate).toBe(
      "1975"
    );
    expect(publicWriters.get("ghana:nii_ayikwei_parkes")?.birthDate).toBe(
      "1974"
    );
    expect(publicWriters.get("greece:andreas_kalvos")?.birthDate).toBe("1792");
    expect(publicWriters.get("grenada:george_brizan")).toMatchObject({
      birthDate: "1942-10-31",
      deathDate: "2012",
    });
    expect(
      publicWriters.get("guatemala:francisco_alejandro_mendez")
    ).toMatchObject({
      years: "1964-2026",
      deathDate: "2026-03-28",
    });

    expect(bookWriters.get("ghana:ama_ata_aidoo")?.name).toBe(
      "Амма Ата Айду"
    );
    expect(bookWriters.get("ghana:joseph_casely_hayford")).toMatchObject({
      name: "Джозеф Эфуа Кейсели Хейфорд",
      birthDate: "1866-05-24",
      deathDate: "1930-01-15",
    });
    expect(bookWriters.get("germany:sebastian_brant")).toMatchObject({
      years: "1457-1521",
      birthDate: "1457",
    });
    expect(bookWriters.get("ghana:martin_egblewogbe")?.birthDate).toBe(
      "1975-01-01"
    );
    expect(bookWriters.get("ghana:nii_ayikwei_parkes")?.birthDate).toBe(
      "1974-01-01"
    );
    expect(bookWriters.get("greece:andreas_kalvos")?.birthDate).toBe(
      "1792-05-01"
    );
    expect(bookWriters.get("grenada:george_brizan")).toMatchObject({
      birthDate: "1942-01-01",
      deathDate: "2012-01-01",
    });
    expect(bookWriters.get("guatemala:francisco_alejandro_mendez")).toMatchObject({
      years: "1964-",
    });
    expect(
      bookWriters.get("guatemala:francisco_alejandro_mendez")?.deathDate
    ).toBeUndefined();
  });

  it("publishes batch 31 profile facts only on writer cards and quarantines unresolved identities", () => {
    const publicWriters = new Map(
      countries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const bookWriters = new Map(
      bookArchiveCountries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );

    expect(publicWriters.get("guatemala:luis_cardoza_y_aragon")?.birthPlace).toBe(
      "Антигуа-Гватемала, Гватемала"
    );
    expect(publicWriters.get("guatemala:rodrigo_rey_rosa")?.birthDate).toBe(
      "1958-11-04"
    );
    expect(publicWriters.get("guinea_bissau:abdulai_sila")).toMatchObject({
      birthDate: "1958-04-01",
      birthPlace: "Катио, Гвинея-Бисау",
    });
    expect(publicWriters.get("guyana:cyril_dabydeen")?.birthDate).toBe("1945");
    expect(publicWriters.get("guyana:wilson_harris")?.deathPlace).toBe(
      "Челмсфорд, Англия"
    );
    expect(publicWriters.get("haiti:franketienne")).toMatchObject({
      years: "1936-2025",
      deathDate: "2025-02-20",
      birthPlace: "Равин-Сеш, Артибонит, Гаити",
      deathPlace: "Дельма, Гаити",
    });
    expect(publicWriters.get("haiti:jacques_stephen_alexis")).toMatchObject({
      deathDate: "1961",
      birthPlace: "Гонаив, Гаити",
    });
    expect(publicWriters.get("honduras:juan_ramon_molina")?.birthPlace).toBe(
      "Комаягуэла, Гондурас"
    );
    expect(publicWriters.get("hong_kong:xi_xi")).toMatchObject({
      name: "Си Си",
      birthDate: "1937-10-07",
    });
    expect(publicWriters.get("hungary:imre_madach")?.birthDate).toBe(
      "1823-01-20"
    );
    expect(publicWriters.get("iceland:steinn_steinarr")?.birthPlace).toBe(
      "Лёйгаланд, близ Кальдалона, Исландия"
    );
    expect(publicWriters.get("india:amit_chaudhuri")).toMatchObject({
      name: "Амит Чаудхури",
      fullName: "Amit Chaudhuri",
    });
    expect(publicWriters.has("guinea_bissau:antonio_aurelio_gomes")).toBe(false);
    expect(publicWriters.has("guyana:roshni_kempadoo")).toBe(false);

    expect(bookWriters.get("guatemala:luis_cardoza_y_aragon")?.birthPlace).toBe(
      "Гватемала, Гватемала"
    );
    expect(bookWriters.get("guatemala:rodrigo_rey_rosa")?.birthDate).toBe(
      "1958-02-04"
    );
    expect(bookWriters.get("guinea_bissau:abdulai_sila")).toMatchObject({
      birthDate: "1958",
      birthPlace: "Бисау, Гвинея-Бисау",
    });
    expect(bookWriters.get("guyana:cyril_dabydeen")?.birthDate).toBe(
      "1945-09-05"
    );
    expect(bookWriters.get("guyana:wilson_harris")?.deathPlace).toBe(
      "Уорикшир, Великобритания"
    );
    expect(bookWriters.get("haiti:franketienne")).toMatchObject({
      years: "1936-2024",
      deathDate: "2024-02-20",
      birthPlace: "Розо, Гаити",
      deathPlace: "Порт-о-Пренс, Гаити",
    });
    expect(bookWriters.get("haiti:jacques_stephen_alexis")).toMatchObject({
      deathDate: "1961-04-22",
      birthPlace: "Гонав, Гаити",
    });
    expect(bookWriters.get("hong_kong:xi_xi")).toMatchObject({
      name: "Сянь Юй",
      birthDate: "1937-10-08",
    });
    expect(bookWriters.get("hungary:imre_madach")?.birthDate).toBe(
      "1823-01-21"
    );
    expect(bookWriters.get("iceland:steinn_steinarr")?.birthPlace).toBe("Олвюсау");
    expect(bookWriters.get("india:amit_chaudhuri")?.name).toBe("Амита Чоудхури");
  });

  it("publishes compact source-backed batch 32 profile patches without mutating the book source", () => {
    const publicWriters = new Map(
      countries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const bookWriters = new Map(
      bookArchiveCountries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const batchKeys = writerBiographyPublicProfileFactCorrectionsBatch32.map(
      (item) => key(item.countryId, item.writerId)
    );

    expect(new Set(batchKeys).size).toBe(batchKeys.length);
    for (const item of writerBiographyPublicProfileFactCorrectionsBatch32) {
      const itemKey = key(item.countryId, item.writerId);
      const hosts = new Set(
        item.evidence.map((source) => new URL(source.url).host)
      );
      expect(item.evidence.length, itemKey).toBeGreaterThanOrEqual(2);
      expect(hosts.size, itemKey).toBeGreaterThanOrEqual(2);
      expect(
        item.evidence.every(
          (source) =>
            source.checkedAt === "2026-08-11" &&
            source.url.startsWith("https://")
        ),
        itemKey
      ).toBe(true);
    }

    for (const item of writerBiographyPublicProfileFactCorrectionsBatch32) {
      const itemKey = key(item.countryId, item.writerId);
      expectProfilePatch(publicWriters.get(itemKey), item.patch, itemKey);
    }

    expect(publicWriters.get("india:anil_menon")).toMatchObject({
      years: "",
      birthDate: "",
      birthPlace: "",
      works: ["The Beast with Nine Billion Feet", "Half of What I Say"],
    });
    expect(publicWriters.get("india:geetanjali_shree")).toMatchObject({
      birthDate: "1957",
      birthPlace: "Майнпури, Уттар-Прадеш, Индия",
      coordinates: undefined,
    });
    expect(publicWriters.get("india:kalidasa")).toMatchObject({
      years: "ок. IV-V век",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
    });
    expect(publicWriters.get("india:r_k_narayan")).toMatchObject({
      fullName: "Rasipuram Krishnaswami Narayan",
      birthPlace: "Мадрас (ныне Ченнаи), Британская Индия",
      works: ["Свами и его друзья", "Дни Мальгуди", "Гид"],
      awards: ["Премия Сахитья Академи 1960 года за роман «Гид»"],
    });
    expect(publicWriters.get("iran:ferdowsi")).toMatchObject({
      years: "ок. 940 - ок. 1020",
      birthDate: "ок. 940",
      deathDate: "ок. 1020",
    });

    expect(bookWriters.get("india:anil_menon")).toMatchObject({
      years: "1970-",
      birthDate: "1970",
      birthPlace: "Индия",
      works: ["The Beast With Nine Billion Feet", "Half of What I Say"],
    });
    expect(bookWriters.get("india:geetanjali_shree")).toMatchObject({
      birthDate: "1957-06-12",
      birthPlace: "Манипури, Индия",
      coordinates: { lat: 26.8467, lng: 80.9462 },
    });
    expect(bookWriters.get("india:kalidasa")).toMatchObject({
      birthDate: "IV-V век",
      deathDate: "V век",
      birthPlace: "Индия",
      deathPlace: "Индия",
    });
    expect(bookWriters.get("india:r_k_narayan")).toMatchObject({
      birthPlace: "Ченнаи, Индия",
      works: ["Свами и его друзья", "Малгуди", "Гид"],
      awards: ["Премия Сахитья Академи 1958 года"],
    });
    expect(bookWriters.get("iran:ferdowsi")).toMatchObject({
      years: "ок. 940-1020",
      birthDate: "0940-01-01",
      deathDate: "1020-01-01",
    });
  });

  it("publishes compact source-backed profile patches for batches 33-35", () => {
    const publicWriters = new Map(
      countries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const corrections = [
      ...writerBiographyPublicProfileFactCorrectionsBatch33,
      ...writerBiographyPublicProfileFactCorrectionsBatch34,
      ...writerBiographyPublicProfileFactCorrectionsBatch35,
    ];
    const correctionKeys = corrections.map((item) =>
      key(item.countryId, item.writerId)
    );

    expect(corrections).toHaveLength(63);
    expect(new Set(correctionKeys).size).toBe(correctionKeys.length);
    for (const item of corrections) {
      const itemKey = key(item.countryId, item.writerId);
      const hosts = new Set(
        item.evidence.map((source) => new URL(source.url).host)
      );
      expect(item.evidence.length, itemKey).toBeGreaterThanOrEqual(2);
      expect(hosts.size, itemKey).toBeGreaterThanOrEqual(2);
      expect(
        item.evidence.every(
          (source) =>
            source.checkedAt === "2026-08-11" &&
            source.url.startsWith("https://")
        ),
        itemKey
      ).toBe(true);
      expectProfilePatch(publicWriters.get(itemKey), item.patch, itemKey);
    }

    expect(publicWriters.get("iran:shahrnush_parsipur")).toMatchObject({
      years: "1946-2026",
      deathDate: "2026-07-03",
    });
    expect(publicWriters.get("japan:keigo_higashino")).toMatchObject({
      years: "1958-2026",
      deathDate: "2026-07-23",
    });
  });

  it("publishes compact source-backed profile patches for batches 36-57", () => {
    const publicWriters = new Map(
      countries.flatMap((country) =>
        country.writers.map((writer) => [key(country.id, writer.id), writer])
      )
    );
    const batches = [
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch36,
        checkedAt: "2026-08-11",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch37,
        checkedAt: "2026-08-12",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch38,
        checkedAt: "2026-08-13",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch39,
        checkedAt: "2026-08-14",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch40,
        checkedAt: "2026-08-14",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch41,
        checkedAt: "2026-08-14",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch42,
        checkedAt: "2026-08-20",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch43,
        checkedAt: "2026-08-20",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch44,
        checkedAt: "2026-08-21",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch45,
        checkedAt: "2026-08-21",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch46,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch47,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch48,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch49,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch50,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch51,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch52,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch53,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch54,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch55,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch56,
        checkedAt: "2026-08-30",
      },
      {
        corrections: writerBiographyPublicProfileFactCorrectionsBatch57,
        checkedAt: "2026-08-30",
      },
    ] as const;

    for (const batch of batches) {
      const correctionKeys = batch.corrections.map((item) =>
        key(item.countryId, item.writerId)
      );
      expect(new Set(correctionKeys).size).toBe(correctionKeys.length);
      for (const item of batch.corrections) {
        const itemKey = key(item.countryId, item.writerId);
        const hosts = new Set(
          item.evidence.map((source) => new URL(source.url).host)
        );
        expect(item.evidence.length, itemKey).toBeGreaterThanOrEqual(2);
        expect(hosts.size, itemKey).toBeGreaterThanOrEqual(2);
        expect(
          item.evidence.every(
            (source) =>
              source.checkedAt === batch.checkedAt &&
              source.url.startsWith("https://")
          ),
          itemKey
        ).toBe(true);
        expectProfilePatch(publicWriters.get(itemKey), item.patch, itemKey);
      }
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
      "Léopolis",
    ]);
    expect(bookSourceSylvain?.works).toEqual([]);

    const publicLupe = countries
      .find((country) => country.id === "ecuador")
      ?.writers.find((writer) => writer.id === "lupe_rumazo");
    const bookSourceLupe = bookArchiveCountries
      .find((country) => country.id === "ecuador")
      ?.writers.find((writer) => writer.id === "lupe_rumazo");
    expect(publicLupe).toMatchObject({
      years: "1933-",
      birthDate: "1933-10-14",
      deathDate: "",
      works: ["Carta larga sin final", "Peste blanca, peste negra"],
    });
    expect(bookSourceLupe).toMatchObject({
      years: "1904-2004",
      birthDate: "1904-10-14",
      deathDate: "2004-01-21",
    });
  });

  it("keeps the canonical book queue consistent while risky writers stay hidden", () => {
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

    expect(archive).toHaveLength(9_761);
    expect(publicArchive).toHaveLength(46);
    expect(archive.filter((book) => !isPublicBook(book))).toHaveLength(9_715);
    const bremerBooks = archive
      .filter(
        (book) =>
          book.countryId === "finland" && book.writerId === "fredrika_bremer"
      )
      .map((book) => book.title);
    expect(bremerBooks).toEqual(["Соседи", "Герта"]);
    expect(bremerBooks).not.toContain("Герцогиня Финляндская");
    expect(booksWhoseWriterCardIsQuarantined).toHaveLength(63);
    expect(booksWhoseWriterCardIsQuarantined.every((book) => !isPublicBook(book))).toBe(
      true
    );
    expect(publicTargets.filter((target) => !target)).toHaveLength(63);
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
