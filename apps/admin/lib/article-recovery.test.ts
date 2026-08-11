import { describe, expect, it } from "vitest";

import {
  articleDraftRecoveryKeyPrefix,
  clearConfirmedArticleRecovery,
  latestArticleDraftPointerKey,
  pendingArticleSaveValue,
  PENDING_ARTICLE_SAVE_KEY,
  persistArticleRecoverySnapshot,
  resolveArticleDraftRecoverySource,
} from "./article-recovery";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    value(key: string) {
      return values.get(key) ?? null;
    },
  };
}

describe("article recovery after a confirmed save", () => {
  it("clears only the recovery copy submitted to the server", () => {
    const currentKey = "probpera-editor-article-1";
    const submitted = { title: "submitted snapshot" };
    const local = memoryStorage({
      [currentKey]: JSON.stringify(submitted),
    });
    const session = memoryStorage({
      [PENDING_ARTICLE_SAVE_KEY]: pendingArticleSaveValue(
        currentKey,
        submitted
      ),
    });

    expect(clearConfirmedArticleRecovery(local, session, currentKey)).toEqual({
      clearedCurrent: true,
      pendingRecoveryKey: currentKey,
    });
    expect(local.value(currentKey)).toBeNull();
    expect(session.value(PENDING_ARTICLE_SAVE_KEY)).toBeNull();
  });

  it("preserves a newer autosave when the saved URL is reloaded", () => {
    const currentKey = "probpera-editor-article-1";
    const local = memoryStorage({ [currentKey]: "new unsaved edits" });
    const session = memoryStorage();

    expect(clearConfirmedArticleRecovery(local, session, currentKey)).toEqual({
      clearedCurrent: false,
      pendingRecoveryKey: null,
    });
    expect(local.value(currentKey)).toBe("new unsaved edits");
  });

  it("preserves edits written under the same key after submit", () => {
    const currentKey = "probpera-editor-article-1";
    const submitted = { title: "version A", contentHtml: "<p>A</p>" };
    const newer = { title: "version B", contentHtml: "<p>B</p>" };
    const local = memoryStorage({
      [currentKey]: JSON.stringify(newer),
    });
    const session = memoryStorage({
      [PENDING_ARTICLE_SAVE_KEY]: pendingArticleSaveValue(
        currentKey,
        submitted
      ),
    });

    expect(clearConfirmedArticleRecovery(local, session, currentKey)).toEqual({
      clearedCurrent: false,
      pendingRecoveryKey: currentKey,
    });
    expect(local.value(currentKey)).toBe(JSON.stringify(newer));
    expect(session.value(PENDING_ARTICLE_SAVE_KEY)).toBeNull();
  });
});

describe("new article recovery across browser sessions", () => {
  it("finds the latest unsaved draft after returning to a fresh /articles/new page", () => {
    const scope = "new";
    const prefix = articleDraftRecoveryKeyPrefix(scope);
    const previousKey = `${prefix}draft-a`;
    const currentKey = `${prefix}draft-b`;
    const local = memoryStorage();

    persistArticleRecoverySnapshot(
      local,
      previousKey,
      JSON.stringify({ title: "Черновик после закрытия вкладки" }),
      scope
    );
    expect(
      resolveArticleDraftRecoverySource(local, scope, currentKey)
    ).toBe(previousKey);
  });

  it("prefers the current tab snapshot over the latest-draft locator", () => {
    const scope = "new";
    const prefix = articleDraftRecoveryKeyPrefix(scope);
    const previousKey = `${prefix}draft-a`;
    const currentKey = `${prefix}draft-b`;
    const local = memoryStorage();

    persistArticleRecoverySnapshot(
      local,
      previousKey,
      JSON.stringify({ title: "Вкладка A" }),
      scope
    );
    local.setItem(currentKey, JSON.stringify({ title: "Вкладка B" }));

    expect(
      resolveArticleDraftRecoverySource(local, scope, currentKey)
    ).toBe(currentKey);
  });

  it("drops a stale pointer after its saved draft has been cleared", () => {
    const scope = "new";
    const prefix = articleDraftRecoveryKeyPrefix(scope);
    const pointerKey = latestArticleDraftPointerKey(scope);
    const local = memoryStorage({
      [pointerKey]: JSON.stringify({
        version: 1,
        scope,
        recoveryKey: `${prefix}already-saved`,
      }),
    });

    expect(
      resolveArticleDraftRecoverySource(local, scope, `${prefix}current`)
    ).toBe(`${prefix}current`);
    expect(local.value(pointerKey)).toBeNull();
  });

  it("does not accept a pointer from another draft scope", () => {
    const prefix = articleDraftRecoveryKeyPrefix("new");
    const foreignKey = `${articleDraftRecoveryKeyPrefix("copy-42")}draft-b`;
    const pointerKey = latestArticleDraftPointerKey("new");
    const local = memoryStorage({
      [pointerKey]: JSON.stringify({
        version: 1,
        scope: "copy-42",
        recoveryKey: foreignKey,
      }),
      [foreignKey]: JSON.stringify({ title: "Другая копия" }),
    });

    expect(
      resolveArticleDraftRecoverySource(local, "new", `${prefix}current`)
    ).toBe(`${prefix}current`);
    expect(local.value(foreignKey)).not.toBeNull();
  });

  it("clears the submitted draft locator but preserves another tab locator", () => {
    const scope = "new";
    const prefix = articleDraftRecoveryKeyPrefix(scope);
    const submittedKey = `${prefix}draft-a`;
    const otherKey = `${prefix}draft-b`;
    const pointerKey = latestArticleDraftPointerKey(scope);
    const submitted = { title: "Версия A" };
    const local = memoryStorage({
      [submittedKey]: JSON.stringify(submitted),
    });
    const session = memoryStorage({
      [PENDING_ARTICLE_SAVE_KEY]: pendingArticleSaveValue(
        submittedKey,
        submitted,
        scope
      ),
    });

    persistArticleRecoverySnapshot(
      local,
      otherKey,
      JSON.stringify({ title: "Версия B" }),
      scope
    );
    clearConfirmedArticleRecovery(local, session, "probpera-editor-new-id");

    expect(local.value(submittedKey)).toBeNull();
    expect(local.value(otherKey)).not.toBeNull();
    expect(JSON.parse(local.value(pointerKey) || "null").recoveryKey).toBe(
      otherKey
    );
  });

  it("clears the locator when it still points to the confirmed snapshot", () => {
    const scope = "new";
    const recoveryKey = `${articleDraftRecoveryKeyPrefix(scope)}draft-a`;
    const pointerKey = latestArticleDraftPointerKey(scope);
    const submitted = { title: "Сохранённый черновик" };
    const local = memoryStorage();
    const session = memoryStorage({
      [PENDING_ARTICLE_SAVE_KEY]: pendingArticleSaveValue(
        recoveryKey,
        submitted,
        scope
      ),
    });
    persistArticleRecoverySnapshot(
      local,
      recoveryKey,
      JSON.stringify(submitted),
      scope
    );

    clearConfirmedArticleRecovery(local, session, "probpera-editor-new-id");

    expect(local.value(recoveryKey)).toBeNull();
    expect(local.value(pointerKey)).toBeNull();
  });
});
