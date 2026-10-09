import type { SupportDiagnosticReport } from "./supportDiagnostics";

export type SupportDiagnosticSnapshot = Readonly<{
  consented: boolean; preview: string | null; failure: "unavailable" | "invalid-observation" | null;
}>;
export interface SupportDiagnosticSession {
  getSnapshot(): SupportDiagnosticSnapshot;
  subscribe(listener: () => void): () => void;
  setConsent(value: boolean): void;
  preview(): boolean;
  exportPreview(): string | null;
  clear(): void;
}
const empty: SupportDiagnosticSnapshot = Object.freeze({ consented: false, preview: null, failure: null });
/** Ephemeral local bytes only. Adult admission and explicit consent are independent checks. */
export function createSupportDiagnosticSession(options: {
  readonly canUse: () => boolean;
  readonly read: () => SupportDiagnosticReport | null;
}): SupportDiagnosticSession {
  let snapshot = empty, generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: SupportDiagnosticSnapshot) => {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) { try { listener(); } catch { /* A consumer cannot interrupt invalidation. */ } }
  };
  // A capability read can synchronously trigger lifecycle subscribers. Check its generation afterwards.
  const allowed = (revision: number) => {
    try { return options.canUse() === true && generation === revision; } catch { return false; }
  };
  function clear() { ++generation; publish(empty); }
  function unavailable(revision: number) {
    if (revision === generation) { ++generation; publish({ ...empty, failure: "unavailable" }); }
    return false;
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    clear,
    setConsent(value: boolean) {
      if (value !== true) { clear(); return; }
      const revision = generation;
      if (!allowed(revision)) { unavailable(revision); return; }
      ++generation; publish({ consented: true, preview: null, failure: null });
    },
    preview() {
      const before = generation;
      if (!snapshot.consented || !allowed(before)) return unavailable(before);
      const revision = ++generation;
      publish({ consented: true, preview: null, failure: null });
      if (revision !== generation || !snapshot.consented) return false;
      if (!allowed(revision)) return unavailable(revision);
      let bytes: string | null = null;
      try {
        const report = options.read();
        if (report) bytes = JSON.stringify(report, null, 2) + "\n";
      } catch { /* Never include exception messages or raw observations. */ }
      if (revision !== generation || !snapshot.consented) return false;
      if (!allowed(revision)) return unavailable(revision);
      if (!bytes || bytes.length > 16_384) {
        publish({ consented: true, preview: null, failure: "invalid-observation" }); return false;
      }
      publish({ consented: true, preview: bytes, failure: null });
      return revision === generation && snapshot.consented && snapshot.preview === bytes;
    },
    exportPreview() {
      const revision = generation;
      if (!snapshot.consented || !allowed(revision)) { unavailable(revision); return null; }
      return snapshot.preview;
    },
  });
}
