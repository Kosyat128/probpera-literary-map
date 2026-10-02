import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { loadSupabaseClient } from "../lib/loadSupabaseClient";
import { isCommunityConfigured } from "../lib/supabaseConfig";
import { observeCanonicalAuthSession, type AuthSessionError, type AuthSessionSnapshot, type DeletionStatusIdentity } from "./authSession";
import { readerPrivacy } from "./readerPrivacy";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: "reader" | "moderator" | "editor" | "admin";
  displayName: string;
  error: AuthSessionError | null;
  retry(): void;
  privacyError: boolean;
  retryPrivacy(): void;
  deletionStatusIdentity: DeletionStatusIdentity | null;
};
const noRetry = () => {};
const AuthContext = createContext<AuthContextValue>({ configured: false, loading: true, session: null, user: null,
  role: "reader", displayName: "", error: null, retry: noRetry, privacyError: false, retryPrivacy: noRetry, deletionStatusIdentity: null });
type ProfilePresentation = { session: Session; subject: string; token: string; role: AuthContextValue["role"]; displayName: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>({ session: null, loading: isCommunityConfigured, error: null });
  const [reload, setReload] = useState(0);
  const [profile, setProfile] = useState<ProfilePresentation | null>(null);
  const lastVerifiedSubject = useRef<string | null>(null), clearingSubject = useRef<string | null>(null);
  useSyncExternalStore(readerPrivacy.subscribe, readerPrivacy.getSnapshot, readerPrivacy.getSnapshot);
  const retry = useCallback(() => setReload(value => value + 1), []);
  const clearOwned = useCallback((verifiedSubject?: string) => {
    const subject = verifiedSubject ?? lastVerifiedSubject.current;
    if (!subject) return;
    if (lastVerifiedSubject.current === subject) lastVerifiedSubject.current = null;
    clearingSubject.current = subject;
    void readerPrivacy.clear(subject);
  }, []);
  const retryPrivacy = useCallback(() => {
    const subject = snapshot.session?.user.id && readerPrivacy.phase(snapshot.session.user.id) === "error"
      ? snapshot.session.user.id : clearingSubject.current;
    if (subject) void readerPrivacy.clear(subject).then(success => {
      if (success && snapshot.session?.user.id === subject) readerPrivacy.resume(subject);
    });
  }, [snapshot.session?.user.id]);
  useEffect(() => {
    if (!isCommunityConfigured) { setSnapshot({ session: null, loading: false, error: null }); return; }
    const observer = observeCanonicalAuthSession({ loadClient: loadSupabaseClient, timeoutMs: 10_000,
      onChange(next) {
        if (next.session) {
          const previous = lastVerifiedSubject.current;
          if (previous && previous !== next.session.user.id) {
            clearingSubject.current = previous; void readerPrivacy.clear(previous);
          }
          lastVerifiedSubject.current = next.session.user.id; readerPrivacy.resume(next.session.user.id);
        }
        setSnapshot(next);
      }, onSignedOut: clearOwned });
    return observer.dispose;
  }, [reload, clearOwned]);

  const phase = readerPrivacy.phase(snapshot.session?.user.id ?? null);
  const privacyPending = !!phase && !readerPrivacy.isPermanent(snapshot.session?.user.id ?? null);
  const session = privacyPending ? null : snapshot.session;
  const privacyError = phase === "error" || readerPrivacy.phase(clearingSubject.current) === "error";
  useEffect(() => {
    if (phase === "sealed" && snapshot.session?.user.id) readerPrivacy.resume(snapshot.session.user.id);
  }, [phase, snapshot.session?.user.id]);
  useEffect(() => {
    setProfile(null);
    if (!session?.user) return;
    const identity = { session, subject: session.user.id, token: session.access_token };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    void loadSupabaseClient().then(async client => {
      if (!client || controller.signal.aborted) return;
      const { data, error } = await client.from("profiles").select("display_name,role").eq("id", identity.subject)
        .abortSignal(controller.signal).maybeSingle();
      if (controller.signal.aborted || error || !data || typeof data !== "object" || Array.isArray(data)) return;
      const role: AuthContextValue["role"] = ["reader", "moderator", "editor", "admin"].includes(data.role) ? data.role : "reader";
      const displayName = typeof data.display_name === "string" && data.display_name.length <= 80 ? data.display_name : "";
      setProfile({ ...identity, role, displayName });
    }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [session]);

  // A previous account's presentation is never visible for even one render.
  // The server independently enforces roles, ownership and deletion status.
  const matchingProfile = profile?.session === session && profile?.subject === session?.user.id && profile?.token === session?.access_token ? profile : null;
  const value = useMemo<AuthContextValue>(() => ({ configured: isCommunityConfigured, loading: snapshot.loading || phase === "clearing", session,
    user: session?.user ?? null, role: matchingProfile?.role ?? "reader", displayName: matchingProfile?.displayName ?? "",
    error: snapshot.error, retry, privacyError, retryPrivacy, deletionStatusIdentity: snapshot.deletionStatusIdentity ?? null }),
    [snapshot.loading, snapshot.error, snapshot.deletionStatusIdentity, phase, session, matchingProfile, retry, privacyError, retryPrivacy]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
const accountlessReader: AuthContextValue = Object.freeze({ configured: false, loading: false, session: null, user: null,
  role: "reader", displayName: "", error: null, retry: noRetry, privacyError: false, retryPrivacy: noRetry, deletionStatusIdentity: null });
/** Bundled reading has no account session; this provider starts no backend IO. */
export function AccountlessReaderProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={accountlessReader}>{children}</AuthContext.Provider>;
}
