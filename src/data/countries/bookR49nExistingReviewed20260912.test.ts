import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import canonRegistry from "../../../data/book-canon-source-registry.json";
import { buildBookArchive } from "../bookArchive";
import { bookEvidenceV2Issues } from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries } from "./index";
import {
  applyBookR49nExistingReviewed20260912Work,
  bookR49nExistingReviewed20260912RecordKeys,
} from "./bookR49nExistingReviewed20260912";
import type { WorkDescriptionProvenanceProfile, WorkProfile } from "./types";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]))
    : value;
const objectHash = (value: unknown) => hash(JSON.stringify(canonical(value)));
const archive = buildBookArchive(bookArchiveCountries);
const keyOf = (book: { countryId: string; writerId: string; id: string }) =>
  `${book.countryId}:${book.writerId}:${book.id}`;

// Exact text, title and historical provenance expectations from the reviewed
// R49N MASTER, not hashes derived from the module being tested.
const expected = [
  {
    "key": "france:jules_verne:the-mysterious-island-editorial",
    "firstPublished": 1874,
    "titleEvidenceSha256": "4f0c404aff8c00825d806a738d41583aeac7dd6de8ea70cdcbeff4daf3e5ae19",
    "ruSha256": "5a0008f1b86f92473b3887b4e04b55ae659d1f44d7956e43bfe31b6be64991c2",
    "enSha256": "7ffb1e562098b35bbaf748fac14e690b911c38377597a8d6d86b481eb909468a",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://eksmo.ru/book/tainstvennyy-ostrov-ITD953417/"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.penguinrandomhouse.com/books/292932/the-mysterious-island-by-jules-verne/"
        ]
      }
    }
  },
  {
    "key": "france:jules_verne:openlibrary-works-ol1099513w",
    "firstPublished": 1864,
    "titleEvidenceSha256": "9dea3edca406499b76af12bc9e7266d52bfe8de5fe95fa9ce7d379f0dfdb6128",
    "ruSha256": "5254d8ff0b71996458a35494b2abf52048a05aa11bdfd45e9e224e019d0a32d7",
    "enSha256": "5eabf9c8e2bf36210e04225c46d60d03490d08cb135b68950e28265ff79db041",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.penguinrandomhouse.com/books/832262/journey-to-the-centre-of-the-earth-by-jules-verne/"
        ]
      }
    }
  },
  {
    "key": "france:jules_verne:openlibrary-works-ol1100007w",
    "firstPublished": 1872,
    "titleEvidenceSha256": "ec17c22711ef9876395d429c7e16fb0b7e870ba9e4df888d2d96b65bfe7f57d1",
    "ruSha256": "9c1f2fbe551a16d2791963fa9bfca39f278beb5b6204420aadfc506153301cbd",
    "enSha256": "d695f55d738aa5e72950dbc576a12311ac44d0c63834927169f32a178e8890a3",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://azbooka.ru/books/pyteshestvie-k-tsentry-zemli-vokryg-sveta-v-vosemdesyat-dney"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.penguinrandomhouse.com/books/832259/around-the-world-in-eighty-days-by-jules-verne/"
        ]
      }
    }
  },
  {
    "key": "france:jules_verne:openlibrary-works-ol1099280w",
    "firstPublished": 1869,
    "titleEvidenceSha256": "f64e4e6c41de82650493ec757502cdedcad95bb50db6c43951a12a92f9c82c58",
    "ruSha256": "2ae21cb68ec8e1e8b6d23f961e2e1d53b53661d97ccd894a1cfcbaf7d90c94ec",
    "enSha256": "f79bb2e87732e01ac6bad9e59b9925de5c9cb48c95e315af6cb70b6fd7114a99",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-840711/",
          "https://ast.ru/book/dvadtsat-tysyach-le-pod-vodoy-718086/"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.penguin.co.uk/books/259451/twenty-thousand-leagues-under-the-sea-by-jules-verne/9780241198773"
        ]
      }
    }
  },
  {
    "key": "france:jules_verne:openlibrary-works-ol1099479w",
    "firstPublished": 1865,
    "titleEvidenceSha256": "0c717f8cab224bd2bcfcf118440f1b9c82d5d97233e72d634f58f34ff66c1bbc",
    "ruSha256": "82e760cd558197bc35bf42851406ea5667e61996f82655776c0b6cf5faca7bd8",
    "enSha256": "39535cf6a0ec17dd2681ff716334727aea1ed7b48e8ae5c48322329da4fef859",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://ast.ru/book/s-zemli-na-lunu-vokrug-luny-873380/"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.simonandschuster.com/books/From-the-Earth-to-the-Moon-and-Around-the-Moon/Jules-Verne/The-Jules-Verne-Collection/9781665934244"
        ]
      }
    }
  },
  {
    "key": "france:jules_verne:openlibrary-works-ol1099630w",
    "firstPublished": 1904,
    "titleEvidenceSha256": "630e2ce3d06ba86a5d2d31c989fda905585c561b67a64cd787613f6c381b59eb",
    "ruSha256": "82f4f87742966325784fec58e5328bbfed981722ab88f95a1060beb109324d2e",
    "enSha256": "8796fe330be3ab2491d057c8e8b6c032b9d26bd3651575bd426980c6c011c097",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://azbooka.ru/books/plavychiy-ostrov-robyr-zavoevatel-vlastelin-mira-s-ill"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.simonandschuster.com/books/The-Master-of-the-World/Jules-Verne/Essential-Gothic-SF-Dark-Fantasy/9780857756909"
        ]
      }
    }
  },
  {
    "key": "france:jules_verne:openlibrary-works-ol1099364w",
    "firstPublished": 1865,
    "titleEvidenceSha256": "26ea1a96aab0b97ac9ee2b3466c7a3db4433b646bda262af171f379150287f8b",
    "ruSha256": "047f1ed3af62a10e20413e9c5c7aaece6b96e14b85b95b5fcb2cc10fff8a8e6c",
    "enSha256": "5a7c20c0733c96ec5bbca132804f01d7b8f1bde97f4bc95c78c4c1affe3c266a",
    "provenance": {
      "ru": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://ast.ru/book/deti-kapitana-granta-834206/",
          "https://ast.ru/book/deti-kapitana-granta-013140/"
        ]
      },
      "en": {
        "author": "Codex AI / review_ru_public_gaps",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.simonandschuster.com/books/In-Search-of-the-Castaways/Jules-Verne/The-Jules-Verne-Collection/9781665934350"
        ]
      }
    }
  },
  {
    "key": "russia:turgenev:article-series-men9bv",
    "firstPublished": 1867,
    "titleEvidenceSha256": "1314f26f1daf8d37267c544f0a05e2bc409946851452bd58bc8be62de9edfd25",
    "ruSha256": "e708813c30867d2799d794ac9af083481715dadb6e8c7cc0c6ee761393ee81c7",
    "enSha256": "90c7a8dbc22f5ecee08a82e90ca1bc204b829b85ed244562eeefe9e44544be06",
    "provenance": {
      "ru": {
        "author": "Codex AI / root and check_release",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex AI / research_white_guard (independent review)",
        "reviewedAt": "2026-09-04",
        "primarySourceUrls": [
          "https://rvb.ru/turgenev/01text/vol_07/01text/0191-02.htm",
          "https://rvb.ru/turgenev/02comm/0191.htm"
        ]
      },
      "en": {
        "author": "Codex AI / root and check_release",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex AI / research_white_guard (independent review)",
        "reviewedAt": "2026-09-04",
        "primarySourceUrls": [
          "https://www.nyrb.com/products/smoke-1"
        ]
      }
    }
  },
  {
    "key": "russia:buninin:the-village",
    "firstPublished": 1910,
    "titleEvidenceSha256": "e13c16f1c40823884632f510585dcd1ce1be4a3665ab0f2133b10a60ae162f30",
    "ruSha256": "189b37a2babc75d34112f0520a224de53f00445f7624d3e40b981cf9a4f5dc7a",
    "enSha256": "3fd12d92f88ef46aba60f209bdbe749d3f41a8debdc0676daad015f00fe5f21b",
    "provenance": {
      "ru": {
        "author": "Codex AI / root and check_release",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex AI / research_white_guard (independent review)",
        "reviewedAt": "2026-09-04",
        "primarySourceUrls": [
          "https://ar.culture.ru/ru/subject/derevnya",
          "https://feb-web.ru/feb/ivl/vl8/vl8-0542.htm?cmd=p"
        ]
      },
      "en": {
        "author": "Codex AI / root and check_release",
        "createdAt": "2026-09-04",
        "reviewedBy": "Codex AI / research_white_guard (independent review)",
        "reviewedAt": "2026-09-04",
        "primarySourceUrls": [
          "https://www.bloomsbury.com/uk/village-9781847492838/"
        ]
      }
    }
  },
  {
    "key": "russia:tolstoy:article-series-zqpjjm",
    "firstPublished": 1911,
    "titleEvidenceSha256": "fe720e89e798e193f6c26e5f9a132a6cfe46415921442da32ed649554e6cc321",
    "ruSha256": "48b5d6007f80fee70ce647d29ab0686c77b3cfdf167577585d01fff6305cf48b",
    "enSha256": "1c107df558180cf769feda1bd1d754d993d325078ffe3abfd891ae9fd9cfa5fa",
    "provenance": {
      "ru": {
        "author": "Редакция «Пробы Пера»",
        "createdAt": "2026-09-02",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://tolstoy.ru/online/90/34/"
        ]
      },
      "en": {
        "author": "Редакция «Пробы Пера»",
        "createdAt": "2026-09-02",
        "reviewedBy": "Codex AI /root (independent review)",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.penguin.co.uk/books/35513/the-death-of-ivan-ilyich-and-other-stories-by-leo-tolstoy-intro--anthony-briggs-edited-and-trans-by--anthony-briggs-edited-and-trans-by--ronald-wilks-edited-and-trans-by-david-mcduff/9780140449617"
        ]
      }
    }
  },
  {
    "key": "usa:jack_london:article-catalog-1hfivd6",
    "firstPublished": 1908,
    "titleEvidenceSha256": "54ed71fc584cf22f69549553cb860c2a3f025ed5caccae39fa8c3aaad85cae55",
    "ruSha256": "e8698e851ef01887b6e66344f039940f9e56ce5df2f6bef5791a320ffa916549",
    "enSha256": "2f3ed90a6f5840ade28f95e5701a4b20622cbb1b60b63207855c74a4e0432bec",
    "provenance": {
      "ru": {
        "author": "Codex AI / london_bilingual_batch",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI / review_ru_public_gaps",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://eksmo.ru/book/zheleznaya-pyata-ITD1421733/"
        ]
      },
      "en": {
        "author": "Codex AI / london_bilingual_batch",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI / review_ru_public_gaps",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.penguinrandomhouse.com/books/296408/the-iron-heel-by-jack-london-edited-with-an-introduction-by-jonathan-auerbach-notes-by-jordan-schugar/"
        ]
      }
    }
  },
  {
    "key": "usa:jack_london:article-catalog-2s2iy7",
    "firstPublished": 1913,
    "titleEvidenceSha256": "ca8d5d1a4f41dbc38a75c4de375e325dd9c953affce9e1fc02ed3fc770ee7238",
    "ruSha256": "ffd7bdd3bff8067aa5c368b4a1262252f062b090af272883e174b1c2ac17fa73",
    "enSha256": "0bec865400453c13cb381473928a7eaf78a537fa52ac428f554c2b76c43bee39",
    "provenance": {
      "ru": {
        "author": "Codex AI / london_bilingual_batch",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI / review_ru_public_gaps",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://azbooka.ru/books/lynnaya-dolina"
        ]
      },
      "en": {
        "author": "Codex AI / london_bilingual_batch",
        "createdAt": "2026-09-05",
        "reviewedBy": "Codex AI / review_ru_public_gaps",
        "reviewedAt": "2026-09-05",
        "primarySourceUrls": [
          "https://www.simonandschuster.com/books/The-Valley-of-the-Moon/Jack-London/9781633551619"
        ]
      }
    }
  }
];

describe("R49N existing reviewed profile candidates", () => {
  it("targets exactly twelve existing keys and excludes the missing Stowe author", () => {
    expect([...bookR49nExistingReviewed20260912RecordKeys].sort()).toEqual(
      expected.map(record => record.key).sort()
    );
    expect(new Set(bookR49nExistingReviewed20260912RecordKeys).size).toBe(12);
    for (const key of bookR49nExistingReviewed20260912RecordKeys) {
      expect(archive.filter(book => keyOf(book) === key), key).toHaveLength(1);
    }
    expect(bookR49nExistingReviewed20260912RecordKeys).not.toContain(
      "usa:harriet_beecher_stowe:uncle-toms-cabin"
    );
  });

  it.each(expected)("preserves reviewed texts, title evidence and AI history: $key", record => {
    const before = archive.find(book => keyOf(book) === record.key)!;
    const candidate = applyBookR49nExistingReviewed20260912Work(
      before.countryId, before.writerId, before
    );
    expect(isPublicBook(candidate)).toBe(true);
    expect(bookEvidenceV2Issues(candidate, {
      canonRegistry, recordKey: record.key, originCountryIds: [before.countryId],
      descriptionSha256ByLocale: {
        ru: hash(candidate.translations?.ru?.description || ""),
        en: hash(candidate.translations?.en?.description || ""),
      },
    })).toEqual([]);
    expect(candidate.firstPublished).toBe(record.firstPublished);
    expect(objectHash(candidate.localizedTitles)).toBe(record.titleEvidenceSha256);
    expect(candidate.description).toBe(candidate.translations?.ru?.description);
    for (const locale of ["ru", "en"] as const) {
      const translation = candidate.translations?.[locale];
      const provenance = translation?.descriptionProvenance as
        WorkDescriptionProvenanceProfile & { primarySourceUrls?: string[] };
      expect(hash(translation?.description || "")).toBe(
        locale === "ru" ? record.ruSha256 : record.enSha256
      );
      expect(translation?.status).toBe("reviewed");
      expect(translation?.method).toBe("editorial-original");
      expect(translation?.titleEvidence).toEqual(candidate.localizedTitles?.[locale]);
      expect(provenance.author).toBe(record.provenance[locale].author);
      expect(provenance.createdAt).toBe(record.provenance[locale].createdAt);
      expect(provenance.reviewedBy).toBe(record.provenance[locale].reviewedBy);
      expect(provenance.reviewedAt).toBe(record.provenance[locale].reviewedAt);
      expect(provenance.primarySourceUrls).toEqual(record.provenance[locale].primarySourceUrls);
      for (const url of provenance.primarySourceUrls || []) {
        expect(provenance.sourceUrls).toContain(url);
        expect(translation?.sourceUrls).toContain(url);
        const source = candidate.sources?.find(source => source.url === url);
        expect(source?.fields).toContain("description");
        const acceptedLanguages = locale === "ru"
          ? ["ru", "rus", "russian", "русский"]
          : ["en", "eng", "english", "английский"];
        expect(acceptedLanguages).toContain(source?.language?.trim().toLowerCase());
      }
    }
    for (const field of [
      "id", "title", "sourceUrl", "authorship", "alternateTitles", "genres", "tags",
      "externalIds", "distinctions", "canon", "coverUrl", "coverThumbnailUrl",
      "coverSourceUrl", "coverRights", "edition",
    ] as const) {
      expect(candidate[field], field).toEqual(before[field]);
    }
  });

  it("removes Gutenberg plot authority from all three replacements without losing title evidence", () => {
    for (const [countryId, writerId, id, pgUrl] of [
      ["russia", "tolstoy", "article-series-zqpjjm", "https://www.gutenberg.org/files/243/243-h/243-h.htm"],
      ["usa", "jack_london", "article-catalog-1hfivd6", "https://www.gutenberg.org/files/1164/1164-h/1164-h.htm"],
      ["usa", "jack_london", "article-catalog-2s2iy7", "https://www.gutenberg.org/files/1449/1449-h/1449-h.htm"],
    ]) {
      const input: WorkProfile = {
        id, title: "Current identity", sources: [{
          provider: "Project Gutenberg", authorityId: "project-gutenberg",
          url: pgUrl, fields: ["identity", "authorship", "description"],
          usage: "reference-only", retrievedAt: "2026-09-05",
        }],
      };
      const before = structuredClone(input);
      const result = applyBookR49nExistingReviewed20260912Work(countryId, writerId, input);
      expect(input).toEqual(before);
      expect(result.sources?.find(source => source.url === pgUrl)?.fields)
        .toEqual(["identity", "authorship"]);
      for (const locale of ["ru", "en"] as const) {
        expect(result.translations?.[locale]?.descriptionProvenance?.sourceUrls)
          .not.toContain(pgUrl);
      }
      expect(result.localizedTitles?.en?.evidence.some(
        evidence => evidence.authorityId === "project-gutenberg"
      )).toBe(true);
      expect(applyBookR49nExistingReviewed20260912Work(countryId, writerId, result))
        .toEqual(result);
    }
  });

  it("retains unrelated current sources and ignores foreign identities", () => {
    const current: WorkProfile = {
      id: "article-catalog-1hfivd6", title: "Current title",
      coverUrl: "current-cover.webp", edition: { title: "Current edition", publicationYear: 2026 },
      sources: [{ url: "https://example.org/current-edition", provider: "Current",
        fields: ["identity"], usage: "reference-only", retrievedAt: "2026-09-12" }],
    };
    const before = structuredClone(current);
    const result = applyBookR49nExistingReviewed20260912Work("usa", "jack_london", current);
    expect(current).toEqual(before);
    expect(result.coverUrl).toBe(before.coverUrl);
    expect(result.edition).toEqual(before.edition);
    expect(result.sources).toContainEqual(before.sources![0]);
    expect(applyBookR49nExistingReviewed20260912Work("england", "jack_london", current))
      .toBe(current);
    expect(applyBookR49nExistingReviewed20260912Work("usa", "other_writer", current))
      .toBe(current);
    const stowe = { id: "uncle-toms-cabin", title: "Uncle Tom's Cabin" };
    expect(applyBookR49nExistingReviewed20260912Work("usa", "harriet_beecher_stowe", stowe))
      .toBe(stowe);
  });

  it("adds institutional registrations without widening Gutenberg or Open Road factual roles", () => {
    const byId = new Map(canonRegistry.authorities.map(authority => [authority.authorityId, authority]));
    for (const id of ["centre-international-jules-verne", "rvb", "nyrb",
      "national-library-of-ireland", "bunin-museum-yelets", "alma-books",
      "us-national-park-service"]) {
      expect(byId.get(id)?.allowedRoles).toContain("description-fact");
    }
    expect(byId.get("project-gutenberg")?.allowedRoles).toEqual(["title-publisher"]);
    expect(byId.get("open-road-media")?.allowedRoles).not.toContain("description-fact");
  });
});
