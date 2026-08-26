import assert from "node:assert/strict";
import { test } from "vitest";

import {
  applyBookSmartShelf,
  BOOK_SMART_SHELVES_LIMIT,
  BOOK_SMART_SHELVES_STORAGE_KEY,
  readBookSmartShelves,
  saveBookSmartShelf,
  type BookSmartShelfStorage,
} from "./bookSmartShelves";

const memoryStorage = (initial: string | null = null): BookSmartShelfStorage & {
  read(): string | null;
} => {
  let value = initial;
  return {
    getItem: (key) => key === BOOK_SMART_SHELVES_STORAGE_KEY ? value : null,
    setItem: (key, next) => {
      if (key === BOOK_SMART_SHELVES_STORAGE_KEY) value = next;
    },
    read: () => value,
  };
};

test("readBookSmartShelves fails closed for malformed or unavailable storage", () => {
  assert.deepEqual(readBookSmartShelves(memoryStorage("not-json")), []);
  assert.deepEqual(readBookSmartShelves({
    getItem: () => { throw new Error("blocked"); },
    setItem: () => undefined,
  }), []);
  assert.deepEqual(readBookSmartShelves(null), []);
});

test("readBookSmartShelves validates, normalizes, de-duplicates and caps records", () => {
  const records = Array.from({ length: BOOK_SMART_SHELVES_LIMIT + 3 }, (_, index) => ({
    id: `smart-${index}`,
    label: `  Полка   ${index}  `,
    filterState: { query: `  Автор ${index}  ` },
  }));
  records.splice(1, 0, { id: "smart-0", label: "Дубликат", filterState: { query: "x" } });
  const storage = memoryStorage(JSON.stringify([
    null,
    { id: "bad id", label: "Плохая", filterState: {} },
    { id: "missing-filter", label: "Плохая" },
    ...records,
  ]));

  const shelves = readBookSmartShelves(storage);
  assert.equal(shelves.length, BOOK_SMART_SHELVES_LIMIT);
  assert.equal(shelves[0]?.id, "smart-0");
  assert.equal(shelves[0]?.label, "Полка 0");
  assert.equal(shelves[0]?.filterState.query, "Автор 0");
  assert.equal(new Set(shelves.map(({ id }) => id)).size, shelves.length);
});

test("saveBookSmartShelf upserts safely and reports persistence failures", () => {
  const storage = memoryStorage();
  const first = saveBookSmartShelf({
    id: "smart-one",
    label: "  Моя   полка  ",
    filterState: { query: "Пушкин" },
  }, storage);
  assert.equal(first.persisted, true);
  assert.equal(first.shelf?.label, "Моя полка");

  const updated = saveBookSmartShelf({
    id: "smart-one",
    label: "Обновлённая полка",
    filterState: { query: "Лермонтов" },
  }, storage);
  assert.equal(updated.shelves.length, 1);
  assert.equal(readBookSmartShelves(storage)[0]?.filterState.query, "Лермонтов");

  const failed = saveBookSmartShelf({
    id: "smart-two",
    label: "Вторая",
    filterState: {},
  }, {
    getItem: storage.getItem,
    setItem: () => { throw new Error("quota"); },
  });
  assert.equal(failed.persisted, false);
  assert.equal(failed.shelves[0]?.id, "smart-two");
});

test("applyBookSmartShelf returns only a normalized filter state", () => {
  assert.equal(applyBookSmartShelf({ id: "bad id", label: "Полка", filterState: {} }), null);
  const state = applyBookSmartShelf({
    id: "smart-safe",
    label: "Безопасная полка",
    filterState: { query: "  Булгаков  " },
  });
  assert.equal(state?.query, "Булгаков");
});
