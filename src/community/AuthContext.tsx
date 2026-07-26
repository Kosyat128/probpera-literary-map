import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isCommunityConfigured, supabase } from "../lib/supabase";

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
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) {
      setRole("reader");
      setDisplayName("");
      return;
    }

    let active = true;
    supabase
      .from("profiles")
      .select("display_name,role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (!active || !data) return;
        setDisplayName(data.display_name || "");
        setRole(data.role || "reader");
      });

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
