import { useEffect } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { getCommunitySessionId } from "./sessionIdentity";

const viewedKey = "probpera-viewed-paths";
const VIEW_COOLDOWN_MS = 30 * 60 * 1000;

export default function ActivityTracker() {
  const { configured, user } = useAuth();

  useEffect(() => {
    if (!configured || !supabase) return;
    const client = supabase;

    const track = () => {
      // Просмотр относится к странице целиком: якоря оглавления не должны
      // превращать один визит в несколько разных адресов и счётчиков.
      const path = window.location.pathname;
      let viewed: Record<string, number> = {};
      try {
        const stored = JSON.parse(
          window.sessionStorage.getItem(viewedKey) || "{}"
        );
        viewed = Array.isArray(stored)
          ? Object.fromEntries(stored.map((item) => [String(item), 0]))
          : stored;
      } catch {
        viewed = {};
      }
      const now = Date.now();
      if (now - (viewed[path] || 0) < VIEW_COOLDOWN_MS) return;
      viewed[path] = now;
      window.sessionStorage.setItem(viewedKey, JSON.stringify(viewed));

      void client
        .from("content_views")
        .insert({
          path,
          session_id: getCommunitySessionId(),
          user_id: user?.id || null,
          referrer_host: document.referrer
            ? new URL(document.referrer).hostname.slice(0, 180)
            : null,
        })
        .then(({ error }) => {
          if (!error) {
            window.dispatchEvent(new Event("probpera:page-view-recorded"));
          }
        });
    };

    track();
    window.addEventListener("hashchange", track);
    window.addEventListener("popstate", track);
    window.addEventListener("probpera:navigation", track);
    return () => {
      window.removeEventListener("hashchange", track);
      window.removeEventListener("popstate", track);
      window.removeEventListener("probpera:navigation", track);
    };
  }, [configured, user?.id]);

  return null;
}
