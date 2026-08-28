import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadSupabaseClient } from "../lib/loadSupabaseClient";
import { isCommunityConfigured } from "../lib/supabaseConfig";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: "reader" | "moderator" | "editor" | "admin";
  displayName: string;
};

const AuthContext = createContext<AuthContextValue>({
  configured: false,
  loading: true,
  session: null,
  user: null,
  role: "reader",
  displayName: "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isCommunityConfigured);
  const [role, setRole] =
    useState<AuthContextValue["role"]>("reader");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!isCommunityConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const client = await loadSupabaseClient();
        if (!active || !client) {
          return;
        }

        const sessionPromise = client.auth.getSession();
        const { data: listener } = client.auth.onAuthStateChange(
          (_event, nextSession) => {
            if (!active) return;
            setSession(nextSession);
            setLoading(false);
          }
        );
        unsubscribe = () => listener.subscription.unsubscribe();

        const { data } = await sessionPromise;
        if (active) {
          setSession(data.session);
        }
      } catch {
        // Authentication must fail open for reading, never leave the shell busy.
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setRole("reader");
      setDisplayName("");
      return;
    }

    let active = true;
    void loadSupabaseClient()
      .then((client) => {
        if (!active || !client) return;
        void client
          .from("profiles")
          .select("display_name,role")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (!active || !data) return;
            setDisplayName(data.display_name || "");
            setRole(data.role || "reader");
          });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [session?.user]);

  const value = useMemo(
    () => ({
      configured: isCommunityConfigured,
      loading,
      session,
      user: session?.user ?? null,
      role,
      displayName,
    }),
    [displayName, loading, role, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
