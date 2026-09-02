import assert from "node:assert/strict";

import { it } from "vitest";

import {
  buildArticleBookAliasIndex,
  buildArticleBookWriterIdentityAliasMap,
  consolidateArticleBookCandidates,
  resolveArticleBookCandidate,
} from "./article-book-coverage-policy.mjs";

function book({ countryId, writerId, writerName, title, id }) {
  return {
    countryId,
    writerId,
    writerName,
    title,
    id: id || `${writerId}-${title}`,
    alternateTitles: [],
  };
}

function writer({ countryId, writerId, writerName }) {
  return { countryId, writerId, writerName };
}

function resolve(candidate, books, writers) {
  return resolveArticleBookCandidate(candidate, {
    aliasIndex: buildArticleBookAliasIndex(books),
    writers,
  });
}

it("same Russian title owned by another author is missing, not covered", () => {
  const cases = [
    {
      candidate: { author: "Майкл Крайтон", title: "Затерянный мир" },
      wrongBook: book({
        countryId: "england",
        writerId: "arthur_conan_doyle",
        writerName: "Артур Конан Дойл",
        title: "Затерянный мир",
      }),
      intendedWriter: writer({
        countryId: "usa",
        writerId: "michael_crichton",
        writerName: "Джон Майкл Крайтон",
      }),
    },
    {
      candidate: { author: "Иван Бунин", title: "Деревня" },
      wrongBook: book({
        countryId: "india",
        writerId: "mulk_raj_anand",
        writerName: "Мулк Радж Ананд",
        title: "Деревня",
      }),
      intendedWriter: writer({
        countryId: "russia",
        writerId: "buninin",
        writerName: "Иван Алексеевич Бунин",
      }),
    },
    {
      candidate: { author: "Анри Барбюс", title: "Нежность" },
      wrongBook: book({
        countryId: "chile",
        writerId: "gabriela_mistral",
        writerName: "Габриэла Мистраль",
        title: "Нежность",
      }),
      intendedWriter: writer({
        countryId: "france",
        writerId: "henri_barbusse",
        writerName: "Анри Барбюс",
      }),
    },
  ];

  for (const fixture of cases) {
    const result = resolve(
      fixture.candidate,
      [fixture.wrongBook],
      [fixture.intendedWriter]
    );
    assert.equal(result.status, "missing", fixture.candidate.title);
    assert.equal(result.covered, false, fixture.candidate.title);
    assert.equal(result.writer?.writerId, fixture.intendedWriter.writerId);
    assert.deepEqual(result.collisionReasonCodes, [
      "wrong-author-title-collision",
    ]);
    assert.equal(result.titleMatches[0].writerId, fixture.wrongBook.writerId);
  }
});

it("explicit author disambiguates a title shared by unrelated writers", () => {
  const books = [
    book({
      countryId: "south_korea",
      writerId: "kim_so_wol",
      writerName: "Ким Со Воль",
      title: "Дорога",
    }),
    book({
      countryId: "spain",
      writerId: "miguel_delibes",
      writerName: "Мигель Делибес",
      title: "Дорога",
    }),
    book({
      countryId: "usa",
      writerId: "cormac_mccarthy",
      writerName: "Кормак Маккарти",
      title: "Дорога",
    }),
  ];
  const result = resolve(
    { author: "Кормак Маккарти", title: "Дорога" },
    books,
    books.map(writer)
  );

  assert.equal(result.status, "covered");
  assert.equal(result.recordKey, "usa:cormac_mccarthy:cormac_mccarthy-Дорога");
  assert.deepEqual(result.collisionReasonCodes, [
    "same-title-multiple-authors",
  ]);
  assert.equal(result.titleMatches.length, 3);
  assert.equal(result.authorTitleMatches.length, 1);
});

it("duplicate Musil cards remain visible as an ambiguous author-work match", () => {
  const books = [
    book({
      countryId: "austria",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
    }),
    book({
      countryId: "germany",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
    }),
  ];
  const result = resolve(
    { author: "Роберт Музиль", title: "Человек без свойств" },
    books,
    books.map(writer)
  );

  assert.equal(result.status, "ambiguous");
  assert.equal(result.covered, false);
  assert.equal(result.workMatchAmbiguous, true);
  assert.equal(result.authorTitleMatches.length, 2);
  assert.deepEqual(result.collisionReasonCodes, [
    "duplicate-author-work-records",
  ]);
});

it("a reviewed Musil identity alias selects Austria without deleting either legacy card", () => {
  const books = [
    book({
      countryId: "austria",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
    }),
    book({
      countryId: "germany",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
    }),
  ];
  const writerIdentityAliases = buildArticleBookWriterIdentityAliasMap([
    {
      aliasWriterKey: "germany:robert_musil",
      canonicalWriterKey: "austria:robert_musil",
      reviewedAt: "2026-09-02",
      evidence: [
        {
          provider: "ONB",
          url: "https://onb.example/musil",
          finding: "Identity",
        },
        {
          provider: "RMI",
          url: "https://aau.example/musil",
          finding: "Work",
        },
      ],
    },
  ]);
  const result = resolveArticleBookCandidate(
    { author: "Роберт Музиль", title: "Человек без свойств" },
    {
      aliasIndex: buildArticleBookAliasIndex(books),
      writers: books.map(writer),
      writerIdentityAliases,
    }
  );

  assert.equal(result.status, "covered");
  assert.equal(
    result.recordKey,
    "austria:robert_musil:robert_musil-Человек без свойств"
  );
  assert.equal(result.writerMatchAmbiguous, false);
  assert.equal(result.workMatchAmbiguous, false);
  assert.equal(result.titleMatches.length, 2);
  assert.deepEqual(result.collisionReasonCodes, [
    "duplicate-author-work-records",
    "canonical-writer-alias-resolved",
  ]);
});

it("a writer alias cannot choose between two work cards on the canonical writer", () => {
  const books = [
    book({
      countryId: "austria",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
      id: "canonical-one",
    }),
    book({
      countryId: "austria",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
      id: "canonical-two",
    }),
    book({
      countryId: "germany",
      writerId: "robert_musil",
      writerName: "Роберт Музиль",
      title: "Человек без свойств",
    }),
  ];
  const result = resolveArticleBookCandidate(
    { author: "Роберт Музиль", title: "Человек без свойств" },
    {
      aliasIndex: buildArticleBookAliasIndex(books),
      writers: books.map(writer),
      writerIdentityAliases: new Map([
        ["germany:robert_musil", "austria:robert_musil"],
      ]),
    }
  );

  assert.equal(result.status, "ambiguous");
  assert.equal(result.recordKey, "");
});

it("writer identity aliases reject unreviewed evidence and cycles", () => {
  assert.throws(
    () =>
      buildArticleBookWriterIdentityAliasMap([
        {
          aliasWriterKey: "germany:robert_musil",
          canonicalWriterKey: "austria:robert_musil",
          reviewedAt: "2026-09-02",
          evidence: [],
        },
      ]),
    /lacks reviewed evidence/u
  );

  const evidence = [
    { provider: "One", url: "https://one.example", finding: "Identity" },
    { provider: "Two", url: "https://two.example", finding: "Identity" },
  ];
  assert.throws(
    () =>
      buildArticleBookWriterIdentityAliasMap([
        {
          aliasWriterKey: "germany:robert_musil",
          canonicalWriterKey: "austria:robert_musil",
          reviewedAt: "2026-09-02",
          evidence,
        },
        {
          aliasWriterKey: "austria:robert_musil",
          canonicalWriterKey: "germany:robert_musil",
          reviewedAt: "2026-09-02",
          evidence,
        },
      ]),
    /Cyclic writer identity alias/u
  );
});

it("candidate consolidation preserves different authors with one title", () => {
  const pairs = consolidateArticleBookCandidates([
    { author: "Первый автор", title: "Одно название", articleId: "one" },
    { author: "Второй автор", title: "Одно название", articleId: "two" },
  ]);

  assert.equal(pairs.length, 2);
  assert.deepEqual(
    pairs.map((pair) => pair.author).sort(),
    ["Второй автор", "Первый автор"].sort()
  );
});

it("a unique title-only source can resolve without inventing an author", () => {
  const onlyBook = book({
    countryId: "france",
    writerId: "antoine_de_saint_exupery",
    writerName: "Антуан де Сент-Экзюпери",
    title: "Маленький принц",
  });
  const result = resolve(
    { author: "", title: "Маленький принц" },
    [onlyBook],
    [writer(onlyBook)]
  );

  assert.equal(result.status, "covered");
  assert.equal(result.recordKey, articleRecordKeyFor(onlyBook));
});

function articleRecordKeyFor(value) {
  return `${value.countryId}:${value.writerId}:${value.id}`;
}
