import { useState } from "react";
import { decodeChildLocalePolicy } from "./childProfile";
import type { ChildNativeAppController, ChildNativeAppSnapshot } from "./childNativeAppBridge";

/** A proposal to the native transaction; language changes only after native admission. */
export function ChildNativeLocaleControl({ controller, snapshot }: {
  readonly controller: ChildNativeAppController; readonly snapshot: ChildNativeAppSnapshot;
}) {
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false);
  const c = snapshot.context, selected = snapshot.profiles.find(profile => profile.id === c?.profileId);
  const policy = c && selected && decodeChildLocalePolicy(selected.localePolicy, c.locale);
  if (snapshot.phase !== "ready" || snapshot.status !== "child" || !c || c.mode !== "child"
    || selected?.locale !== c.locale || selected.localeLocked !== false || !policy
    || policy.allowedLocales.length < 2 || !controller.changeChildLocale) return null;
  const propose = async (locale: "ru" | "en") => {
    if (pending || locale === c.locale) return;
    setPending(true); setFailed(false);
    try { if (!await controller.changeChildLocale!(c, locale)) setFailed(true); }
    catch { setFailed(true); }
    finally { setPending(false); }
  };
  return <nav aria-label={c.locale === "ru" ? "Язык" : "Language"} aria-busy={pending} data-child-native-locale-control>
    {policy.allowedLocales.map(locale => <button key={locale} type="button" lang={locale} style={{ minHeight: 44 }}
      aria-pressed={c.locale === locale} disabled={pending || c.locale === locale}
      onClick={() => { void propose(locale); }}>{locale === "ru" ? "Русский" : "English"}</button>)}
    {failed && <span role="status">{c.locale === "ru" ? "Не удалось подтвердить смену языка." : "The language change could not be confirmed."}</span>}
  </nav>;
}
