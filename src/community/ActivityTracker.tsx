import { useEffect } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { getCommunitySessionId } from "./sessionIdentity";

const viewedKey = "probpera-viewed-paths";

export default function ActivityTracker() {
  const { configured, user } = useAuth();

  useEffect(() => {
    if (!configured || !supabase) return;
    const client = supabase;

    const track = () => {
      const path = `${window.location.pathname}${window.location.hash}`;
      const viewed = new Set(
        JSON.parse(window.sessionStorage.getItem(viewedKey) || "[]") as string[]
      );
      if (viewed.has(path)) return;
      viewed.add(path);
      window.sessionStorage.setItem(viewedKey, JSON.stringify([...viewed]));

      void client.from("content_views").insert({
        path,
        session_id: getCommunitySessionId(),
        user_id: user?.id || null,
        referrer_host: document.referrer
          ? new URL(document.referrer).hostname.slice(0, 180)
          : null,
      });
    };

    track();
    window.addEventListener("hashchange", track);
    return () => window.removeEventListener("hashchange", track);
  }, [configured, user?.id]);

  return null;
}
