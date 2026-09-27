import type { BookyDialogueRecord } from "./bookyDialogueRegistry";

// Explicit source provenance rebaseline: navigation drafts use revision 2
// and contextual drafts revision 3. Existing copy and review status stay exact.
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
      "sourceCommit": "798c072e61176cc191ceaacff0e18f1b6622dbd2",
      "sourceVersion": 3,
      "sourceSha256": "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
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
      id: "guidance.globe", locale: "ru", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.globe:ru",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "27ab56b59dfa7e8257703434a055f2919bbb3e05cae56c439ce0bcf6130fa612",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "47217795d44a49cf3c5cc7e671fd388e46e2bdf19eb4d2a6853874cc81e4970a",
    },
    checksum: "e3b31c9d890c8a16428e68ce776d560e41ec81cdb6911cbcdeea2190671d3711",
  },
  {
    payload: {
      id: "guidance.globe", locale: "en", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.globe:en",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "5d6556c7ee38bf23d8dc75accca2cf62de585505f2ef04973a08be580f09e91d",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "dfbf64617c7ec4997bfa64190a247733e8eee977839e3aa1668b4df069c4e852",
    },
    checksum: "b1165b34c7563a4d90ab6711b7c85b6d539974b4f92114458ff8d1a0884e6b10",
  },
  {
    payload: {
      id: "guidance.country", locale: "ru", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.country:ru",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "ab19a53a3ca8f596de23f551812a21e2bbeb3f22f349ecd7b35eba9962c063ea",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "c26be64d313431965b08b5ca8520172fb711a3e4cb2356bf804fa0a94e3e5183",
    },
    checksum: "3dedf4a989602da9517ff6f51184cfd2bc69e3a0a7b37264464f1a24b4a6ea61",
  },
  {
    payload: {
      id: "guidance.country", locale: "en", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.country:en",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "e89dbc3c808272f9d7a548d9f06f5d6e437e72a1eb4330ec5f6a3db1691aacfa",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "2f6f1bc4da3240a8edc6d293963f5ad914ea1d92493110b63a7ff024a9882e38",
    },
    checksum: "0066c73eb4208de119d4d00b4b30428d3d56ab235bf034498f11abd4a7803385",
  },
  {
    payload: {
      id: "guidance.writer", locale: "ru", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.writer:ru",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "ea1a3a737dd177f4b85cd7a8b813bb2654bd1ec77ea6572a6ad950c4d8bfec1f",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "866a1799aee0018d28f448a0a8c7b4d15dba8336118b1e6ddcc9ecc814357f9c",
    },
    checksum: "fb28e2719814c660492ca053b4298882ed5b9b1079d595946cd95b1e586f6446",
  },
  {
    payload: {
      id: "guidance.writer", locale: "en", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.writer:en",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "ff636a208acd0c12b8a31fd0b8e5b9fca00e78fc66d996cd19da554e77f6dc82",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "35ba093860ddd591aa4639546b64c6633a097fa534ddbe5674307211cd099b7b",
    },
    checksum: "c7464877405df366e1647a246f833338925e584e5408ee8d2effb5f06dac4c1d",
  },
  {
    payload: {
      id: "guidance.collection", locale: "ru", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.collection:ru",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "12ab4c9bda6171a785adf109398e7fa8618b965f8f53fac6af041b3b2ff3e443",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "6b679c3891cc5bce03c2b30a30f49ca80fac7c28a3d4c93be572827006aee0a6",
    },
    checksum: "595c922ec8ba2101c7ed0681bd858706d05d75fd1195c647a7eccf6ee010d59b",
  },
  {
    payload: {
      id: "guidance.collection", locale: "en", version: 3, audience: "adult",
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
        kind: "existing-interface-copy", sourcePath: "src/host/PlanetMascotControls.tsx", sourceVersion: 3,
        sourceRef: "798c072e61176cc191ceaacff0e18f1b6622dbd2:PlanetMascotControls.name+helpTip.collection:en",
        sourceSha256: "44628a5d44731d4fb8f826490713dea75a2341ddfc58e419fe6e64471794a79b",
        copySha256: "c153e034391e99b5556fbcb879300fcd18c3a80ba9133d6ea0d24fd7c96ccf5c",
      },
    },
    review: {
      status: "draft", reviewer: null, reviewedAt: null,
      contentChecksum: "a7bfa7c354f9117c2d3c1e45caaa0e2e2264c6258a61f4f7a2c5a62e2f61449b",
    },
    checksum: "0b9bde360cb445e11bc432ae0f0fcf82700d789056d84d40fe86517a91e40cac",
  }
] satisfies BookyDialogueRecord[]);
