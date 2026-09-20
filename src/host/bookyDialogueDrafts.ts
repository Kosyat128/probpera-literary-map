import type { BookyDialogueRecord } from "./bookyDialogueRegistry";

// This module is an unwired inventory, not a runtime copy provider or a review.
// All source, copy, payload and record checksums below are authored literals.
// Validation must fail on source changes; it must never refresh these values.
// Caption and reduced fields reuse the existing title, with no new wording.
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const BOOKY_DIALOGUE_DRAFT_INVENTORY = freeze({
  "schemaVersion": 1,
  "recordCount": 12,
  "status": "draft",
  "humanReviewed": false,
  "childApproved": false,
  "narrationApproved": false,
  "releaseReady": false,
  "source": {
    "sourcePath": "src/host/bookySupport.ts",
    "sourceCommit": "707044e708cb5b0ce1b564b378cc5adffd574f12",
    "sourceVersion": 1,
    "sourceSha256": "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
    "sourceHashEncoding": "sha256:utf8:lf",
    "copyHashEncoding": "sha256:utf8:JSON.stringify({title,body})"
  }
} as const);

export const BOOKY_DIALOGUE_DRAFTS: readonly BookyDialogueRecord[] = freeze([
  {
    payload: {
      id: "support.countries-error", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "load-error",
      screens: ["globe","collection"], context: "countries-error",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Не удалось открыть страны",
        body: "Попробуйте ещё раз. Без сети можно открыть только материалы, уже доступные на устройстве.",
        caption: "Не удалось открыть страны",
        reduced: "Не удалось открыть страны",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:countries-error:ru",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "f5372063c46e6d9a6efd9f63b84819d7e1a876f9782f789b1fa548ade6bf94df",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "1fdce09abddad27c1c67f024692b7275a344416923e3887c75337434d2671fbb",
    },
    checksum: "06073b4a0aa2f0b030e30087e027b0dca46d55c95c2880933ff415c61739848a",
  },
  {
    payload: {
      id: "support.countries-error", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "load-error",
      screens: ["globe","collection"], context: "countries-error",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Countries could not be opened",
        body: "Try again. Without a connection, only materials already available on this device can be opened.",
        caption: "Countries could not be opened",
        reduced: "Countries could not be opened",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:countries-error:en",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "3c91e61dfee6559aa226cc79054912e088aa4eb47011ab239df8717ecdd5035c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "8b5b30b055fb303d20951cca3d1d3939370f8f6f2c6d0b3887d002d23acdb670",
    },
    checksum: "7db1c8e1c5eba95f970768404777222cc9123faa2db5ef207dbc79268547ba58",
  },
  {
    payload: {
      id: "support.books-error", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "load-error",
      screens: ["collection"], context: "books-error",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Не удалось открыть коллекцию",
        body: "Попробуйте ещё раз. Без сети можно открыть только материалы, уже доступные на устройстве.",
        caption: "Не удалось открыть коллекцию",
        reduced: "Не удалось открыть коллекцию",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:books-error:ru",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "abbbb1923987c9bf3f900ffaae8cadcd3e005e3c49e2029fd51bfcb513a1c394",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "61021607e41634349913a1f80cd5037d76a9e261bf79cb20eca7d6583f0864e3",
    },
    checksum: "89dc26239cf9840d75bc3aa632e594fa89719056dc1f2791563359c31ebc84e8",
  },
  {
    payload: {
      id: "support.books-error", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "load-error",
      screens: ["collection"], context: "books-error",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "The collection could not be opened",
        body: "Try again. Without a connection, only materials already available on this device can be opened.",
        caption: "The collection could not be opened",
        reduced: "The collection could not be opened",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:books-error:en",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "c867f62cfd8334b5638f557e5939b16b4c2c2f9f8809718639ad6d866c664356",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "6ff950dab419fdd705871d1e4e8f0abda81a138b12b3c58ea1621cd5746859d1",
    },
    checksum: "86efd2879247aa8cacb61e76e007634f4cde4aefad2c0a4b03b70500c21be3c5",
  },
  {
    payload: {
      id: "support.countries-loading", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "loading-help",
      screens: ["globe","collection"], context: "countries-loading",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Открываем страны",
        body: "Материалы ещё загружаются. Дождитесь результата, чтобы выбрать страну.",
        caption: "Открываем страны",
        reduced: "Открываем страны",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:countries-loading:ru",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "46ed7156b34787704d3343f87f0cd1d49cf78a46d95218a1bd4d02145844cb3a",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "1f5c5fe110da923e1e05710e1764889a292065353ad4b440fce7e1bf07f3c36c",
    },
    checksum: "863e6ca346ef8b621a357ceec055f96a29d59e5c940294cce99f0c81ae93b1ab",
  },
  {
    payload: {
      id: "support.countries-loading", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "loading-help",
      screens: ["globe","collection"], context: "countries-loading",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Opening countries",
        body: "Materials are still loading. Wait for the result before choosing a country.",
        caption: "Opening countries",
        reduced: "Opening countries",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:countries-loading:en",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "d3152d225a3dcb2e87bbf0b926a68acd060c7b8d68806996b4543a22135cd572",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "fb1e89ff4b143307b646a2c0481f264c46131167f22deeddb2e0c8d24eb4d965",
    },
    checksum: "670e02171c12e78202a24ddb99b83b45289e7f0852513713abad2979203485cd",
  },
  {
    payload: {
      id: "support.books-loading", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "loading-help",
      screens: ["collection"], context: "books-loading",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Открываем коллекцию",
        body: "Книги ещё загружаются. Дождитесь результата, чтобы выбрать книгу.",
        caption: "Открываем коллекцию",
        reduced: "Открываем коллекцию",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:books-loading:ru",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "35ac5a9491e16bc55ac15f19b2499f7b63d13e47bdeab0fe234311636cfc8e2c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "696e3b53256b682d1647cb68f6889dd7882731a1ff59b44c9e6eb8f19c938131",
    },
    checksum: "b085a8f7e6cb1196721344f86786a8c2fdf8f5f8ee356792bcf714bdbf31429d",
  },
  {
    payload: {
      id: "support.books-loading", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "loading-help",
      screens: ["collection"], context: "books-loading",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Opening the collection",
        body: "Books are still loading. Wait for the result before choosing a book.",
        caption: "Opening the collection",
        reduced: "Opening the collection",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:books-loading:en",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "5499ae9bafce8581e6c4f8313fb4550d32d3d5fab86261820520cf369dbc8a5b",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "16513198a767b0b83eebcac13c50b2ce7abdcc7922bfae550b3fcf8414a8421f",
    },
    checksum: "794f5d66e48ee2138ba2cdaa24c1f4599741485b7822172c213ac03ee85c130c",
  },
  {
    payload: {
      id: "support.offline", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "offline-help",
      screens: ["globe","collection"], context: "offline",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Сейчас нет подключения",
        body: "Можно пользоваться только материалами, уже доступными на устройстве. Для загрузки новых материалов потребуется сеть.",
        caption: "Сейчас нет подключения",
        reduced: "Сейчас нет подключения",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:offline:ru",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "b4feb55a913776eb75e35947461e4a472469a88e263457d1b61e5c75169f0b36",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "e308c2dc04db209772b97f8dcb086468ed24b5beea26a3874b6133f0dba50503",
    },
    checksum: "79673d3ebce6105b6f27c2d8ba0fe449617c7c81ff53f84e03143302dab0ebcd",
  },
  {
    payload: {
      id: "support.offline", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "offline-help",
      screens: ["globe","collection"], context: "offline",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Currently offline",
        body: "You can use only materials already available on this device. Loading new materials needs a connection.",
        caption: "Currently offline",
        reduced: "Currently offline",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:offline:en",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "6f374cdc39aea73e128c2af2ed1e6a78e2131ea551466142e64f8c6a787925c2",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "f3f9fdf4b1de1dcb62d99fa45d4b887113958994e0bbe3d37dc64278d6392e45",
    },
    checksum: "6adeaca50241c69cba0cf283150607d942ea911e813a83d1c46dc4a2b190e5a5",
  },
  {
    payload: {
      id: "support.network-unknown", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "offline-help",
      screens: ["globe","collection"], context: "network-unknown",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Подключение пока не определено",
        body: "Пока неизвестно, есть ли подключение. Попробуйте открыть нужный материал. Если он недоступен, проверьте сеть.",
        caption: "Подключение пока не определено",
        reduced: "Подключение пока не определено",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:network-unknown:ru",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "7f5f9d95dfd88d15ea7a5b4f556fb178d78ca7184a9d6041337fa407460c917b",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "ba32250c4f502b8468f38b2a89b1a556f5a199f9dc1f6d36ce17ea2d1472a8d7",
    },
    checksum: "71a5732e78a892607aff7b673f32d7915df2ea7cbc7547b94013ae0ba95a093f",
  },
  {
    payload: {
      id: "support.network-unknown", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "offline-help",
      screens: ["globe","collection"], context: "network-unknown",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Connection status is unknown",
        body: "It is not yet known whether there is a connection. Try opening the material you need. If it is unavailable, check your connection.",
        caption: "Connection status is unknown",
        reduced: "Connection status is unknown",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 1,
        sourceRef: "707044e708cb5b0ce1b564b378cc5adffd574f12:network-unknown:en",
        sourceSha256: "2190a681325ef2e804f0bb320aa1c8b0815116cd2d1334a6e0fdf40318a6ff00",
        copySha256: "fb3fd97a5fe4cd7296ef9794e56352225f2714d64bed348b55274c70df5365d6",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "ed4e1d66d0aaf0ffdb864a0336f5e2a56dae6dd807fe1b34107d48d96144d2e4",
    },
    checksum: "69930525cf8ab6028bdb9eda4230fb3db74b2d377ad052a69f87065dc4624f67",
  }
] satisfies BookyDialogueRecord[]);
