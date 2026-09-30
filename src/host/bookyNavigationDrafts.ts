import type { BookyDialogueRecord } from "./bookyDialogueRegistry";

// Explicit source provenance rebaseline: navigation drafts use revision 2
// and contextual drafts revision 7. Existing copy and review status stay exact.
// Draft revisions are independent of the unchanged version-1 runtime tours.
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
      "sourceCommit": "798c072e61176cc191ceaacff0e18f1b6622dbd2",
      "sourceVersion": 2,
      "sourceSha256": "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
      "sourceHashEncoding": "sha256:utf8:lf",
      "copyHashEncoding": "sha256:utf8:JSON.stringify({title,body})"
    },
    {
      "sourcePath": "src/host/PlanetMascotControls.tsx",
      "sourceCommit": "aba461a774c125f9c38ea4c10aac9b3cc8024d2d",
      "sourceVersion": 7,
      "sourceSha256": "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
      "sourceHashEncoding": "sha256:utf8:lf",
      "copyHashEncoding": "sha256:utf8:JSON.stringify({title,body})"
    }
  ]
} as const);

export const BOOKY_NAVIGATION_DRAFTS: readonly BookyDialogueRecord[] = freeze([
  {
    payload: {
      id: "navigation.overview.search", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.search:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "064b0098e09346deae05aa11178c0d2abaa613621c67f8b843f68e4aac037878",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "bb6731d2e87d1619ea470caf01a0be444777e58aef7d7ba4c0bb547fb2110968",
    },
    checksum: "3af3e575c0ce930dff6276ddde57ac5f2a16da05861b8ee6252a649e5a932851",
  },
  {
    payload: {
      id: "navigation.overview.search", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.search:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "c276f48220c3a154de837df6b3277e69b8c7480f06c2e9f364f1c2de61bfa004",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "5fb915136459b6b3efc61212713206ff1cf93079eb90b6ff89d71595346370e6",
    },
    checksum: "28d5e3401d01ba62bfbfd3b28554e276959a21c4c2e6b5873ae75a9802fb432a",
  },
  {
    payload: {
      id: "navigation.overview.country", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.country:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "77a496b056fe0a836ed63a9932707dcb8ebe6b71d6fd5bab2b64065b60d8d5a0",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "42999f00a90c37c27d16503f622af5084831e711abe31c8db8390688b3762a5c",
    },
    checksum: "10b667317b894536062611f172e9dba1642873194ef6b604173eeb8a0f12f97f",
  },
  {
    payload: {
      id: "navigation.overview.country", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.country:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "9ed67151d3ff85dcd68914c16b75075bdeb529ae335f710bf2e4d514c1b51546",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "992e0bd0efc0c1d9ddc2cb6063e0af669b937ab5baf55962076f2123fd8daf7d",
    },
    checksum: "6c9f6e351f8ae042a38d6fc9cc4e96c38ffc4c693e8a4145c057b0c57e702427",
  },
  {
    payload: {
      id: "navigation.overview.collection", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.collection:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "07cd3adf2a101cd5423f260b8f76d26ec2b067eeab0bb5d119df96c56a363004",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "06688440b329f0a0cdc368d55bfcdcbd5bbdcb6176a49ddf8fe3cc14a6e83808",
    },
    checksum: "3f5aaef0291d5a294d489e48acc7dc67c83d7ad975612f3d8bea4871a1fc97f1",
  },
  {
    payload: {
      id: "navigation.overview.collection", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.collection:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "bc77c487f199122015d795b5c6c9bb91fcc69b09a2e2e9826a6b63d27d3a481f",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2d5148852d9e99e71b1ce273e417be23659b6a1f684ec58a4b5b9f3fc5fd7247",
    },
    checksum: "e32c3b11c6fab4dc2a5edd79890160913e0bdd8dc613c89d960fa3ff1b50e3d6",
  },
  {
    payload: {
      id: "navigation.overview.appearance", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.appearance:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "fc50ab52fa27624e2e0ba2b4fd06057b726cc8bcda4a6c4052ae0da509f35a8b",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "bf78af4c12240d20510d249d32441c302f011738f1b91ea89dfe70b0c393a3a5",
    },
    checksum: "beb8b3f388609f7966e7adf40eb608eefa8340ae618ec4745505b8a26b340ae9",
  },
  {
    payload: {
      id: "navigation.overview.appearance", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.overview.steps.appearance:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "92356c27de8fde148c1dcbc27384226f51452e5abc418ae46b547306511c155c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "9ad3f12b2425cc74cf685093d074b89c04d617b80b1a388143a5d87bf4ce1e53",
    },
    checksum: "f00a2ea0109d10d43f993d4d36384682a6bf0e4227a38df2d1127a71028d69d2",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-country", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-country:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "a5b15413ab581efe5743d46b1b531ec92c9bd78a9b47b164dce0af4ca564efe8",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "7df1f82b72d9ee9c5fed77352be0d7711ac8b83d0159a48ec675d956e86232af",
    },
    checksum: "ceff9edaf3af8595b698a2d66ec3a3e7e8a3ece642820305ccd56ec3cd6e064f",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-country", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-country:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "9323c54df68b66bc901937a445ba0e0cc955b6bd04513db8cf86ae68cc1475a1",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "6ccddfb9d23944de822d27231802099d42eeb6dbdf27ef0fdc7441d4c68d1de6",
    },
    checksum: "069ff49ca0d70f4c95e156b88af97283c1556850a8f88e1a7df58bdb44d09560",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-writer", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-writer:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "f3acfdb0b61e092e17e9c16a972c6232e2e1eec1356def4a302c1fec3a0f14fc",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "b57a7701b6ef44c8a6c70a5d60917628a751bcffc2b940257c0071327ceaf153",
    },
    checksum: "a18bce1fb86ac2038932afa84cd20312a275f2979c8893999f88b2a840c245e9",
  },
  {
    payload: {
      id: "navigation.country-to-book.choose-writer", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.country-to-book.steps.choose-writer:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "1688ce3bdd4f4d53bf7e4c512fa5a8d79ab6da111b6755c7395b87e964e33523",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "8d46fdcfcdafc4290b9ed8d1c67076d280725d702b446e491861a62a7ed2da5b",
    },
    checksum: "dec2475246c69d276a2de459ca9d497320fb94ecce216a2d19f17cb8e006c9d3",
  },
  {
    payload: {
      id: "navigation.country-to-book.open-books", locale: "ru", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.country-to-book.steps.open-books:ru",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "0601303c07c807fc57ac34c0e7e8a4e96bf990fbceab8500de66c3b7da756787",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "4c2905e4d0a9a02de0355867c62bca423123dabe3badd8dbd7d5923477999fdd",
    },
    checksum: "afdd61f6c51409475b913a99c742c417f4298aeee0f591e2ec6e943f53d680a6",
  },
  {
    payload: {
      id: "navigation.country-to-book.open-books", locale: "en", version: 2, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/planetMascotRoutes.ts", sourceVersion: 2,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PLANET_MASCOT_ROUTES.country-to-book.steps.open-books:en",
        sourceSha256: "accf4dceb9e9a2e5104d9ca303f82148815bd49e49d40232a375ca00b0e47360",
        copySha256: "21d683f52cc02970a53b271fd1be7e12e362fdbab813e4325a95efa0b15f96c5",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "3849014c84d058393d2bb54aec990f098139ee40c13d56ac50e8161e11b42b57",
    },
    checksum: "9e295f97e2fe9728dbb6f169a5a6ba83a0d8ed389ea7a8287653a3a1adfe6f65",
  },
  {
    payload: {
      id: "guidance.globe", locale: "ru", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.globe:ru",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "27ab56b59dfa7e8257703434a055f2919bbb3e05cae56c439ce0bcf6130fa612",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2a183ccccff5180a0d63a29661ccd1a13b06daadfef16d021f85ef93a95d5922",
    },
    checksum: "a12d85426c42d486fcd582e33194b7ab3e99b7612acd3e60780837f4a331f242",
  },
  {
    payload: {
      id: "guidance.globe", locale: "en", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.globe:en",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "5d6556c7ee38bf23d8dc75accca2cf62de585505f2ef04973a08be580f09e91d",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "48fdcfcd128001cc664a4303fba0ed74b3d6a9dce3d6a77e69a2746c3f55c36f",
    },
    checksum: "af7499713868344a49cab10387d6b36c3f8ba3ccdf7e78c77e37bc44002827f7",
  },
  {
    payload: {
      id: "guidance.country", locale: "ru", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.country:ru",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "ab19a53a3ca8f596de23f551812a21e2bbeb3f22f349ecd7b35eba9962c063ea",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "adad1d53550d47e777bea21c408a4d901965df0c2047b3d0445e010f837d0820",
    },
    checksum: "974b8bfe6a0c95ec40ea9e85381627f0d453bb71414b137c3c50a600404ec3ce",
  },
  {
    payload: {
      id: "guidance.country", locale: "en", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.country:en",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "e89dbc3c808272f9d7a548d9f06f5d6e437e72a1eb4330ec5f6a3db1691aacfa",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "5fe71060e0bb72d2fdbe9b02f32cc6af3c1131fc5ac6822c211a851bc1e76553",
    },
    checksum: "eeade5e743c956ab986acbcb1e65ae9cf8c25e7c89c614693f2b2cd57601f31c",
  },
  {
    payload: {
      id: "guidance.writer", locale: "ru", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.writer:ru",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "ea1a3a737dd177f4b85cd7a8b813bb2654bd1ec77ea6572a6ad950c4d8bfec1f",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "c35edc8881e17b3519abd2927e252803af696015f3e78f808506034f737c20cf",
    },
    checksum: "13e0f72dfbc593ac168941cec7c81d6294ae437a58be91fee62a243c50280522",
  },
  {
    payload: {
      id: "guidance.writer", locale: "en", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.writer:en",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "ff636a208acd0c12b8a31fd0b8e5b9fca00e78fc66d996cd19da554e77f6dc82",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "0a77df8e0ad99fbf62f14badff1edbac9193d782f28a252a9afba8d6cea5b62b",
    },
    checksum: "5c3990fe3d1dbe60221901ee1fa6f6d783f20cdb40076a80aa8bcab924d787c3",
  },
  {
    payload: {
      id: "guidance.collection", locale: "ru", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.collection:ru",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "12ab4c9bda6171a785adf109398e7fa8618b965f8f53fac6af041b3b2ff3e443",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "c57cc7152edc5b5edcde773f7665b80d8e09d9dca3080cda7e361f6a28b34cf5",
    },
    checksum: "a62740b622e2debf9e27b893de6c4e2ca8ce297dd68f487b58d25f65b3ff23d2",
  },
  {
    payload: {
      id: "guidance.collection", locale: "en", version: 7, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 7,
        sourceRef: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d:PlanetMascotControls.name+helpTip.collection:en",
        sourceSha256: "c3d696a33e18f9b7d33d211b876a3397d270e017cf2bee3df19210aad56a7f88",
        copySha256: "c153e034391e99b5556fbcb879300fcd18c3a80ba9133d6ea0d24fd7c96ccf5c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "fea65edfef25b0a3c048765310b1a21501ba783c0d261ddb94d321725eb0fa52",
    },
    checksum: "d32b9fa4477a84e4ddfa9d4f6e52e200f4c59ea95a6cb434d127385d7c69f181",
  }
] satisfies BookyDialogueRecord[]);
