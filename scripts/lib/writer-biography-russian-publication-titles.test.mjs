import { describe, expect, it } from "vitest";

import {
  applyCataloguedRussianPublicationTitles,
  russianPublicationTitleApplicationIssues,
  russianPublicationTitleEntriesForKey,
  writerBiographyRussianPublicationTitles,
} from "./writer-biography-russian-publication-titles.mjs";

describe("catalogued Russian publication titles", () => {
  it("keeps every mapping tied to one exact Russian edition record", () => {
    expect(writerBiographyRussianPublicationTitles).toHaveLength(109);
    expect(
      writerBiographyRussianPublicationTitles.every(
        (entry) =>
          entry.status === "russian-edition-attested" &&
          [
            "translated-edition-record",
            "translated-edition-contents",
            "original-title-linked",
            "official-publisher-edition",
          ].includes(entry.attestationType) &&
          entry.evidence.fields.join(",") === "works" &&
          /^https:\/\/(?:search\.rsl\.ru\/ru\/record\/\d+|rusneb\.ru\/catalog\/.+|nlr\.ru\/.+\.pdf|ast\.ru\/.+|phantom-press\.ru\/.+|samokatbook\.ru\/book\/.+|azbooka\.ru\/books\/.+|eksmo\.ru\/.+|sindbadbooks\.ru\/index\.php.+)$/u.test(
            entry.recordUrl,
          ),
      ),
    ).toBe(true);
  });

  it("replaces only exact quoted titles for the selected writer", () => {
    const source =
      "Автор «The Sun Also Rises», «A Farewell to Arms» и «The Old Man and the Sea». The Sun Also Rises упомянут вне названия.";
    const localized = applyCataloguedRussianPublicationTitles(
      "usa:ernest_hemingway",
      source,
    );

    expect(localized).toBe(
      "Автор «Фиеста (И восходит солнце)», «Прощай, оружие!» и «Старик и море». The Sun Also Rises упомянут вне названия.",
    );
    expect(
      russianPublicationTitleApplicationIssues(
        "usa:ernest_hemingway",
        source,
        localized,
      ),
    ).toEqual([]);
  });

  it("leaves writers without verified Russian-edition mappings untouched", () => {
    const source = "Автор романа «Uncatalogued title».";
    expect(applyCataloguedRussianPublicationTitles("test:writer", source)).toBe(
      source,
    );
    expect(russianPublicationTitleEntriesForKey("test:writer")).toEqual([]);
  });

  it("records catalogue spelling aliases without weakening exact replacement", () => {
    const [entry] = russianPublicationTitleEntriesForKey(
      "sweden:stieg_larsson",
    );
    expect(entry).toMatchObject({
      sourceTitleExact: "Män som hatar kvinnor",
      catalogTitleRu: "Девушка с татуировкой дракона",
      evidenceAlias: "Man som hatar kvinnor",
    });
    expect(
      applyCataloguedRussianPublicationTitles(
        "sweden:stieg_larsson",
        "Автор романа «Man som hatar kvinnor».",
      ),
    ).toBe("Автор романа «Man som hatar kvinnor».");
  });

  it("fails the application audit when an attested occurrence disappears", () => {
    expect(
      russianPublicationTitleApplicationIssues(
        "usa:daniel_keyes",
        "Автор «The Minds of Billy Milligan».",
        "Автор «Таинственная история Билли Миллигана».",
      ),
    ).toContain(
      "Flowers for Algernon: expected 2 quoted occurrence(s), found 0",
    );
  });
});
