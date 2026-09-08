import { useId } from "react";
import type { GlobeQualityTier } from "../components/globeQuality";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  PLANET_GRAPHICS_QUALITY_TIERS,
  type PlanetGraphicsSaveState,
} from "./planetGraphicsQuality";
import "./PlanetGraphicsSettings.css";

/** Implementation copy; editorial approval remains a separate release gate. */
export const planetGraphicsSettingsCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      heading: "Настройки графики",
      legend: "Качество графики",
      description: "Выберите детализацию изображения и звёздного неба. Страны, книги и стиль глобуса сохраняются при любом качестве.",
      high: { title: "Высокое", description: "Самое чёткое изображение и больше звёзд. Выбрано по умолчанию; требует больше ресурсов." },
      balanced: { title: "Сбалансированное", description: "Чуть ниже чёткость изображения и меньше звёзд, чтобы снизить нагрузку на устройство." },
      economy: { title: "Экономное", description: "Ниже чёткость изображения, меньше звёзд и упрощённый фон неба. Минимальная детализация среди этих режимов." },
      motion: "Системная настройка уменьшения движения действует при любом качестве.",
      saving: "Сохраняем выбор…",
      failed: "Не удалось подтвердить сохранение. Выбранное качество продолжает действовать. При следующем запуске настройка может сброситься.",
      retry: "Повторить сохранение",
    },
    en: {
      heading: "Graphics settings",
      legend: "Graphics quality",
      description: "Choose image detail and the star field. Countries, books and the globe style stay the same at every quality level.",
      high: { title: "High", description: "The sharpest image and more stars. Selected by default; uses more resources." },
      balanced: { title: "Balanced", description: "A slightly softer image and fewer stars to reduce the load on your device." },
      economy: { title: "Economy", description: "A softer image, fewer stars and a simpler sky background. The lowest level of detail among these modes." },
      motion: "Your system’s reduced motion setting applies at every quality level.",
      saving: "Saving your choice…",
      failed: "Saving could not be confirmed. The selected quality remains active. It may reset the next time you open the app.",
      retry: "Try saving again",
    },
  },
} as const;

export default function PlanetGraphicsSettings({
  value,
  onChange,
  saveState,
}: {
  value: GlobeQualityTier;
  onChange: (tier: GlobeQualityTier) => void;
  saveState: PlanetGraphicsSaveState;
}) {
  const { language } = useInterfaceLanguage();
  const copy = planetGraphicsSettingsCopy.locales[language];
  const id = useId();
  return (
    <details className="planet-graphics-settings" data-planet-graphics-settings="">
      <summary>{copy.heading}</summary>
      <div className="planet-graphics-settings__body">
        <p id={`${id}-description`}>{copy.description}</p>
        <fieldset aria-describedby={`${id}-description ${id}-motion`}>
          <legend>{copy.legend}</legend>
          <div className="planet-graphics-settings__options">
            {PLANET_GRAPHICS_QUALITY_TIERS.map(tier => (
              <label key={tier} className="planet-graphics-settings__option" data-selected={String(value === tier)}>
                <input type="radio" name={`${id}-quality`} value={tier} checked={value === tier}
                  aria-labelledby={`${id}-${tier}-title`} aria-describedby={`${id}-${tier}-description`}
                  data-planet-quality-option={tier} onChange={event => {
                    if (event.currentTarget.checked) onChange(tier);
                  }} />
                <span>
                  <strong id={`${id}-${tier}-title`}>{copy[tier].title}</strong>
                  <span id={`${id}-${tier}-description`}>{copy[tier].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p id={`${id}-motion`} className="planet-graphics-settings__motion">{copy.motion}</p>
        <p className="planet-graphics-settings__status" role="status" aria-live="polite" aria-atomic="true"
          data-planet-quality-save-state={saveState}>
          {saveState === "saving" ? copy.saving : saveState === "failed" ? copy.failed : ""}
        </p>
        {saveState === "failed" && (
          <button type="button" className="planet-graphics-settings__retry" data-planet-quality-retry=""
            onClick={event => {
              // Retry hides this button while confirmation is pending. Keep
              // keyboard focus inside the existing group instead of losing it.
              event.currentTarget.closest("details")?.querySelector<HTMLInputElement>("input:checked")?.focus();
              onChange(value);
            }}>{copy.retry}</button>
        )}
      </div>
    </details>
  );
}
