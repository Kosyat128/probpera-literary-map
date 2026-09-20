import type { RecentHistoryStore } from "../planet/RecentHistory";
import type { ContentDownloads } from "../planet/ContentDownloads";

/** Platform capabilities; canonical selection, locale and scene state live elsewhere. */
export type PlatformKind = "web" | "android" | "ios";
export type DistributionChannel = "web" | "dev" | "googlePlay" | "ruStore" | "appStore";
export type Connectivity = "online" | "offline" | "unknown";
export type NetworkType = "wifi" | "cellular" | "ethernet" | "unknown";
export type ApplicationVisibility = "active" | "background";
export interface PlatformSnapshot {
  readonly connectivity: Connectivity;
  readonly visibility: ApplicationVisibility;
  /** Explicit transport capability only; omission means unknown, never Wi-Fi. */
  readonly networkType?: NetworkType;
  /** Observed native app-language preferences; absent when refresh is unsupported. */
  readonly systemLanguages?: readonly string[];
}

/** Non-secret preferences only. This interface cannot store proof of ownership. */
export interface PreferenceStore {
  readonly persistence: "best-effort" | "durable";
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<boolean>;
}
export type OpenLinkResult = "opened" | "requested" | "blocked" | "unavailable";

export interface PlatformNavigationListenerHandle { remove(): void | Promise<void>; }
export interface PlatformBackEvent { readonly canGoBack: boolean; }
/** Untrusted input only; the canonical application validates/resolves each URL before applying it. */
export interface PlatformNavigation {
  subscribeUrl(listener: (url: string) => void): PlatformNavigationListenerHandle | Promise<PlatformNavigationListenerHandle>;
  getLaunchUrl(): Promise<Readonly<{ url: string }> | undefined>;
  /** Android only. Receiving Back never implies permission to traverse history or exit. */
  subscribeBack?(listener: (event: PlatformBackEvent) => void): PlatformNavigationListenerHandle | Promise<PlatformNavigationListenerHandle>;
}

export interface PlatformServices {
  readonly kind: PlatformKind;
  readonly channel: DistributionChannel;
  readonly preferences: PreferenceStore;
  /** Local adult references only; never a catalog, child store or entitlement. */
  readonly recentHistory?: RecentHistoryStore;
  /** Platform-lifetime transfers; never an entitlement or catalog activation. */
  readonly downloads?: ContentDownloads;
  /** Optional native input capability; absent in ordinary Web services. No constructor subscriptions. */
  readonly navigation?: PlatformNavigation;
  /** Snapshot identity must be stable until one of its values changes. */
  getSnapshot(): PlatformSnapshot;
  /** Listener cleanup must be idempotent; subscriptions never own scene state. */
  subscribe(listener: () => void): () => void;
  /** Language preferences only, never IP, SIM, nationality or store territory. */
  getSystemLanguages(): readonly string[];
  /** Explicit user action only; does not load remote executable app code. */
  openExternalLink(url: string): OpenLinkResult | Promise<OpenLinkResult>;
}
