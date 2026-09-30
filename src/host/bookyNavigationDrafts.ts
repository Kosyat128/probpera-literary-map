import type { BookyDialogueRecord } from "./bookyDialogueRegistry";

// Explicit source provenance rebaseline: navigation drafts use revision 2
// and contextual drafts revision 6. Existing copy and review status stay exact.
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
      "sourceCommit": "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c",
      "sourceVersion": 6,
      "sourceSha256": "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
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
      id: "guidance.globe", locale: "ru", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.globe:ru",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "27ab56b59dfa7e8257703434a055f2919bbb3e05cae56c439ce0bcf6130fa612",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "db24e215b231a98baf6fccb849c657f90e8edd20ca0232a587d4cf7df15f4ea9",
    },
    checksum: "2ca8d2664d84a0f920e4fc98f26303cf3c1e25c9463840cf23c7b93a6e8b0ab4",
  },
  {
    payload: {
      id: "guidance.globe", locale: "en", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.globe:en",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "5d6556c7ee38bf23d8dc75accca2cf62de585505f2ef04973a08be580f09e91d",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "43bb5ca76ccdaec0d23d81f025763a3f0aae745d1da59463decf4ddcd1e757e4",
    },
    checksum: "4056265b82fe77e8c71743148ba09b73d16baf0112cedbb644da3adfcddb6395",
  },
  {
    payload: {
      id: "guidance.country", locale: "ru", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.country:ru",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "ab19a53a3ca8f596de23f551812a21e2bbeb3f22f349ecd7b35eba9962c063ea",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "0e5b53637f40a4d9ae06b0c472457a2d218cc78c2b58df1f593cd0c995d40951",
    },
    checksum: "c06a029bd546dab9dcfdb09d2e5ce19b5bb9e8003dbeaea2f4b74e99554f4a04",
  },
  {
    payload: {
      id: "guidance.country", locale: "en", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.country:en",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "e89dbc3c808272f9d7a548d9f06f5d6e437e72a1eb4330ec5f6a3db1691aacfa",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "6dccf1662825df3d4b79373039a3f9a007cc222454e092f4dac82bd33a4942b8",
    },
    checksum: "f69dedddf25ebc4d2d31ddc6c56fe3c1b1825e142a35ad5093629ea6870bd572",
  },
  {
    payload: {
      id: "guidance.writer", locale: "ru", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.writer:ru",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "ea1a3a737dd177f4b85cd7a8b813bb2654bd1ec77ea6572a6ad950c4d8bfec1f",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "5f96e653fd52d836c9c723a124b58830b732a6ae665079009663eb9fb6c4d8ee",
    },
    checksum: "9ec1d7a8ba9da2d26ac5fe8ff307757f927b8a0dbe24358990c33234249ea232",
  },
  {
    payload: {
      id: "guidance.writer", locale: "en", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.writer:en",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "ff636a208acd0c12b8a31fd0b8e5b9fca00e78fc66d996cd19da554e77f6dc82",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "a784a7f753226b4f424dd7f8c789d0fe853ba078fb30d99b94563cab32a1b3ff",
    },
    checksum: "8042f08a72dac7409b8a32d8d27a05babbdb9978eb6a230dbc66f4bf60b3f65d",
  },
  {
    payload: {
      id: "guidance.collection", locale: "ru", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.collection:ru",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "12ab4c9bda6171a785adf109398e7fa8618b965f8f53fac6af041b3b2ff3e443",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "ae85c06648566be1d75a797f54353f4775a8640012d50defa6dd150eb0cd673c",
    },
    checksum: "0f70407d63ad0d3d758255b625cd744a0044b36ad8c9165142fda80865a3a91f",
  },
  {
    payload: {
      id: "guidance.collection", locale: "en", version: 6, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 6,
        sourceRef: "5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c:PlanetMascotControls.name+helpTip.collection:en",
        sourceSha256: "f9ee5ae157e1f97d95f43171e83a60d28c181cf1264c6c9e301db135c7a022cd",
        copySha256: "c153e034391e99b5556fbcb879300fcd18c3a80ba9133d6ea0d24fd7c96ccf5c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "3e224b40c7607d07150fdd21e337891b5a0a2d82c3e924c413187338e887923e",
    },
    checksum: "fd9045f6809c3d0e9af5c820028080e5fc10ae2e9c4f03dd90f7820a9b95e703",
  }
] satisfies BookyDialogueRecord[]);
