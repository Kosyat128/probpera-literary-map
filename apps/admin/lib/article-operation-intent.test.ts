import { describe, expect, it } from "vitest";

import {
  captureArticleOperationIntent,
  parseArticleOperationIntent,
} from "./article-operation-intent";
import { prepareArticlePublicationIntent } from "./article-publication-intent";

const articleId = "a1111111-b222-4333-8444-c55555555555";
const otherId = "d1111111-e222-4333-8444-f55555555555";
const ruVersion = "2026-10-07T12:00:00.123456+00:00";
const enVersion = "2026-10-07T11:00:00.654321+00:00";
const authorText = "  Ручной RU текст\r\nEnglish authored text\nДо конца сохранены пробелы.  ";
const ruHtml = '<p data-author="RU">Ручной оригинал</p><img src="/manual.webp" data-credit="Автор" data-source="https://source.invalid/ru" data-license="Ручное разрешение" data-media-id="11111111-1111-4111-8111-111111111111">';
const enHtml = '<p data-author="EN">Manual English text</p><img src="/manual-en.webp" data-credit="Author" data-source="https://source.invalid/en" data-license="Manual permission" data-media-id="22222222-2222-4222-8222-222222222222">';
const ruJson = '{ "type": "doc", "content": [{"type":"text","text":"Авторский RU"}], "rights": "Ручное разрешение" }\n';
const enJson = '{ "type": "doc", "content": [{"type":"text","text":"Manual EN"}], "rights": "Manual permission" }\r\n';
const fields = {
  id: articleId,
  intent: "preview",
  expected_updated_at: ruVersion,
  english_expected_updated_at: enVersion,
  working_draft_version: "3",
  preview_locale: "en",
  previous_status: "published",
  status: "published",
  title: "  Ручной заголовок  ",
  subtitle: authorText,
  excerpt: "Описание вручную\r\nСо второй строкой",
  content_html: ruHtml,
  content_json: ruJson,
  sources: "  RU источник\r\nhttps://source.invalid/ru  ",
  bibliography: "Ручная библиография RU\nВторая запись",
  category_id: "33333333-3333-4333-8333-333333333333",
  cover_external_url: "https://images.invalid/manual.webp",
  cover_alt: "  Ручное описание обложки  ",
  seo_title: "Ручной SEO RU",
  seo_description: "Ручное описание поиска RU",
  english_enabled: "on",
  english_title: "  Manual English title  ",
  english_subtitle: "Manual EN subtitle\r\nSecond line  ",
  english_content_html: enHtml,
  english_content_json: enJson,
  english_sources: "  Manual EN source\r\nhttps://source.invalid/en  ",
  english_bibliography: "Manual bibliography EN\nSecond entry",
  english_cover_alt: "Manual EN cover description",
  english_status: "draft",
};

function form(patch: Record<string, string | undefined> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...patch })) {
    if (value !== undefined) result.append(key, value);
  }
  return result;
}
function sortedEntries(value: FormData): [string, string][] {
  return [...value.entries()].map(([key, field]) => [key, String(field)] as [string, string])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
}
function dto(patch: Record<string, unknown> = {}) {
  return {
    version: 1,
    entityType: "article",
    entityId: articleId,
    intent: "preview",
    expectedUpdatedAt: ruVersion,
    englishExpectedUpdatedAt: enVersion,
    workingDraftVersion: 3,
    previewLocale: "en",
    fields: sortedEntries(form()),
    ...patch,
  };
}
function withField(name: string, value: string) {
  const input = form();
  input.set(name, value);
  return dto({ fields: sortedEntries(input) });
}

// This DTO records the submitted intention only. These tests never treat it as
// a commit receipt, payload hash or permission to discard an author's copy.
describe("article operation intent preserves the submitted editorial payload", () => {
  it("captures all raw RU/EN text, HTML/JSON, sources, rights and original context without changing FormData", () => {
    const input = form();
    const before = [...input.entries()];
    const result = captureArticleOperationIntent(input);
    expect(result).toEqual(dto());
    expect(Object.keys(result!)).toHaveLength(9);
    expect([...input.entries()]).toEqual(before);
    expect(parseArticleOperationIntent(result)).toEqual(dto());
    expect(Object.fromEntries(result!.fields)).toMatchObject({
      subtitle: authorText,
      content_html: ruHtml,
      content_json: ruJson,
      english_content_html: enHtml,
      english_content_json: enJson,
      sources: fields.sources,
      english_sources: fields.english_sources,
      bibliography: fields.bibliography,
      english_bibliography: fields.english_bibliography,
    });
  });

  it("keeps changed authored RU/EN payload distinct while the submitted typed context stays the same", () => {
    const changed = form({ title: "B новый RU заголовок", english_title: "B newer EN title",
      content_html: "<p>B RU ручной текст</p>", english_content_html: "<p>B manual English text</p>",
      sources: "B RU источник\r\nСледующий источник", english_sources: "B EN source\nNext source" });
    const first = captureArticleOperationIntent(form());
    const second = captureArticleOperationIntent(changed);
    expect(second).toEqual(dto({ fields: sortedEntries(changed) }));
    expect(second).not.toEqual(first);
    expect(second?.expectedUpdatedAt).toBe(first?.expectedUpdatedAt);
    expect(second?.englishExpectedUpdatedAt).toBe(first?.englishExpectedUpdatedAt);
    expect(Object.fromEntries(second!.fields).english_sources).toBe("B EN source\nNext source");
  });

  it("is deterministic across FormData insertion order and sorts only field names", () => {
    const first = form();
    const reversed = new FormData();
    for (const [key, value] of [...first.entries()].reverse()) reversed.append(key, value);
    expect(captureArticleOperationIntent(reversed)).toEqual(captureArticleOperationIntent(first));
    expect(captureArticleOperationIntent(first)?.fields).toEqual(sortedEntries(first));
  });

  it("captures the explicitly prepared Russian publication payload and leaves the original caller input intact", () => {
    const original = form({ intent: "publish-ru", russian_publication_ready: "yes",
      publication_ready: "no", english_enabled: "on" });
    const prepared = new FormData();
    for (const [key, value] of original) prepared.append(key, value);
    prepareArticlePublicationIntent(prepared);
    const result = captureArticleOperationIntent(prepared);
    expect(result).toEqual(dto({ intent: "publish", fields: sortedEntries(prepared) }));
    expect(Object.fromEntries(result!.fields)).toMatchObject({ intent: "publish", publication_ready: "yes",
      skip_automatic_translation: "1", english_content_html: enHtml, english_sources: fields.english_sources });
    expect(Object.fromEntries(result!.fields)).not.toHaveProperty("english_enabled");
    expect(original.get("intent")).toBe("publish-ru");
    expect(original.get("english_enabled")).toBe("on");
    expect(original.get("publication_ready")).toBe("no");
    expect(captureArticleOperationIntent(original)).toBeNull();
  });

  it("excludes only reserved transport fields from capture and keeps other original intent fields", () => {
    const input = form({ article_result_mode: "receipt", article_operation_id: otherId,
      "$ACTION_ID_fixture": "opaque transport value", "$ACTION_REF_fixture": "opaque reference",
      skip_automatic_translation: "1", russian_publication_ready: "yes" });
    const result = captureArticleOperationIntent(input);
    expect(result).not.toBeNull();
    const captured = Object.fromEntries(result!.fields);
    expect(captured).not.toHaveProperty("article_result_mode");
    expect(captured).not.toHaveProperty("article_operation_id");
    expect(Object.keys(captured).some(key => key.startsWith("$ACTION_"))).toBe(false);
    expect(captured).toMatchObject({ skip_automatic_translation: "1", russian_publication_ready: "yes",
      english_sources: fields.english_sources });
    expect(input.get("article_operation_id")).toBe(otherId);
  });

  it("derives optional trimmed ID/CAS metadata while retaining exact raw field strings", () => {
    const upper = articleId.toUpperCase();
    const input = form({ id: `  ${upper}  `, expected_updated_at: ` ${ruVersion} `,
      english_expected_updated_at: `\t${enVersion}\n` });
    const result = captureArticleOperationIntent(input);
    expect(result).toEqual(dto({ entityId: upper, fields: sortedEntries(input) }));
    expect(Object.fromEntries(result!.fields).id).toBe(`  ${upper}  `);
    expect(parseArticleOperationIntent(result)).toEqual(result);
  });

  it("allows a new creation with absent optional context and finite default intent/locale/version", () => {
    const input = form({ id: undefined, expected_updated_at: undefined, english_expected_updated_at: undefined,
      working_draft_version: undefined, preview_locale: undefined, intent: undefined });
    const expected = dto({ entityId: null, expectedUpdatedAt: null, englishExpectedUpdatedAt: null,
      workingDraftVersion: 0, previewLocale: "ru", intent: "save", fields: sortedEntries(input) });
    expect(captureArticleOperationIntent(input)).toEqual(expected);
    expect(parseArticleOperationIntent(expected)).toEqual(expected);
  });
});

describe("article operation intent rejects ambiguous or forged candidates", () => {
  it("refuses duplicate FormData names even when both values are identical", () => {
    const input = form();
    input.append("title", fields.title);
    expect(captureArticleOperationIntent(input)).toBeNull();
    expect(input.getAll("title")).toEqual([fields.title, fields.title]);
    const duplicate = dto();
    duplicate.fields = [...duplicate.fields, ["title", fields.title]];
    expect(parseArticleOperationIntent(duplicate)).toBeNull();
  });

  it("refuses file payloads instead of silently replacing them with a filename or text", () => {
    const input = form();
    input.append("media_file", new Blob(["synthetic file"], { type: "image/webp" }), "manual.webp");
    expect(captureArticleOperationIntent(input)).toBeNull();
    expect(input.get("media_file")).toBeInstanceOf(File);
    const invalid = dto();
    invalid.fields = [...invalid.fields, ["media_file", new Blob(["synthetic file"]) as unknown as string]];
    expect(parseArticleOperationIntent(invalid)).toBeNull();
  });

  it.each(["bad-field", "Uppercase", "поле", "title field", "", "$OTHER_ACTION"])(
    "refuses non ASCII snake field name %s", name => {
      const input = form();
      input.append(name, "exact authored value");
      expect(captureArticleOperationIntent(input)).toBeNull();
    }
  );

  it("refuses unsorted field tuples and malformed pairs instead of rewriting the candidate", () => {
    const candidate = dto();
    const reversed = { ...candidate, fields: [...candidate.fields].reverse() };
    expect(parseArticleOperationIntent(reversed)).toBeNull();
    expect(reversed.fields).toEqual([...candidate.fields].reverse());
    expect(parseArticleOperationIntent({ ...candidate, fields: [["title"]] })).toBeNull();
    expect(parseArticleOperationIntent({ ...candidate, fields: [["title", "exact", "extra"]] })).toBeNull();
    expect(parseArticleOperationIntent({ ...candidate, fields: [["title", 7]] })).toBeNull();
  });

  it.each([
    { version: 2 }, { entityType: "page" }, { entityId: otherId }, { entityId: null },
    { intent: "save" }, { expectedUpdatedAt: enVersion }, { expectedUpdatedAt: null },
    { englishExpectedUpdatedAt: ruVersion }, { englishExpectedUpdatedAt: null },
    { workingDraftVersion: 4 }, { previewLocale: "ru" }, { operationId: otherId }, { receipt: "forged" },
  ])("refuses forged metadata inconsistent with raw fields or exact DTO keys %j", patch => {
    expect(parseArticleOperationIntent(dto(patch))).toBeNull();
  });

  it.each([null, undefined, [], "saved", {}, { ...dto(), fields: null }])(
    "refuses malformed top-level candidate %#", candidate => {
      expect(parseArticleOperationIntent(candidate)).toBeNull();
    }
  );

  it.each(["not-a-uuid", "11111111-1111-1111-1111-1111111111111", ""]) (
    "refuses invalid or missing existing identity context %s", id => {
      if (id === "") {
        // Empty identity with new-creation context is legitimate; the forged
        // metadata still cannot claim to belong to the previous article.
        expect(parseArticleOperationIntent(withField("id", id))).toBeNull();
      } else {
        expect(captureArticleOperationIntent(form({ id }))).toBeNull();
        expect(parseArticleOperationIntent(withField("id", id))).toBeNull();
      }
    }
  );

  it.each([undefined, "", "   "])("refuses existing article with missing RU CAS %s", expected_updated_at => {
    const input = form({ expected_updated_at });
    expect(captureArticleOperationIntent(input)).toBeNull();
  });

  it.each(["not-a-timestamp", "2026-10-07T12:00:00", "2026-10-07T99:60:00Z"])(
    "refuses invalid timestamp %s in either locale context", stamp => {
      expect(captureArticleOperationIntent(form({ expected_updated_at: stamp }))).toBeNull();
      expect(captureArticleOperationIntent(form({ english_expected_updated_at: stamp }))).toBeNull();
      expect(parseArticleOperationIntent(withField("expected_updated_at", stamp))).toBeNull();
    }
  );

  it.each(["-1", "1.5", "NaN", "Infinity", String(Number.MAX_SAFE_INTEGER + 1)])(
    "refuses unsafe working draft version %s", version => {
      expect(captureArticleOperationIntent(form({ working_draft_version: version }))).toBeNull();
      expect(parseArticleOperationIntent(withField("working_draft_version", version))).toBeNull();
    }
  );

  it.each([{ intent: "publish-ru" }, { intent: "delete" }, { preview_locale: "fr" }])(
    "refuses unsupported raw intent or locale %j", patch => {
      expect(captureArticleOperationIntent(form(patch))).toBeNull();
    }
  );
});

describe("article operation intent enforces bounded payloads before storage or lookup", () => {
  it("accepts 128 authored fields and rejects the 129th without silently dropping content", () => {
    const input = new FormData();
    for (let index = 0; index < 128; index++) input.append(`field_${String(index).padStart(3, "0")}`, `value ${index}`);
    const accepted = captureArticleOperationIntent(input);
    expect(accepted?.fields).toHaveLength(128);
    expect(parseArticleOperationIntent(accepted)).toEqual(accepted);
    input.append("field_128", "last authored value");
    expect(captureArticleOperationIntent(input)).toBeNull();
  });

  it("accepts a field at the size limit and rejects a larger field as a whole", () => {
    const input = new FormData();
    input.append("content_html", "a".repeat(2_000_000));
    expect(captureArticleOperationIntent(input)?.fields).toEqual([["content_html", "a".repeat(2_000_000)]]);
    input.set("content_html", "a".repeat(2_000_001));
    expect(captureArticleOperationIntent(input)).toBeNull();
  });

  it("measures total UTF8 bytes so multi-byte authored fields cannot exceed 5MiB", () => {
    const input = new FormData();
    const part = "я".repeat(1_500_000);
    input.append("content_html", part);
    expect(captureArticleOperationIntent(input)?.fields[0][1]).toBe(part);
    input.append("english_content_html", part);
    expect(captureArticleOperationIntent(input)).toBeNull();
    expect(input.get("content_html")).toBe(part);
    expect(input.get("english_content_html")).toBe(part);
  });
});
