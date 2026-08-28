export const BOOK_SHELF_QUALITY_PROFILES = [
  "ECONOMY",
  "BALANCED",
  "HIGH",
] as const;

export type BookShelfQualityProfile =
  (typeof BOOK_SHELF_QUALITY_PROFILES)[number];

export type BookShelfQualityPreference = "auto" | BookShelfQualityProfile;

export type BookShelfQualitySignals = Readonly<{
  viewportWidth: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
  preference?: BookShelfQualityPreference;
}>;

export type NormalizedBookShelfQualitySignals = Readonly<{
  viewportWidth: number;
  viewportHeight: number | null;
  devicePixelRatio: number;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
  reducedMotion: boolean;
  preference: BookShelfQualityPreference;
}>;

export type BookShelfTextureBudgets = Readonly<{
  shelf: number;
  selectedHighResolution: 1;
}>;

export type BookShelfQualitySettings = Readonly<{
  profile: BookShelfQualityProfile;
  mobile: boolean;
  liveBookLimit: number;
  textureBudgets: BookShelfTextureBudgets;
  textureResolution: Readonly<{
    neighbour: 256 | 384 | 512;
    focused: 512 | 640 | 768;
    inspection: 1024 | 1536 | 2048;
  }>;
  dpr: readonly [minimum: 1, maximum: number];
  shadows: "selected-contact" | "selected-dynamic" | "selected-soft";
  pageSegments: Readonly<{ width: number; height: number }>;
  ambientTintStrength: number;
  motion: Readonly<{
    reduced: boolean;
    inertia: boolean;
    transitionScale: 0 | 1;
  }>;
}>;

export const BOOK_SHELF_QUALITY_RECOVERY_SAMPLES = 3;

export type BookShelfQualityController = Readonly<{
  profile: BookShelfQualityProfile;
  ceiling: BookShelfQualityProfile;
  signals: NormalizedBookShelfQualitySignals;
  recoverySamples: number;
  revision: number;
}>;

export type BookShelfQualityControllerEvent =
  | Readonly<{
      type: "signals";
      signals: BookShelfQualitySignals;
    }>
  | Readonly<{
      type: "degrade";
    }>
  | Readonly<{
      type: "recover";
    }>;

export type BookShelfTextureKind = "shelf" | "selected-high-resolution";

export type BookShelfTextureLruEntry = Readonly<{
  key: string;
  kind: BookShelfTextureKind;
}>;

export type BookShelfTextureLru = Readonly<{
  budgets: BookShelfTextureBudgets;
  /** Least-recently-used first. */
  entries: readonly BookShelfTextureLruEntry[];
}>;

export type BookShelfTextureLruResult = Readonly<{
  cache: BookShelfTextureLru;
  evicted: readonly BookShelfTextureLruEntry[];
}>;

const profileRank: Readonly<Record<BookShelfQualityProfile, number>> = {
  ECONOMY: 0,
  BALANCED: 1,
  HIGH: 2,
};

const finitePositive = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

const wholePositive = (value: number | null | undefined) => {
  const normalized = finitePositive(value);
  return normalized === null ? null : Math.max(1, Math.trunc(normalized));
};

export function normalizeBookShelfQualitySignals(
  signals: BookShelfQualitySignals | NormalizedBookShelfQualitySignals
): NormalizedBookShelfQualitySignals {
  return {
    viewportWidth: wholePositive(signals.viewportWidth) ?? 1,
    viewportHeight: wholePositive(signals.viewportHeight),
    devicePixelRatio: finitePositive(signals.devicePixelRatio) ?? 1,
    deviceMemoryGb: finitePositive(signals.deviceMemoryGb),
    hardwareConcurrency: wholePositive(signals.hardwareConcurrency),
    saveData: signals.saveData === true,
    reducedMotion: signals.reducedMotion === true,
    preference: signals.preference ?? "auto",
  };
}

function isLowCapability(signals: NormalizedBookShelfQualitySignals) {
  return (
    (signals.deviceMemoryGb !== null && signals.deviceMemoryGb <= 2) ||
    (signals.hardwareConcurrency !== null && signals.hardwareConcurrency <= 2)
  );
}

function isHighCapability(signals: NormalizedBookShelfQualitySignals) {
  return (
    signals.viewportWidth >= 1440 &&
    signals.deviceMemoryGb !== null &&
    signals.deviceMemoryGb >= 8 &&
    signals.hardwareConcurrency !== null &&
    signals.hardwareConcurrency >= 8
  );
}

/**
 * Selects a quality ceiling from stable device/user signals. Reduced motion is
 * carried into the motion policy without lowering settled cover fidelity.
 */
export function resolveBookShelfQualityProfile(
  input: BookShelfQualitySignals | NormalizedBookShelfQualitySignals
): BookShelfQualityProfile {
  const signals = normalizeBookShelfQualitySignals(input);
  if (
    signals.preference === "ECONOMY" ||
    signals.saveData ||
    signals.viewportWidth < 768 ||
    isLowCapability(signals)
  ) {
    return "ECONOMY";
  }
  if (signals.preference === "BALANCED") return "BALANCED";
  if (signals.preference === "HIGH") {
    return signals.viewportWidth >= 1024 ? "HIGH" : "BALANCED";
  }
  return isHighCapability(signals) ? "HIGH" : "BALANCED";
}

export function resolveBookShelfQualitySettings(
  input: BookShelfQualitySignals | NormalizedBookShelfQualitySignals,
  forcedProfile?: BookShelfQualityProfile
): BookShelfQualitySettings {
  const signals = normalizeBookShelfQualitySignals(input);
  const ceiling = resolveBookShelfQualityProfile(signals);
  const profile =
    forcedProfile && profileRank[forcedProfile] <= profileRank[ceiling]
      ? forcedProfile
      : ceiling;
  const mobile = signals.viewportWidth < 768;

  const textureResolution =
    profile === "HIGH"
      ? ({ neighbour: 512, focused: 768, inspection: 2048 } as const)
      : profile === "BALANCED"
        ? ({ neighbour: 384, focused: 640, inspection: 1536 } as const)
        : ({ neighbour: 256, focused: 512, inspection: 1024 } as const);
  const maximumDpr =
    profile === "HIGH" ? 2 : profile === "BALANCED" ? 1.5 : 1.25;
  const liveBookLimit = mobile
    ? profile === "ECONOMY"
      ? 7
      : 9
    : signals.viewportWidth < 1100
      ? profile === "ECONOMY"
        ? 11
        : 13
      : profile === "HIGH"
        ? 21
        : 17;

  return {
    profile,
    mobile,
    liveBookLimit,
    textureBudgets: {
      shelf: mobile || profile === "ECONOMY" ? 16 : 32,
      selectedHighResolution: 1,
    },
    textureResolution,
    dpr: [1, Math.max(1, Math.min(signals.devicePixelRatio, maximumDpr))],
    shadows:
      profile === "HIGH"
        ? "selected-dynamic"
        : profile === "BALANCED"
          ? "selected-soft"
          : "selected-contact",
    pageSegments:
      profile === "HIGH"
        ? { width: 32, height: 6 }
        : profile === "BALANCED"
          ? { width: 24, height: 4 }
          : { width: 16, height: 3 },
    ambientTintStrength:
      profile === "HIGH" ? 1 : profile === "BALANCED" ? 0.72 : 0.48,
    motion: {
      reduced: signals.reducedMotion,
      inertia: !signals.reducedMotion,
      transitionScale: signals.reducedMotion ? 0 : 1,
    },
  };
}

export function createBookShelfQualityController(
  input: BookShelfQualitySignals
): BookShelfQualityController {
  const signals = normalizeBookShelfQualitySignals(input);
  const ceiling = resolveBookShelfQualityProfile(signals);
  return {
    profile: ceiling,
    ceiling,
    signals,
    recoverySamples: 0,
    revision: 0,
  };
}

function profileAtRank(rank: number): BookShelfQualityProfile {
  return BOOK_SHELF_QUALITY_PROFILES[
    Math.max(0, Math.min(BOOK_SHELF_QUALITY_PROFILES.length - 1, rank))
  ];
}

function sameSignals(
  left: NormalizedBookShelfQualitySignals,
  right: NormalizedBookShelfQualitySignals
) {
  return (
    left.viewportWidth === right.viewportWidth &&
    left.viewportHeight === right.viewportHeight &&
    left.devicePixelRatio === right.devicePixelRatio &&
    left.deviceMemoryGb === right.deviceMemoryGb &&
    left.hardwareConcurrency === right.hardwareConcurrency &&
    left.saveData === right.saveData &&
    left.reducedMotion === right.reducedMotion &&
    left.preference === right.preference
  );
}

/**
 * Immediate one-tier degradation and three-sample one-tier recovery prevent
 * oscillation. A recovered profile can never exceed the current device ceiling.
 */
export function reduceBookShelfQualityController(
  state: BookShelfQualityController,
  event: BookShelfQualityControllerEvent
): BookShelfQualityController {
  if (event.type === "signals") {
    const signals = normalizeBookShelfQualitySignals(event.signals);
    const ceiling = resolveBookShelfQualityProfile(signals);
    const profile =
      profileRank[state.profile] > profileRank[ceiling]
        ? ceiling
        : state.profile;
    if (
      sameSignals(state.signals, signals) &&
      state.ceiling === ceiling &&
      state.profile === profile &&
      state.recoverySamples === 0
    ) {
      return state;
    }
    return {
      profile,
      ceiling,
      signals,
      recoverySamples: 0,
      revision: state.revision + 1,
    };
  }

  if (event.type === "degrade") {
    if (state.profile === "ECONOMY") return state;
    return {
      ...state,
      profile: profileAtRank(profileRank[state.profile] - 1),
      recoverySamples: 0,
      revision: state.revision + 1,
    };
  }

  if (profileRank[state.profile] >= profileRank[state.ceiling]) {
    if (state.recoverySamples === 0) return state;
    return { ...state, recoverySamples: 0 };
  }
  const recoverySamples = state.recoverySamples + 1;
  if (recoverySamples < BOOK_SHELF_QUALITY_RECOVERY_SAMPLES) {
    return { ...state, recoverySamples };
  }
  return {
    ...state,
    profile: profileAtRank(profileRank[state.profile] + 1),
    recoverySamples: 0,
    revision: state.revision + 1,
  };
}

export function bookShelfQualityControllerSettings(
  state: BookShelfQualityController
) {
  return resolveBookShelfQualitySettings(state.signals, state.profile);
}

export function createBookShelfTextureLru(
  settings: Pick<BookShelfQualitySettings, "textureBudgets">
): BookShelfTextureLru {
  return { budgets: settings.textureBudgets, entries: [] };
}

function trimTextureEntries(
  entries: readonly BookShelfTextureLruEntry[],
  budgets: BookShelfTextureBudgets
): BookShelfTextureLruResult {
  const retained = [...entries];
  const evicted: BookShelfTextureLruEntry[] = [];
  const limitFor = (kind: BookShelfTextureKind) =>
    kind === "shelf" ? budgets.shelf : budgets.selectedHighResolution;

  for (const kind of [
    "shelf",
    "selected-high-resolution",
  ] as const satisfies readonly BookShelfTextureKind[]) {
    let count = retained.filter((entry) => entry.kind === kind).length;
    while (count > limitFor(kind)) {
      const oldestIndex = retained.findIndex((entry) => entry.kind === kind);
      if (oldestIndex < 0) break;
      const [oldest] = retained.splice(oldestIndex, 1);
      evicted.push(oldest);
      count -= 1;
    }
  }

  return { cache: { budgets, entries: retained }, evicted };
}

export function touchBookShelfTextureLru(
  cache: BookShelfTextureLru,
  entry: BookShelfTextureLruEntry
): BookShelfTextureLruResult {
  const key = entry.key.trim();
  if (!key) throw new TypeError("Texture LRU requires a non-empty key");
  const entries = cache.entries.filter(
    (current) => current.kind !== entry.kind || current.key !== key
  );
  entries.push({ key, kind: entry.kind });
  return trimTextureEntries(entries, cache.budgets);
}

export function reconcileBookShelfTextureLru(
  cache: BookShelfTextureLru,
  settings: Pick<BookShelfQualitySettings, "textureBudgets">
): BookShelfTextureLruResult {
  if (cache.budgets === settings.textureBudgets) {
    return { cache, evicted: [] };
  }
  return trimTextureEntries(cache.entries, settings.textureBudgets);
}
