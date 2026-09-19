import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import "./PlanetEditionPreferenceStatus.css";

/** Interface copy; human editorial approval is tracked separately. */
export const planetEditionPreferenceCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      saving: "Сохраняем выбор глобуса…",
      failed: "Не удалось подтвердить сохранение. Выбранный глобус остаётся на экране, но при следующем запуске выбор может сброситься.",
      retry: "Повторить сохранение",
    },
    en: {
      saving: "Saving your globe choice…",
      failed: "Saving could not be confirmed. Your selected globe stays on screen, but your choice may reset the next time you open the app.",
      retry: "Try saving again",
    },
  },
} as const;

export default function PlanetEditionPreferenceStatus({ saveState, onRetry }: {
  saveState: "idle" | "saving" | "failed";
  onRetry: () => void;
}) {
  const { language } = useInterfaceLanguage();
  const copy = planetEditionPreferenceCopy.locales[language];
  return (
    <div className="planet-edition-preference" data-planet-edition-save-state={saveState}>
      <p role="status" aria-live="polite" aria-atomic="true">
        {saveState === "saving" ? copy.saving : saveState === "failed" ? copy.failed : ""}
      </p>
      {saveState === "failed" && <button type="button" data-planet-edition-save-retry=""
        onClick={event => {
          // This action disappears while saving. Return focus to the existing,
          // visible edition control instead of dropping keyboard focus to body.
          const globe = event.currentTarget.closest(".literary-globe");
          const controls = globe?.querySelectorAll<HTMLElement>(
            '.globe-edition-compact-select select, [data-globe-edition-option][aria-pressed="true"], [data-globe-control="edition-rail-toggle"]'
          );
          const target = controls && Array.from(controls).find(control =>
            control.getClientRects().length > 0 && getComputedStyle(control).visibility !== "hidden"
            && !control.closest('[aria-hidden="true"], [inert]')
          );
          target?.focus({ preventScroll: true });
          onRetry();
        }}>{copy.retry}</button>}
    </div>
  );
}
