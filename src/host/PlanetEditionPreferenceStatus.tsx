import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import "./PlanetEditionPreferenceStatus.css";

/** Interface copy; human editorial approval is tracked separately. */
export const planetEditionPreferenceCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      saving: "Сохраняем оформление глобуса…",
      failed: "Не удалось подтвердить сохранение. Оформление остаётся на экране, но при следующем запуске выбор может сброситься.",
      retry: "Повторить сохранение",
      restoreFailed: "Не удалось восстановить оформление. Вы можете выбрать его заново.",
      renderFailed: "Оформление не удалось применить. Прежний выбор сохранён.",
    },
    en: {
      saving: "Saving your globe appearance…",
      failed: "Saving could not be confirmed. Your globe appearance stays on screen, but your choice may reset the next time you open the app.",
      retry: "Try saving again",
      restoreFailed: "Your saved appearance could not be restored. You can choose it again.",
      renderFailed: "The appearance could not be applied. Your previous choice has been kept.",
    },
  },
} as const;

export default function PlanetEditionPreferenceStatus({ saveState, onRetry, restoreFailed = false, renderFailed = false }: {
  saveState: "idle" | "saving" | "failed";
  onRetry: () => void;
  restoreFailed?: boolean;
  renderFailed?: boolean;
}) {
  const { language } = useInterfaceLanguage();
  const copy = planetEditionPreferenceCopy.locales[language];
  return (
    <div className="planet-edition-preference" data-planet-edition-save-state={saveState}>
      <p role="status" aria-live="polite" aria-atomic="true">
        {saveState === "saving" ? copy.saving : saveState === "failed" ? copy.failed
          : restoreFailed ? copy.restoreFailed : renderFailed ? copy.renderFailed : ""}
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
