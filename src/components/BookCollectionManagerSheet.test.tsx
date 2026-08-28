import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BOOK_COLLECTION_SCHEMA_VERSION } from "../books/bookCollections";
import BookCollectionManagerSheet, {
  type ManagedBookCollection,
} from "./BookCollectionManagerSheet";

const collection: ManagedBookCollection = {
  id: "manual:classics",
  kind: "manual",
  title: "Классика",
  description: "Проверенная временем проза",
  visibility: "private",
  backgroundPreset: "warm-paper",
  dynamicBookThemes: true,
  themeIntensity: 72,
  sortMode: "manual",
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
};

describe("BookCollectionManagerSheet", () => {
  it("renders accessible settings and all required manual ordering controls", () => {
    const markup = renderToStaticMarkup(
      <BookCollectionManagerSheet
        collection={collection}
        orderedItems={[
          { bookKey: "book:a", title: "Война и мир", writer: "Лев Толстой" },
          { bookKey: "book:missing", title: "Утраченная запись", missing: true },
        ]}
        onSave={() => {}}
        onReorder={() => {}}
        onRemoveBook={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Настроить полку");
    expect(markup).toContain("Проверенная временем проза");
    expect(markup).toContain("Книга недоступна в текущем архиве");
    expect(markup).toContain("в начало");
    expect(markup).toContain("выше");
    expect(markup).toContain("ниже");
    expect(markup).toContain("в конец");
    expect(markup).toContain("Убрать «Утраченная запись» с полки");
    expect(markup).toContain("Удалить полку");
    expect(markup).not.toContain("Удалить окончательно");
  });
});
