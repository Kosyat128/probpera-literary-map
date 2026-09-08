import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePlatformSnapshot } from "../platform/PlatformServices";
import type { WebLicenseClient, WebLicenseDenial } from "../platform/adapters/web/WebLicense";
import { createPwaLicenseRuntime } from "./PwaLicenseRuntime";
import PwaAccessBoundary from "./PwaAccessBoundary";
import PwaHelp from "./PwaHelp";

export type PwaLicenseRuntime = ReturnType<typeof createPwaLicenseRuntime>;
/** One identity runtime belongs to the distribution, never to a locale or route. */
export default function PwaEdition({ runtime, children, connectivityNotice }: {
  runtime: PwaLicenseRuntime;
  children: ReactNode;
  connectivityNotice?: ReactNode;
}) {
  const { connectivity, visibility } = usePlatformSnapshot();
  const initialRuntime = useRef(runtime);
  if (initialRuntime.current !== runtime) throw new Error("PWA identity runtime must remain stable for this application mount");
  const [attempt, setAttempt] = useState(0);
  const previousVisibility = useRef(visibility);
  useEffect(() => {
    const regainedFocus = previousVisibility.current !== "active" && visibility === "active";
    previousVisibility.current = visibility;
    if (regainedFocus) setAttempt(value => value + 1);
  }, [visibility]);
  const [access, setAccess] = useState<{client: WebLicenseClient | null; reason: WebLicenseDenial | null; checking: boolean}>({
    ...runtime.getSnapshot(), checking: true,
  });
  const generation = useRef(0);
  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && id === generation.current;
    setAccess(previous => ({ ...previous, checking: true }));
    void (async () => {
      const mode = connectivity === "offline" ? "offline" : "online";
      let result = await runtime.bootstrap({ mode, signal: controller.signal });
      if (!current()) return;
      if (mode === "online" && (result.reason === "network-unavailable" || result.reason === "timeout")) {
        result = await runtime.bootstrap({ mode: "offline", signal: controller.signal });
      }
      if (current()) setAccess({ ...result, checking: false });
    })().catch(() => {
      if (current()) setAccess({ client: null, reason: "network-unavailable", checking: false });
    });
    return () => { controller.abort(); };
  }, [runtime, connectivity, attempt]);
  return (
    <PwaAccessBoundary
      client={access.client}
      closedHelp={<PwaHelp />}
      connectivityNotice={connectivityNotice}
      bootstrapStatus={{ checking: access.checking, reason: access.reason }}
      onBootstrapRetry={access.reason === "unconfigured" || access.reason === "invalid-key" ? undefined : () => setAttempt(value => value + 1)}
    >
      {children}
    </PwaAccessBoundary>
  );
}
