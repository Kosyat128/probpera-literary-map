import { createContext, useCallback, useContext, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { PlatformServices, PlatformSnapshot } from "./ports";

const ServicesContext = createContext<PlatformServices | null>(null);
const serverSnapshot: PlatformSnapshot = Object.freeze({ connectivity: "unknown", visibility: "active" });
const getServerSnapshot = () => serverSnapshot;

export function PlatformServicesProvider({ services, children }: { services: PlatformServices; children: ReactNode }) {
  const initialServices = useRef(services);
  if (initialServices.current !== services) {
    throw new Error("Platform services cannot be replaced within a mounted experience.");
  }
  return <ServicesContext.Provider value={initialServices.current}>{children}</ServicesContext.Provider>;
}

export function usePlatformServices(): PlatformServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("PlatformServicesProvider is required.");
  return services;
}

export function usePlatformSnapshot(): PlatformSnapshot {
  const services = usePlatformServices();
  const subscribe = useCallback((listener: () => void) => services.subscribe(listener), [services]);
  const getSnapshot = useCallback(() => services.getSnapshot(), [services]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
