import { useEffect } from "react";

import { readAnalyticsConsent } from "../analytics/yandexMetrika";
import { loadSupabaseClient } from "../lib/loadSupabaseClient";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";
import { useAuth } from "./AuthContext";
import { getCommunitySessionId } from "./sessionIdentity";

const viewedKey = "probpera-viewed-paths";
const previousPathKey = "probpera-previous-view-path";
const VIEW_COOLDOWN_MS = 30 * 60 * 1000;

const trackedHomeSections = new Set([
  "atlas",
  "journal",
  "calendar",
  "community",
  "archive",
  "sections",
  "about",
  "search",
]);

function currentViewPath() {
  const pathname = window.location.pathname.replace(/\/+$/u, "") || "/";
  const hash = window.location.hash.replace(/^#/u, "").split(/[?&]/u)[0];
  if (pathname === "/" && hash && trackedHomeSections.has(hash)) {
    return `/#${hash}`;
  }
  return pathname;
}

function externalReferrerHost() {
  if (!document.referrer) return null;
  try {
    const referrer = new URL(document.referrer);
    return referrer.hostname === window.location.hostname
      ? null
      : referrer.hostname.slice(0, 180);
  } catch {
    return null;
  }
}

export default function ActivityTracker() {
  const { configured, user } = useAuth();

  useEffect(() => {
    if (!configured) return;
    const clientPromise = loadSupabaseClient();
    const requestController = new AbortController();
    let active = true;

    const track = async () => {
      if (!active || readAnalyticsConsent() !== "granted") return;
      if ((document as Document & { prerendering?: boolean }).prerendering) return;
      const client = await clientPromise;
      if (!active || !client) return;
      const path = currentViewPath();
      let viewed: Record<string, number> = {};
      try {
        const stored = JSON.parse(readWebStorage("session", viewedKey) || "{}");
        viewed = Array.isArray(stored)
          ? Object.fromEntries(stored.map((item) => [String(item), 0]))
          : stored;
      } catch {
        viewed = {};
      }

      const now = Date.now();
      if (now - (viewed[path] || 0) < VIEW_COOLDOWN_MS) return;

      const previousPath = readWebStorage("session", previousPathKey);
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get("utm_source")?.slice(0, 120) || null;
      const referrerHost = externalReferrerHost();
      const navigationSource = utmSource
        ? "campaign"
        : previousPath && previousPath !== path
          ? "internal"
          : referrerHost
            ? "external"
            : "direct";
      const commonPayload = {
        path,
        session_id: getCommunitySessionId(),
        user_id: user?.id || null,
        referrer_host: referrerHost,
      };
      const extendedPayload = {
        ...commonPayload,
        previous_path: previousPath && previousPath !== path ? previousPath : null,
        navigation_source: navigationSource,
        utm_source: utmSource,
        utm_medium: params.get("utm_medium")?.slice(0, 80) || null,
        utm_campaign: params.get("utm_campaign")?.slice(0, 180) || null,
      };

      let { error } = await client
        .from("content_views")
        .insert(extendedPayload)
        .abortSignal(requestController.signal);
      if (!active) return;
      if (error && /previous_path|navigation_source|utm_/iu.test(error.message)) {
        ({ error } = await client
          .from("content_views")
          .insert(commonPayload)
          .abortSignal(requestController.signal));
      }
      if (!active || error) return;

      viewed[path] = now;
      writeWebStorage("session", viewedKey, JSON.stringify(viewed));
      writeWebStorage("session", previousPathKey, path);
      window.dispatchEvent(new Event("probpera:page-view-recorded"));
    };

    void track();
    const handleNavigation = () => void track();
    window.addEventListener("hashchange", handleNavigation);
    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("probpera:navigation", handleNavigation);
    return () => {
      active = false;
      requestController.abort();
      window.removeEventListener("hashchange", handleNavigation);
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("probpera:navigation", handleNavigation);
    };
  }, [configured, user?.id]);

  return null;
}
