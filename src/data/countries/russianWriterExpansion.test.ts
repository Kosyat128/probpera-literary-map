import { describe, expect, it } from "vitest";

import {
  countBiographySentences,
  selectWriterBiography,
} from "../writerBiography";
import { countries } from "./index";
import { russianWriterExpansion } from "./russianWriterExpansion";

const russianInstitutionalHost =
  /(?:^|\.)(?:bigenc|prlib|culture|nlr|rsl|imli|pushkinmuseum|museum-xxvek|rgakfd)\.ru$/iu;

describe("verified Russian writer expansion", () => {
  it("adds twelve distinct canonical authors with publication-ready Russian copy", () => {
    expect(russianWriterExpansion).toHaveLength(12);
    expect(new Set(russianWriterExpansion.map((writer) => writer.id)).size).toBe(
      12
    );

    for (const writer of russianWriterExpansion) {
      const translation = selectWriterBiography(writer, "ru");
      expect(translation, writer.id).not.toBeNull();
      expect(translation?.text, writer.id).toBe(writer.bio);
      expect(countBiographySentences(translation?.text || ""), writer.id).toBe(2);
      expect(translation?.text.length, writer.id).toBeGreaterThanOrEqual(120);
      expect(translation?.sources, writer.id).toHaveLength(1);
      expect(new URL(translation!.sources[0]!.url).hostname, writer.id).toMatch(
        russianInstitutionalHost
      );
      expect(translation?.method, writer.id).toBe("editorial-original");
      expect(translation?.status, writer.id).toBe("verified");
      expect(translation?.sourceTextRights, writer.id).toBe(
        "project-original"
      );
      expect(translation?.reviewedAt, writer.id).toBe("2026-08-31");
    }
  });

  it("keeps an independent second Russian institutional source for factual QA", () => {
    for (const writer of russianWriterExpansion) {
      const evidence = writer.editorial?.sources || [];
      const hostnames = new Set(
        evidence.map((source) => new URL(source.url).hostname.toLowerCase())
      );
      expect(evidence.length, writer.id).toBeGreaterThanOrEqual(2);
      expect(hostnames.size, writer.id).toBeGreaterThanOrEqual(2);
      for (const source of evidence) {
        expect(new URL(source.url).hostname, writer.id).toMatch(
          russianInstitutionalHost
        );
      }
    }
  });

  it("survives the full public merge without CMS suppression", () => {
    const publicRussia = countries.find((country) => country.id === "russia");
    expect(publicRussia).toBeDefined();

    for (const sourceWriter of russianWriterExpansion) {
      const publicWriter = publicRussia?.writers.find(
        (writer) => writer.id === sourceWriter.id
      );
      expect(publicWriter, sourceWriter.id).toBeDefined();
      expect(selectWriterBiography(publicWriter!, "ru")?.text).toBe(
        sourceWriter.bio
      );
      expect(
        selectWriterBiography(publicWriter!, "ru")?.sources[0]?.url
      ).toBe(sourceWriter.biographyTranslations?.ru?.sources[0]?.url);
    }
  });
});
