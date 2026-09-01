import { describe, expect, it } from "vitest";

import { countries } from "./index";
import curatedWriterQids from "./generated/curatedWriterQids.generated.json";
import { quarantinedWriterPortraitKeys } from "./generated/writerPortraits";

const registry = curatedWriterQids.writers as Record<
  string,
  { wikidataId: string; sourceUrl: string; checkedAt: string }
>;

const correctedMappings = {
  "australia:les_murray": { oldQid: "Q6529770", newQid: "Q259841" },
  "dominican_republic:juan_bosch": {
    oldQid: "Q1710380",
    newQid: "Q439980",
  },
  "england:t_s_eliot": { oldQid: "Q3261882", newQid: "Q37767" },
  "finland:fredrika_bremer": { oldQid: "Q465687", newQid: "Q262145" },
  "myanmar:ma_ma_lay": { oldQid: "Q56254273", newQid: "Q6273845" },
  "sweden:hjalmar_soderberg": {
    oldQid: "Q49099212",
    newQid: "Q331845",
  },
} as const;

const removedFalseMappings = {
  "antigua_and_barbuda:alison_hughes": "Q3611840",
  "eritrea:khaled_abdalla": "Q55389631",
  "liberia:sylvester_williams": "Q7660842",
  "maldives:abdulla_sodiq": "Q17198026",
  "cameroon:jean_roger_essomba": "Q95950701",
  "chad:ahmat_taboye": "Q3656879",
  "fiji:satendra_nandan": "Q7426104",
} as const;

function writerByKey(key: string) {
  const [countryId, writerId] = key.split(":");
  return countries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

describe("curated writer identity registry", () => {
  it.each(Object.entries(correctedMappings))(
    "maps %s to the corrected person",
    (key, { oldQid, newQid }) => {
      expect(registry[key].wikidataId).toBe(newQid);
      expect(registry[key].sourceUrl).toBe(
        `https://www.wikidata.org/wiki/${newQid}`
      );
      const writer = writerByKey(key);
      expect(quarantinedWriterPortraitKeys.has(key)).toBe(false);
      expect(writer?.portrait || "").not.toContain(oldQid.toLocaleLowerCase());
      expect(writer?.portraitSourceUrl || "").not.toContain(oldQid);
    }
  );

  it.each(Object.entries(removedFalseMappings))(
    "does not retain the false mapping %s -> %s",
    (key, falseQid) => {
      expect(registry[key]).toBeUndefined();
      expect(quarantinedWriterPortraitKeys.has(key)).toBe(false);
      const writer = writerByKey(key);
      expect(writer?.portrait || "").not.toContain(falseQid.toLowerCase());
      expect(writer?.portraitSourceUrl || "").not.toContain(falseQid);
    }
  );

  it("keeps Santiago Gamboa's exact identity while rejecting Wikidata's conflicting birth year", () => {
    const key = "colombia:santiago_gamboa";
    expect(registry[key].wikidataId).toBe("Q2420039");
    expect(quarantinedWriterPortraitKeys.has(key)).toBe(false);
    expect(writerByKey(key)?.birthDate).toBe("1965-12-30");
  });

  it("moves Virgilio de Lemos's exact identity from Cape Verde to Mozambique", () => {
    expect(registry["cape_verde:virgilio_de_lemos"]).toBeUndefined();
    expect(registry["mozambique:virgilio_de_lemos"]?.wikidataId).toBe(
      "Q63711389"
    );
    expect(writerByKey("cape_verde:virgilio_de_lemos")).toBeUndefined();
    expect(writerByKey("mozambique:virgilio_de_lemos")).toMatchObject({
      fullName: "Virgílio de Lemos",
      birthPlace: "остров Ибо, Мозамбик",
    });
  });

  it("moves Sylvain Bemba's exact identity to the Republic of the Congo", () => {
    expect(
      registry["democratic_republic_of_congo:sylvain_bemba"]
    ).toBeUndefined();
    expect(registry["republic_of_congo:sylvain_bemba"]?.wikidataId).toBe(
      "Q2373966"
    );
    expect(
      writerByKey("democratic_republic_of_congo:sylvain_bemba")
    ).toBeUndefined();
    expect(writerByKey("republic_of_congo:sylvain_bemba")).toMatchObject({
      fullName: "Sylvain Bemba",
      birthPlace: "Сибити, Республика Конго",
    });
  });

  it("keeps generated provenance synchronized with repaired records", () => {
    const latestEntryDates = Object.values(registry)
      .map((entry) => entry.checkedAt)
      .sort();
    const latestEntryDate = latestEntryDates[latestEntryDates.length - 1];

    expect(curatedWriterQids.generatedAt.slice(0, 10)).toBe(latestEntryDate);
  });
});
