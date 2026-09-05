/** Platform capabilities; canonical selection, locale and scene state live elsewhere. */
export type PlatformKind = "web" | "android" | "ios";
export type DistributionChannel = "web" | "dev" | "googlePlay" | "ruStore" | "appStore";
export type Connectivity = "online" | "offline" | "unknown";
export type ApplicationVisibility = "active" | "background";
export interface PlatformSnapshot {
  readonly connectivity: Connectivity;
  readonly visibility: ApplicationVisibility;
}

/** Non-secret preferences only. This interface cannot store proof of ownership. */
export interface PreferenceStore {
  readonly persistence: "best-effort" | "durable";
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<boolean>;
}
export type OpenLinkResult = "opened" | "requested" | "blocked" | "unavailable";

export interface PlatformServices {
  readonly kind: PlatformKind;
  readonly channel: DistributionChannel;
  readonly preferences: PreferenceStore;
  /** Snapshot identity must be stable until one of its values changes. */
  getSnapshot(): PlatformSnapshot;
  /** Listener cleanup must be idempotent; subscriptions never own scene state. */
  subscribe(listener: () => void): () => void;
  /** Language preferences only, never IP, SIM, nationality or store territory. */
  getSystemLanguages(): readonly string[];
  /** Explicit user action only; does not load remote executable app code. */
  openExternalLink(url: string): OpenLinkResult | Promise<OpenLinkResult>;
}
