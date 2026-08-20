const METRIKA_SCRIPT_ID = "probpera-yandex-metrika";
const METRIKA_SCRIPT_URL = "https://mc.yandex.ru/metrika/tag.js";
const COUNTER_ID_PATTERN = /^[1-9]\d{0,14}$/u;
export const ANALYTICS_CONSENT_STORAGE_KEY =
  "probpera-analytics-consent-v1";
export const ANALYTICS_CONSENT_EVENT =
  "probpera:analytics-consent-changed";

export type AnalyticsConsent = "granted" | "denied" | "unknown";

type MetrikaArguments = [number, string, ...unknown[]];

type MetrikaQueue = ((...args: MetrikaArguments) => void) & {
  a?: MetrikaArguments[];
  l?: number;
};

type MetrikaWindow = Window & {
  ym?: MetrikaQueue;
};

type PrerenderDocument = Document & {
  prerendering?: boolean;
};

export type YandexMetrikaInstallation = {
  enabled: boolean;
  counterId: number | null;
  stop: () => void;
};

type InstallationOptions = {
  counterId?: string;
  enabled?: boolean;
  windowObject?: Window;
  documentObject?: Document;
};

export function parseYandexMetrikaCounterId(value: unknown): number | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!COUNTER_ID_PATTERN.test(normalized)) return null;
  const counterId = Number(normalized);
  return Number.isSafeInteger(counterId) ? counterId : null;
}

export function configuredYandexMetrikaCounterId(): string {
  const configured =
    typeof __YANDEX_METRIKA_COUNTER_ID__ === "string"
      ? __YANDEX_METRIKA_COUNTER_ID__.trim()
      : "";
  return parseYandexMetrikaCounterId(configured) ? configured : "";
}

export function readAnalyticsConsent(
  storage?: Pick<Storage, "getItem"> | null
): AnalyticsConsent {
  try {
    const resolvedStorage =
      storage === undefined
        ? typeof window === "undefined"
          ? null
          : window.localStorage
        : storage;
    if (!resolvedStorage) return "unknown";
    const stored = resolvedStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : "unknown";
  } catch {
    return "unknown";
  }
}

export function setAnalyticsConsent(
  consent: Exclude<AnalyticsConsent, "unknown">,
  windowObject: Window = window
) {
  try {
    windowObject.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  } catch {
    // Strict privacy modes can deny storage. The event still applies the
    // visitor's decision for the current page without pretending it persisted.
  }
  windowObject.dispatchEvent(
    new CustomEvent(ANALYTICS_CONSENT_EVENT, {
      detail: { analytics: consent },
    })
  );
}

function ensureMetrikaQueue(windowObject: MetrikaWindow): MetrikaQueue {
  if (typeof windowObject.ym === "function") return windowObject.ym;

  const queue: MetrikaQueue = (...args) => {
    queue.a = queue.a || [];
    queue.a.push(args);
  };
  queue.l = Date.now();
  windowObject.ym = queue;
  return queue;
}

function appendMetrikaScript(documentObject: Document) {
  if (documentObject.getElementById(METRIKA_SCRIPT_ID)) return;
  const script = documentObject.createElement("script");
  script.id = METRIKA_SCRIPT_ID;
  script.async = true;
  script.src = METRIKA_SCRIPT_URL;
  script.referrerPolicy = "strict-origin-when-cross-origin";
  documentObject.head.appendChild(script);
}

export function installYandexMetrika(
  options: InstallationOptions = {}
): YandexMetrikaInstallation {
  const windowObject = options.windowObject ??
    (typeof window === "undefined" ? undefined : window);
  const documentObject = options.documentObject ??
    (typeof document === "undefined" ? undefined : document);
  const enabled = options.enabled ?? import.meta.env.PROD;
  const counterId = parseYandexMetrikaCounterId(
    options.counterId ?? configuredYandexMetrikaCounterId()
  );

  if (!enabled || !counterId || !windowObject || !documentObject) {
    return { enabled: false, counterId: null, stop: () => undefined };
  }

  const metrikaWindow = windowObject as MetrikaWindow;
  const prerenderDocument = documentObject as PrerenderDocument;
  const cleanupCallbacks: Array<() => void> = [];
  let stopped = false;
  let initialized = false;
  let lastTrackedUrl = "";
  let previousUrl = documentObject.referrer || "";

  const boot = () => {
    if (stopped || initialized || prerenderDocument.prerendering) return;
    initialized = true;
    const ym = ensureMetrikaQueue(metrikaWindow);
    appendMetrikaScript(documentObject);
    ym(counterId, "init", {
      id: counterId,
      defer: true,
      clickmap: false,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
    });

    const trackCurrentPage = (force = false) => {
      if (stopped || prerenderDocument.prerendering) return;
      const currentUrl = windowObject.location.href;
      if (!force && currentUrl === lastTrackedUrl) return;
      const hitOptions: { title: string; referer?: string } = {
        title: documentObject.title,
      };
      if (previousUrl && previousUrl !== currentUrl) {
        hitOptions.referer = previousUrl;
      }
      ym(counterId, "hit", currentUrl, hitOptions);
      previousUrl = currentUrl;
      lastTrackedUrl = currentUrl;
    };

    const handleNavigation = () => trackCurrentPage();
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) trackCurrentPage(true);
    };
    windowObject.addEventListener("hashchange", handleNavigation);
    windowObject.addEventListener("popstate", handleNavigation);
    windowObject.addEventListener("probpera:navigation", handleNavigation);
    windowObject.addEventListener("pageshow", handlePageShow);

    const historyObject = windowObject.history;
    for (const method of ["pushState", "replaceState"] as const) {
      const original = historyObject?.[method];
      if (typeof original !== "function") continue;
      const wrapped: History[typeof method] = function (
        data: unknown,
        unused: string,
        url?: string | URL | null
      ) {
        original.call(historyObject, data, unused, url);
        trackCurrentPage();
      };
      historyObject[method] = wrapped;
      cleanupCallbacks.push(() => {
        if (historyObject[method] === wrapped) historyObject[method] = original;
      });
    }

    cleanupCallbacks.push(() => {
      windowObject.removeEventListener("hashchange", handleNavigation);
      windowObject.removeEventListener("popstate", handleNavigation);
      windowObject.removeEventListener("probpera:navigation", handleNavigation);
      windowObject.removeEventListener("pageshow", handlePageShow);
    });
    trackCurrentPage();
  };

  if (prerenderDocument.prerendering) {
    const handlePrerenderingChange = () => boot();
    documentObject.addEventListener(
      "prerenderingchange",
      handlePrerenderingChange,
      { once: true }
    );
    cleanupCallbacks.push(() =>
      documentObject.removeEventListener(
        "prerenderingchange",
        handlePrerenderingChange
      )
    );
  } else {
    boot();
  }

  return {
    enabled: true,
    counterId,
    stop: () => {
      stopped = true;
      cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
    },
  };
}

let activeInstallation: YandexMetrikaInstallation | null = null;
let consentListenerInstalled = false;

export function startYandexMetrika() {
  if (typeof window === "undefined") return null;

  const applyConsent = (consent: AnalyticsConsent) => {
    if (consent === "granted" && !activeInstallation) {
      activeInstallation = installYandexMetrika();
      return;
    }
    if (consent === "denied" && activeInstallation?.enabled) {
      const counterId = activeInstallation.counterId;
      activeInstallation.stop();
      if (counterId && typeof (window as MetrikaWindow).ym === "function") {
        (window as MetrikaWindow).ym?.(counterId, "destruct");
      }
      activeInstallation = null;
    }
  };

  if (!consentListenerInstalled) {
    consentListenerInstalled = true;
    window.addEventListener(ANALYTICS_CONSENT_EVENT, (event) => {
      const consent = (event as CustomEvent<{ analytics?: unknown }>).detail
        ?.analytics;
      if (consent === "granted" || consent === "denied") {
        applyConsent(consent);
      }
    });
    window.addEventListener("storage", (event) => {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
        applyConsent(readAnalyticsConsent());
      }
    });
  }

  applyConsent(readAnalyticsConsent());
  return activeInstallation;
}
