import type { BookyDialogueRecord } from "./bookyDialogueRegistry";

// Explicit provenance rebaseline: the eight contextual records use version 2
// after the reader-settings slot changed Controls. Copy remains exact; this
// declares no editorial approval. Route records retain their version-1 source.
// Unwired inventory of existing adult navigation copy; every record is draft.
// Source, copy, payload and envelope hashes are fixed authored declarations.
// Audits compare them; no runtime or validator may silently regenerate them.
// Contextual titles reuse the existing companion heading, and bodies reuse
// helpTip. Caption/reduced copy reuse the same existing title without narration.
// Route instructions remain visible on both screens while the existing UI
// offers a return/open action. requiredScreen controls advancement, not display.
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const BOOKY_NAVIGATION_DRAFT_INVENTORY = freeze({
  "schemaVersion": 1,
  "recordCount": 22,
  "navigationRecordCount": 14,
  "contextualRecordCount": 8,
  "status": "draft",
  "humanReviewed": false,
  "childApproved": false,
  "narrationApproved": false,
  "releaseReady": false,
  "routes": [
    {
      "id": "overview",
      "version": 1,
      "stepIds": [
        "search",
        "country",
        "collection",
        "appearance"
      ]
    },
    {
      "id": "country-to-book",
      "version": 1,
      "stepIds": [
        "choose-country",
        "choose-writer",
        "open-books"
      ]
    }
  ],
  "contexts": [
    "globe",
    "country",
    "writer",
    "collection"
  ],
  "sources": [
    {
      "sourcePath": "src/host/planetMascotRoutes.ts",
      "sourceCommit": "5e6eb7676367f71731fa84f9b2e69249c48bcb06",
      "sourceVersion": 1,
      "sourceSha256": "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
      "sourceHashEncoding": "sha256:utf8:lf",
      "copyHashEncoding": "sha256:utf8:JSON.stringify({title,body})"
    },
    {
      "sourcePath": "src/host/PlanetMascotControls.tsx",
      "sourceCommit": "c5f8e80ab3b8f6be42e04584a0b174ac427197e7",
      "sourceVersion": 2,
      "sourceSha256": "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
      "sourceHashEncoding": "sha256:utf8:lf",
      "copyHashEncoding": "sha256:utf8:JSON.stringify({title,body})"
    }
  ]
} as const);

export const BOOKY_NAVIGATION_DRAFTS: readonly BookyDialogueRecord[] = freeze([
  {
    payload: {
      id: "navigation.overview.search", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:search",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Найдите интересное",
        body: "Откройте поиск, чтобы найти страну, писателя или книгу.",
        caption: "Найдите интересное",
        reduced: "Найдите интересное",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.search:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "064b0098e09346deae05aa11178c0d2abaa613621c67f8b843f68e4aac037878",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "359e297d68da0acca6ffc495a0b3b7dfce42aa39cbe85f37254e2d66dcca2deb",
    },
    checksum: "7c94b43004511ad2b9fd80f9c8f23e356827ba3d7b319ee1440310d73b74091c",
  },
  {
    payload: {
      id: "navigation.overview.search", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:search",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Find something to read",
        body: "Open search to find a country, writer or book.",
        caption: "Find something to read",
        reduced: "Find something to read",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.search:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "c276f48220c3a154de837df6b3277e69b8c7480f06c2e9f364f1c2de61bfa004",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2befd360c5a9f0786e0a6ebd57f91fde4e945caf67d9be5472bdd51517be4348",
    },
    checksum: "61d94c71b373bbc9f8e0e4fc44405daada2908b961a685c0b54a79dddeb3a9a8",
  },
  {
    payload: {
      id: "navigation.overview.country", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:country",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Исследуйте страну",
        body: "Выберите страну на глобусе или через поиск. В её архиве можно выбрать писателя.",
        caption: "Исследуйте страну",
        reduced: "Исследуйте страну",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.country:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "77a496b056fe0a836ed63a9932707dcb8ebe6b71d6fd5bab2b64065b60d8d5a0",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "3949c2c0deef2f9191dadaa3a91bdec731f47d8ba4ea407b56b35bef46c65e20",
    },
    checksum: "0aff9138d08f1d1dbcced3b622cd349622f37cee60d956c357f238dfc3ce1e0e",
  },
  {
    payload: {
      id: "navigation.overview.country", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:country",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Explore a country",
        body: "Choose a country on the globe or through search. Its archive lets you choose a writer.",
        caption: "Explore a country",
        reduced: "Explore a country",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.country:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "9ed67151d3ff85dcd68914c16b75075bdeb529ae335f710bf2e4d514c1b51546",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2bfada03a28bd945aa0c331dda846031791482940b075d852f19c3e2c020b49a",
    },
    checksum: "8361bbdb9003129b28dd8e4b411f0ffc347713b331a36e17e1cb3b275f2ee191",
  },
  {
    payload: {
      id: "navigation.overview.collection", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:collection",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Откройте коллекцию",
        body: "В коллекции можно искать книги и открывать их карточки. Перейдите туда, чтобы продолжить.",
        caption: "Откройте коллекцию",
        reduced: "Откройте коллекцию",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.collection:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "07cd3adf2a101cd5423f260b8f76d26ec2b067eeab0bb5d119df96c56a363004",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "df0f98887ff34acd41528f356f30ddbb767d1481192533f6cfbb32a091bd671f",
    },
    checksum: "a03eca4a051f14ec0510dfa29241909f126a3e1dfc4b849b407f9951bf05695e",
  },
  {
    payload: {
      id: "navigation.overview.collection", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:collection",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Open the collection",
        body: "Browse books and open their details in the collection. Open it to continue.",
        caption: "Open the collection",
        reduced: "Open the collection",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.collection:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "bc77c487f199122015d795b5c6c9bb91fcc69b09a2e2e9826a6b63d27d3a481f",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "e1e564385a2a9433da2d13df5f711448668761b98c0c97f5461edd57b44a543d",
    },
    checksum: "8807076b7e6607c8acb458456db02ca95fd633fcdbc9e3e67ecfde123995fa8a",
  },
  {
    payload: {
      id: "navigation.overview.appearance", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:appearance",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Оформите глобус",
        body: "Вернитесь к глобусу и откройте «Оформление». Можно примерить подставку и фон, затем применить выбор или отменить его.",
        caption: "Оформите глобус",
        reduced: "Оформите глобус",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.appearance:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "fc50ab52fa27624e2e0ba2b4fd06057b726cc8bcda4a6c4052ae0da509f35a8b",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "ffc18025df5b7048e595dbd3a971725fb5a44a34dbcc99e541818c6aaa1e2a0e",
    },
    checksum: "174aa3cef057a9ae0538c4b41fc588eb39b4969701e22b8cd326b60ad20b0f9a",
  },
  {
    payload: {
      id: "navigation.overview.appearance", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:overview:appearance",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Choose the globe's appearance",
        body: "Return to the globe and open Appearance. Preview a stand and background, then apply your choice or cancel.",
        caption: "Choose the globe's appearance",
        reduced: "Choose the globe's appearance",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.overview.steps.appearance:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "92356c27de8fde148c1dcbc27384226f51452e5abc418ae46b547306511c155c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "df80750ed8ac128f233b6b1a2f6a9a6f1dc5c4af3caa588a6a42b4367a176aaa",
    },
    checksum: "7e1cd49fa1352986895a27e4095c5857958bdddce015e24b1e05b2b02d7adb42",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-country", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:country-to-book:choose-country",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Выберите страну",
        body: "Выберите страну на глобусе или найдите её через поиск. После выбора станет доступен следующий шаг.",
        caption: "Выберите страну",
        reduced: "Выберите страну",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-country:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "a5b15413ab581efe5743d46b1b531ec92c9bd78a9b47b164dce0af4ca564efe8",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "90306856231325474f8c7af626a4a356882dc0aab054aa52ea900b4128245d22",
    },
    checksum: "01d84c918736f7aa5c933ccc563a45f8fe8e3ba54a2faf07e3ffa183cc8c5780",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-country", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:country-to-book:choose-country",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Choose a country",
        body: "Choose a country on the globe or find it through search. Then you can go to the next step.",
        caption: "Choose a country",
        reduced: "Choose a country",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-country:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "9323c54df68b66bc901937a445ba0e0cc955b6bd04513db8cf86ae68cc1475a1",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "ad654a0c6c0798c049777592267945e6f554ae0fa730918db3fbb28882c82f1a",
    },
    checksum: "863544bce4b6b18d18a855471a9c4ba47e8a176560fc2f4ac7dd03d3a8ae025c",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-writer", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:country-to-book:choose-writer",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Выберите писателя",
        body: "Откройте архив выбранной страны и выберите писателя из списка.",
        caption: "Выберите писателя",
        reduced: "Выберите писателя",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-writer:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "f3acfdb0b61e092e17e9c16a972c6232e2e1eec1356def4a302c1fec3a0f14fc",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "f0c51a7b015ca4d21e037d2861cdff6176fb649ed7785a517acc06616a03a139",
    },
    checksum: "534708e3d687baedfbacd58851972b0946a0c917c69718e5703aa382397b6c16",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-writer", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:country-to-book:choose-writer",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Choose a writer",
        body: "Open the selected country's archive and choose a writer from the list.",
        caption: "Choose a writer",
        reduced: "Choose a writer",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-writer:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "1688ce3bdd4f4d53bf7e4c512fa5a8d79ab6da111b6755c7395b87e964e33523",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "83a792383620d1a871f3422e117a4b13061f92f23df91eb676ae9264cfaf6230",
    },
    checksum: "cbb2dfec8ed0722d1eafb4030ce3ced65f81ee9f5b7bb5569e6d6260a66f31f9",
  },
  {
    payload: {
      id: "navigation.country-to-book.open-books", locale: "ru", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:country-to-book:open-books",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Продолжите с книгами",
        body: "Откройте книги выбранного писателя в коллекции. Завершить маршрут можно, когда они будут показаны.",
        caption: "Продолжите с книгами",
        reduced: "Продолжите с книгами",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.country-to-book.steps.open-books:ru",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "0601303c07c807fc57ac34c0e7e8a4e96bf990fbceab8500de66c3b7da756787",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "25a04e15971af9fe08df17841ccdd37720ac15e9bf50cf50674095da1d3930db",
    },
    checksum: "70fd2ea43432c93a7595141e8ca756e7d41473b8a4f365c90975ed42e52d5222",
  },
  {
    payload: {
      id: "navigation.country-to-book.open-books", locale: "en", version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe","collection"], context: "tour:country-to-book:open-books",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Continue with books",
        body: "Open the selected writer's books in the collection. You can finish the tour when they are shown.",
        caption: "Continue with books",
        reduced: "Continue with books",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 1,
        sourceRef: "5e6eb7676367f71731fa84f9b2e69249c48bcb06:PLANET_MASCOT_ROUTES.country-to-book.steps.open-books:en",
        sourceSha256: "c25be7713363e1f438f114fda0a314ffc3f06789fc76e67ef422657d9ae4cfaf",
        copySha256: "21d683f52cc02970a53b271fd1be7e12e362fdbab813e4325a95efa0b15f96c5",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2064c4bd0bb3829517a3a60102e5a0b2f342d4e28a995d47694776b07040ffa6",
    },
    checksum: "4c34eac2305b4406ac639c8b9e420cfbb5e977994c9c8ee716cd32e0f105ec3a",
  },
  {
    payload: {
      id: "guidance.globe", locale: "ru", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe"], context: "help:globe",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Книжулик",
        body: "Начните со страны на глобусе или найдите писателя через поиск. Могу показать путь от страны к книгам.",
        caption: "Книжулик",
        reduced: "Книжулик",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.globe:ru",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "27ab56b59dfa7e8257703434a055f2919bbb3e05cae56c439ce0bcf6130fa612",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "d333ad5c14ec72992f31dd0007ab5db9d81779b8d6b4cd967e8bb54f1e9aa285",
    },
    checksum: "b37ed3093f0687d9234b2874cb32e5dd84776552b6b313ef2f5c58061ffd0b89",
  },
  {
    payload: {
      id: "guidance.globe", locale: "en", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe"], context: "help:globe",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Mr. Booky",
        body: "Start with a country on the globe or search for a writer. I can show you the route from a country to books.",
        caption: "Mr. Booky",
        reduced: "Mr. Booky",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.globe:en",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "5d6556c7ee38bf23d8dc75accca2cf62de585505f2ef04973a08be580f09e91d",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "cde2fa86ec6f9d475e3b7aa7e93771b0c1196c75eb7dafde6b74b541248199d4",
    },
    checksum: "0ba1821c1053af0ca29a1dea362702ed0b8a58baec2ef55b2d684d32f3ed3a6c",
  },
  {
    payload: {
      id: "guidance.country", locale: "ru", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe"], context: "help:country",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Книжулик",
        body: "Страна выбрана. В её архиве можно выбрать писателя, а затем перейти к его книгам.",
        caption: "Книжулик",
        reduced: "Книжулик",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.country:ru",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "ab19a53a3ca8f596de23f551812a21e2bbeb3f22f349ecd7b35eba9962c063ea",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "b0f1bf13d42b3b5fdef683ae1ddc838d1504e074ee29dd54f874ea1210e04c49",
    },
    checksum: "e8722ae83a7ce248c205747f1d36142c2ac30acb433ee828356c4641a8bf9dbc",
  },
  {
    payload: {
      id: "guidance.country", locale: "en", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe"], context: "help:country",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Mr. Booky",
        body: "A country is selected. Choose a writer in its archive, then explore their books.",
        caption: "Mr. Booky",
        reduced: "Mr. Booky",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.country:en",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "e89dbc3c808272f9d7a548d9f06f5d6e437e72a1eb4330ec5f6a3db1691aacfa",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "781fa51fa0381c1fd2a97aab03b825105bcf42ce32c75e6a3873356c43a74cb4",
    },
    checksum: "c5e48547d78c98f929a90d7b550c2e03ed63010b77ba5ca915ef96270cbdbad0",
  },
  {
    payload: {
      id: "guidance.writer", locale: "ru", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe"], context: "help:writer",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Книжулик",
        body: "Писатель выбран. Откройте его книги или продолжите исследовать архив страны.",
        caption: "Книжулик",
        reduced: "Книжулик",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.writer:ru",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "ea1a3a737dd177f4b85cd7a8b813bb2654bd1ec77ea6572a6ad950c4d8bfec1f",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "daf019272cd4464507b9ef7b92988a81a0540b6b5e513c9f753586e898414f9d",
    },
    checksum: "59b0b78501cd10a5f4778dc93fb50ed62600525eb8a4e52536eb021ec1e534c9",
  },
  {
    payload: {
      id: "guidance.writer", locale: "en", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["globe"], context: "help:writer",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Mr. Booky",
        body: "A writer is selected. Open their books or keep exploring the country's archive.",
        caption: "Mr. Booky",
        reduced: "Mr. Booky",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.writer:en",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "ff636a208acd0c12b8a31fd0b8e5b9fca00e78fc66d996cd19da554e77f6dc82",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "05e9654627056f40adcc93cdb9ee3088734598b1eaa05403c00022797169b891",
    },
    checksum: "ddcdeac4f81ee1031982f9ab81842dcaf84c636e58d5893532252ee2db478b1d",
  },
  {
    payload: {
      id: "guidance.collection", locale: "ru", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["collection"], context: "help:collection",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Книжулик",
        body: "Вы в коллекции. Здесь можно искать книги, менять фильтры и открывать карточки. К глобусу можно вернуться в любой момент.",
        caption: "Книжулик",
        reduced: "Книжулик",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.collection:ru",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "12ab4c9bda6171a785adf109398e7fa8618b965f8f53fac6af041b3b2ff3e443",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "a07b144b505ab64b02188a704ae580673ae362dd14ca6d92abacdcb165b5ccce",
    },
    checksum: "694e80c0f5fccbe1b4945688ef1802fdfc50ad71ad3f2a8008d165bc88047694",
  },
  {
    payload: {
      id: "guidance.collection", locale: "en", version: 2, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation",
      screens: ["collection"], context: "help:collection",
      entityIds: [], claimKind: "interface-guidance", factualSources: [],
      copy: {
        title: "Mr. Booky",
        body: "You are in the collection. Search books, adjust filters and open their details. You can return to the globe at any time.",
        caption: "Mr. Booky",
        reduced: "Mr. Booky",
      },
      narration: null, prohibitedTags: [],
      provenance: {
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 2,
        sourceRef: "c5f8e80ab3b8f6be42e04584a0b174ac427197e7:PlanetMascotControls.name+helpTip.collection:en",
        sourceSha256: "52c7cb81a3adc70f57319b48a339111591254fe6aacb76738bf3ce2542dc8486",
        copySha256: "c153e034391e99b5556fbcb879300fcd18c3a80ba9133d6ea0d24fd7c96ccf5c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "68623d1f111d185d9e12de949614e1093c12083127cc63bdb0575e4822c2c04b",
    },
    checksum: "6f5305a178402ae07ab6a8c904f83ed0b51f26daf17444fcd88a1ba6b53e3707",
  }
] satisfies BookyDialogueRecord[]);
