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
  "recordCount": 14,
  "status": "draft",
  "humanReviewed": false,
  "childApproved": false,
  "narrationApproved": false,
  "releaseReady": false,
  "source": {
    "sourcePath": "src/host/bookySupport.ts",
    "sourceCommit": "aba461a774c125f9c38ea4c10aac9b3cc8024d2d",
    "sourceVersion": 2,
    "sourceSha256": "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:countries-error:ru",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "f5372063c46e6d9a6efd9f63b84819d7e1a876f9782f789b1fa548ade6bf94df",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2154975b4ced26e2cc12b3eca896a6f3f83260f587dde1f4616fb46fbdfb3cc0",
    },
    checksum: "8e71996d98c97f30a779bf1a837b4ba7261bb1c670dd61db0dbc2b5636f72041",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:countries-error:en",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "3c91e61dfee6559aa226cc79054912e088aa4eb47011ab239df8717ecdd5035c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "8fe657a452387373827ce71479488abedae4bd9f5f4a9d05df60962d60090c6b",
    },
    checksum: "d3544e15a314011d8a483a527ed5ff3f0afc37ab4546e4a4bb41ef2942523a66",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:books-error:ru",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "abbbb1923987c9bf3f900ffaae8cadcd3e005e3c49e2029fd51bfcb513a1c394",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "bea7cf8abd408aef517d19bec6b54060f01aa62e3c685e4e1e5a9a73210b6457",
    },
    checksum: "b39c368e10729836993a1d914de85d8b03a3fc697e04766a2ebd48dcde364b37",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:books-error:en",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "c867f62cfd8334b5638f557e5939b16b4c2c2f9f8809718639ad6d866c664356",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "536840befbac1e07400932de3baa3c5ee52766e53f7c44d399549c468f1fc17e",
    },
    checksum: "ae8c77cd7d4aff4da4747086f8e718a643697870493e2dbf079cc38b47269076",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:countries-loading:ru",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "46ed7156b34787704d3343f87f0cd1d49cf78a46d95218a1bd4d02145844cb3a",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "e8a933cce242866a9d877ac1db4dfb9faf58a86a623d0d5a46eef2a7a01ba6cd",
    },
    checksum: "1c58e5a9c2e4a806bc1c6d68138d109c913e568a1fdaa5de10fa8751932e0a13",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:countries-loading:en",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "d3152d225a3dcb2e87bbf0b926a68acd060c7b8d68806996b4543a22135cd572",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "f04b9c310b87abc6d6540fb23b557c37be2bd3ddea84e99c439e9a393429327a",
    },
    checksum: "f6afb0d5968ee54789396ea07231a630946131d0c11a4bfbfe936565a924c7af",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:books-loading:ru",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "35ac5a9491e16bc55ac15f19b2499f7b63d13e47bdeab0fe234311636cfc8e2c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "fa13b3ef3daf0cf8b9cb9552ad1fc4df13af923d5f8d64ccc46ed36717507a8f",
    },
    checksum: "e01bc54a9ddaaabc5ca05519071bd482a903bd522758737fc62cb2256b851b43",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:books-loading:en",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "5499ae9bafce8581e6c4f8313fb4550d32d3d5fab86261820520cf369dbc8a5b",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "70a478aeae3559dbbf21324910b152cff4d530eda9046d664215ad9ad2bda0c6",
    },
    checksum: "712cb95c2f7f8d184a91a929c04f822c8b8a3cd6b4648c43e618270237be4822",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:offline:ru",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "b4feb55a913776eb75e35947461e4a472469a88e263457d1b61e5c75169f0b36",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "0808ca15d73227f26760f88cc17a9e0322dbc75e19c34e7266bd7af5ac6aed0a",
    },
    checksum: "2e14233b6c2ef2edb8b6b62025f0428a4e2997971a86805cc27681383bd5891b",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:offline:en",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "6f374cdc39aea73e128c2af2ed1e6a78e2131ea551466142e64f8c6a787925c2",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "6736e183c1222e272deaf9a6f1c274f817e8323e9f14dfb59e614e450f67f980",
    },
    checksum: "980a6663c8fec49f4e3fdf9a0edd9c67c3bdf51a98049e384e02e01cc95694ee",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:network-unknown:ru",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "7f5f9d95dfd88d15ea7a5b4f556fb178d78ca7184a9d6041337fa407460c917b",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "dd052593e07297de8e00010f5433b1dac7a32683df9624f0ad0c38c12fca816f",
    },
    checksum: "9ca7c6d771d84fee5a15661c1ff527497bed7e74e169f11df44534e252d85938",
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
        kind: "existing-interface-copy", sourcePath: "src/host/bookySupport.ts", sourceVersion: 2,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:network-unknown:en",
        sourceSha256: "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        copySha256: "fb3fd97a5fe4cd7296ef9794e56352225f2714d64bed348b55274c70df5365d6",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "4479b636f812241e0c200871153ed174befab7a317ad32545192f67a425433d9",
    },
    checksum: "577c001190263a02f78140c2fc472ecc9d76c5593bca42487b5663f65b2d0a8f",
  },
  // New exhausted-load copy is a separate unapproved variant of books-error.
  {
    "payload": {
      "id": "support.books-error-restart",
      "locale": "ru",
      "version": 1,
      "audience": "adult",
      "ageRange": {
        "min": 18,
        "max": 120
      },
      "readingLevel": "plain",
      "intent": "load-error",
      "screens": [
        "collection"
      ],
      "context": "books-error-restart",
      "entityIds": [],
      "claimKind": "interface-guidance",
      "factualSources": [],
      "copy": {
        "title": "Не удалось открыть коллекцию",
        "body": "Чтобы снова попробовать открыть коллекцию, перезапустите приложение. Также можно вернуться к глобусу.",
        "caption": "Не удалось открыть коллекцию",
        "reduced": "Не удалось открыть коллекцию"
      },
      "narration": null,
      "prohibitedTags": [],
      "provenance": {
        "kind": "existing-interface-copy",
        "sourcePath": "src/host/bookySupport.ts",
        "sourceVersion": 2,
        "sourceRef": "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:books-error-restart:ru",
        "sourceSha256": "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        "copySha256": "9f531960a2a44ed9f77f6c81e9945cb4b6330bfa0242ff084e226ec0bef6a17e"
      }
    },
    "review": {
      "status": "draft",
      "reviewer": null,
      "reviewedAt": null,
      "contentChecksum": "e83735e96091d1d4f86a5e6b3bba8733edb32128d05598167d1c056ce97042c0"
    },
    "checksum": "392db8301a871683710485547d0bf521958da36f22760024799c1a9da91a388e"
  },
  {
    "payload": {
      "id": "support.books-error-restart",
      "locale": "en",
      "version": 1,
      "audience": "adult",
      "ageRange": {
        "min": 18,
        "max": 120
      },
      "readingLevel": "plain",
      "intent": "load-error",
      "screens": [
        "collection"
      ],
      "context": "books-error-restart",
      "entityIds": [],
      "claimKind": "interface-guidance",
      "factualSources": [],
      "copy": {
        "title": "The collection could not be opened",
        "body": "Restart the application to try opening the collection again. You can also return to the globe.",
        "caption": "The collection could not be opened",
        "reduced": "The collection could not be opened"
      },
      "narration": null,
      "prohibitedTags": [],
      "provenance": {
        "kind": "existing-interface-copy",
        "sourcePath": "src/host/bookySupport.ts",
        "sourceVersion": 2,
        "sourceRef": "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:books-error-restart:en",
        "sourceSha256": "d75cb24a1a593ac778788c972511849fc5b0d4c8030d7f864448b1a0b29b2ff8",
        "copySha256": "13f95243215396603482167741b61d3dc88950c297bd9a07ffc4befff482a0d5"
      }
    },
    "review": {
      "status": "draft",
      "reviewer": null,
      "reviewedAt": null,
      "contentChecksum": "4b6f56a526aa2ff4319ec7b7f52ed58adb47aaab23c1938573d5125fcccbc586"
    },
    "checksum": "63346a0fbd91c1bc12251a5c2711486dbd489e057cf238f17839dfe24588c91d"
  }
] satisfies BookyDialogueRecord[]);
