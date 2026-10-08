import type { ChildNativeAppSnapshot, ChildNativeContext } from "./childNativeAppBridge";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

/** Readback only: buttons propose a native Parent Gate action. No optimistic
 * lock state, child language switch, storage, or admission is created here. */
export function ParentChildLocaleLockControl({ snapshot, expectedContext, disabled = false, onRequest }: {
  snapshot: ChildNativeAppSnapshot; expectedContext: ChildNativeContext | null; disabled?: boolean; onRequest: (locked: boolean) => void;
}) {
  const { language } = useInterfaceLanguage();
  const c = snapshot.context, selected = snapshot.profiles.find(profile => profile.id === c?.profileId);
  if (c !== expectedContext || snapshot.phase !== "ready" || snapshot.status !== "child" && snapshot.status !== "blocked-child" || c?.mode !== "child" || !selected || selected.locale !== c.locale) return null;
  const known = typeof selected.localeLocked === "boolean", locked = selected.localeLocked;
  const copy = language === "ru" ? {
    title: "Фиксация языка", locked: "Фиксация языка включена.", unlocked: "Фиксация языка выключена.",
    unknown: "Фиксация языка пока не подтверждена.", lock: "Зафиксировать язык со взрослым", unlock: "Снять фиксацию со взрослым",
  } : {
    title: "Language lock", locked: "Language lock is on.", unlocked: "Language lock is off.",
    unknown: "The language lock has not been confirmed.", lock: "Lock language with an adult", unlock: "Unlock language with an adult",
  };
  return <section aria-label={copy.title} data-child-native-locale-lock={known ? locked ? "locked" : "unlocked" : "unknown"}>
    <h3>{copy.title}</h3>
    <p role="status" aria-live="polite">{known ? locked ? copy.locked : copy.unlocked : copy.unknown}</p>
    <button type="button" disabled={disabled || locked === true} onClick={() => onRequest(true)}>{copy.lock}</button>
    <button type="button" disabled={disabled || locked === false} onClick={() => onRequest(false)}>{copy.unlock}</button>
  </section>;
}
