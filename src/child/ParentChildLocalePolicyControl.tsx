import { useState } from "react";
import type { ChildNativeAppSnapshot, ChildNativeContext } from "./childNativeAppBridge";
import { sameChildLocalePolicy, type ChildLocalePolicy } from "./childProfile";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

/** A draft proposes the original Parent Gate. Only authenticated readback is saved. */
export function ParentChildLocalePolicyControl({ snapshot, expectedContext, disabled = false, onRequest }: {
  snapshot: ChildNativeAppSnapshot; expectedContext: ChildNativeContext | null; disabled?: boolean;
  onRequest: (policy: ChildLocalePolicy) => void;
}) {
  const { language } = useInterfaceLanguage(), c = snapshot.context;
  const selected = snapshot.profiles.find(profile => profile.id === c?.profileId);
  if (c !== expectedContext || snapshot.phase !== "ready" || snapshot.status !== "child" && snapshot.status !== "blocked-child"
    || c?.mode !== "child" || !selected || selected.locale !== c.locale) return null;
  return <PolicyForm key={c.token} currentLocale={c.locale} saved={selected.localePolicy}
    language={language} disabled={disabled} onRequest={onRequest} />;
}
function PolicyForm({ currentLocale, saved, language, disabled, onRequest }: {
  currentLocale: "ru" | "en"; saved: ChildLocalePolicy | undefined; language: "ru" | "en"; disabled: boolean;
  onRequest: (policy: ChildLocalePolicy) => void;
}) {
  const [allowed, setAllowed] = useState<readonly ("ru" | "en")[]>(saved?.allowedLocales ?? [currentLocale]);
  const draft: ChildLocalePolicy = { schemaVersion: 1, allowedLocales: allowed };
  const copy = language === "ru" ? {
    title: "Разрешённые языки", saved: "Разрешено в сохранённом профиле:",
    legacy: "Пока разрешён только текущий язык профиля.", help: "Текущий язык должен остаться разрешённым. Изменения подтвердит взрослый на устройстве.",
    submit: "Подтвердить языки со взрослым",
  } : {
    title: "Allowed languages", saved: "Allowed in the saved profile:",
    legacy: "Only the profile's current language is allowed for now.", help: "The current language must stay allowed. An adult will confirm changes on this device.",
    submit: "Confirm languages with an adult",
  };
  return <form data-child-native-locale-policy={saved ? "configured" : "current-only"} onSubmit={event => {
    event.preventDefault(); if (!disabled && !sameChildLocalePolicy(saved, draft)) onRequest(draft);
  }}>
    <fieldset disabled={disabled}><legend>{copy.title}</legend>
      <p role="status">{saved ? copy.saved + " " + saved.allowedLocales.map(locale => locale === "ru" ? "Русский" : "English").join(", ") : copy.legacy}</p>
      {(["ru", "en"] as const).map(locale => <label key={locale} className="child-native-check">
        <input type="checkbox" checked={allowed.includes(locale)} disabled={locale === currentLocale}
          onChange={event => { const checked = event.currentTarget.checked; setAllowed(previous => (["ru", "en"] as const)
            .filter(value => value === currentLocale || (value === locale ? checked : previous.includes(value)))); }} />
        {locale === "ru" ? "Русский" : "English"}
      </label>)}
      <p>{copy.help}</p>
      <button type="submit" disabled={sameChildLocalePolicy(saved, draft)}>{copy.submit}</button>
    </fieldset>
  </form>;
}
