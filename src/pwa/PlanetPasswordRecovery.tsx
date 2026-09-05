import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../community/AuthContext";
import { consumeAuthTurnstileToken } from "../community/authTurnstileToken";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { loadSupabaseClient } from "../lib/loadSupabaseClient";
import { isAuthTurnstileConfigured, supabaseConnection } from "../lib/supabaseConfig";
import { canonicalJournalOrigin } from "../platform/distribution";
import { createPasswordRecoveryService, hasRecoveryPresentationHint, PasswordRecoveryError, type PasswordRecoveryReason } from "./passwordRecovery";
import { passwordRecoveryCopy } from "./passwordRecoveryCopy";

/** Parent hides this component while CommunityHub owns the single auth form. */
export function PlanetPasswordRecovery({ onSignIn }: { onSignIn?: () => void }) {
  const auth = useAuth(); const authRef = useRef(auth); authRef.current = auth;
  const { language } = useInterfaceLanguage(); const copy = passwordRecoveryCopy.locales[language];
  const [recovery] = useState(() => typeof window !== "undefined" && hasRecoveryPresentationHint(window.location.search));
  const [expanded, setExpanded] = useState(recovery); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<PasswordRecoveryReason | null>(null);
  const pending = useRef<AbortController | null>(null); const panelId = useId(); const titleId = useId();
  useEffect(() => () => { pending.current?.abort(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>, change: boolean) {
    event.preventDefault(); if (pending.current) return;
    const captcha = !change ? consumeAuthTurnstileToken() : undefined;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null); setSent(false);
    try {
      const client = await loadSupabaseClient();
      if (controller.signal.aborted) return;
      if (!client || !supabaseConnection.url || !supabaseConnection.publishableKey) throw new PasswordRecoveryError("unavailable");
      const service = createPasswordRecoveryService({ auth: client.auth, projectUrl: supabaseConnection.url, publishableKey: supabaseConnection.publishableKey,
        siteOrigin: canonicalJournalOrigin, currentIdentity: () => {
          const session = authRef.current.session;
          return session ? { subject: session.user.id, accessToken: session.access_token } : null;
        } });
      if (change) await service.changePassword(password, confirmation, controller.signal);
      else await service.requestEmail(email, language, captcha, isAuthTurnstileConfigured, controller.signal);
      if (!controller.signal.aborted) { if (change) setUpdated(true); else setSent(true); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof PasswordRecoveryError ? failure.reason : "unavailable");
    } finally {
      if (change) { setPassword(""); setConfirmation(""); }
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  const status = busy ? copy.busy : error ? copy.errors[error] : updated ? copy.updated : sent ? copy.sent : "";
  return <section data-password-recovery data-copy-review={passwordRecoveryCopy.reviewStatus}>
    <button type="button" aria-expanded={expanded} aria-controls={panelId} disabled={busy} onClick={() => setExpanded(value => !value)}>{expanded ? copy.close : copy.open}</button>
    {expanded ? <div id={panelId} aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.title}</h2><p>{copy.instruction}</p>
      <p role={error ? "alert" : "status"} aria-live="polite" aria-atomic="true">{status}</p>
      {updated || error === "updated-signout-incomplete" ? onSignIn ? <button type="button" onClick={onSignIn}>{copy.signIn}</button> : null : <>
        {recovery ? <form className="planet-recovery-password" onSubmit={event => void submit(event, true)}>
          <label>{copy.password}<input type="password" autoComplete="new-password" value={password} minLength={10} maxLength={1024} required disabled={busy || auth.loading}
            onChange={event => setPassword(event.target.value)} /></label>
          <label>{copy.confirm}<input type="password" autoComplete="new-password" value={confirmation} minLength={10} maxLength={1024} required disabled={busy || auth.loading}
            onChange={event => setConfirmation(event.target.value)} /></label>
          <button className="community-primary" type="submit" disabled={busy || auth.loading || !auth.configured}>{copy.save}</button>
        </form> : null}
        <form className="auth-form" onSubmit={event => void submit(event, false)}>
          <label>{copy.email}<input type="email" autoComplete="email" value={email} maxLength={254} required disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
          <button className="community-primary" type="submit" disabled={busy || !auth.configured}>{copy.send}</button>
        </form>
      </>}
    </div> : null}
  </section>;
}
