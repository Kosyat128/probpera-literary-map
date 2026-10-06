import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { GLOBE_STAND_IDS, type GlobeStandId } from "../planet/globeStands";
import { GLOBE_BACKGROUND_IDS, type GlobeBackgroundId } from "../planet/globeBackgrounds";
import type { PlanetStandCustomizationController, PlanetStandCustomizationSnapshot } from "./planetStandCustomization";
import type { PlanetBackgroundCustomizationController, PlanetBackgroundCustomizationSnapshot } from "./planetBackgroundCustomization";
import type { GlobeStandInspectionPhase } from "../components/globeStandInspection";
import type { ViewInsets } from "../components/globeFocusMath";
import "./PlanetStandControls.css";

/** Authored interface copy; editorial and child acceptance remain separate. */
export const planetStandCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      heading: "Подставка глобуса", toggle: "Подставки", close: "Закрыть", label: "Оформление подставки",
      hint: "Вращайте глобус и меняйте масштаб, чтобы рассмотреть подставку.",
      preparing: "Готовим предпросмотр…", preview: "Предпросмотр. Подставка и фон применяются вместе.",
      failed: "Предпросмотр не открылся. Прежнее оформление восстановлено.",
      apply: "Применить", cancel: "Отмена", saving: "Сохраняем выбор…",
      saveFailed: "Сохранение не подтверждено. Прежнее оформление показано снова; сохранение прежнего выбора ещё может требовать повтора.",
      retry: "Подтвердить прежний выбор",
      names: { canonical: "Фирменное оформление", "stand.base.three-whales": "Три кита",
        "stand.base.portrait-pushkin": "Александр Пушкин", "stand.base.portrait-hemingway": "Эрнест Хемингуэй", "stand.base.portrait-tolstoy": "Лев Толстой", "stand.base.museum": "Музейная", "stand.base.wood": "Деревянная", "stand.base.book-stack": "Стопка книг", "stand.base.child-book-cloud": "Книга на облаке" },
    },
    en: {
      heading: "Globe stand", toggle: "Stands", close: "Close", label: "Stand appearance",
      hint: "Rotate the globe and adjust the zoom to inspect the stand.",
      preparing: "Preparing preview…", preview: "Preview. The stand and background will be applied together.",
      failed: "The preview could not be shown. Your previous appearance has been restored.",
      apply: "Apply", cancel: "Cancel", saving: "Saving your choice…",
      saveFailed: "Saving could not be confirmed. Your previous appearance is shown again; restoring the saved choice may still need a retry.",
      retry: "Confirm previous choice",
      names: { canonical: "Original frame", "stand.base.three-whales": "Three whales",
        "stand.base.portrait-pushkin": "Alexander Pushkin", "stand.base.portrait-hemingway": "Ernest Hemingway", "stand.base.portrait-tolstoy": "Leo Tolstoy", "stand.base.museum": "Museum", "stand.base.wood": "Wooden", "stand.base.book-stack": "Stack of books", "stand.base.child-book-cloud": "Book on a cloud" },
    },
  },
} as const;

export const planetBackgroundCopy = {
  reviewStatus: "draft", productionReady: false,
  locales: {
    ru: {
      close: "Закрыть", label: "Пространство вокруг глобуса",
      hint: "Вращайте глобус, чтобы рассмотреть окружение.",
      preparing: "Готовим предпросмотр…", preview: "Предпросмотр. Подставка и фон применяются вместе.",
      failed: "Предпросмотр не открылся. Прежнее оформление восстановлено.",
      apply: "Применить", cancel: "Отмена", saving: "Сохраняем выбор…",
      saveFailed: "Сохранение не подтверждено. Прежнее оформление показано снова; сохранение прежнего выбора ещё может требовать повтора.",
      retry: "Подтвердить прежний выбор",
      names: { "background.base.site-starfield": "Звёздное небо", "background.base.library": "Библиотека", "background.base.writer-study": "Кабинет писателя" },
    },
    en: {
      close: "Close", label: "Space around the globe",
      hint: "Rotate the globe to explore the surrounding space.",
      preparing: "Preparing preview…", preview: "Preview. The stand and background will be applied together.",
      failed: "The preview could not be shown. Your previous appearance has been restored.",
      apply: "Apply", cancel: "Cancel", saving: "Saving your choice…",
      saveFailed: "Saving could not be confirmed. Your previous appearance is shown again; restoring the saved choice may still need a retry.",
      retry: "Confirm previous choice",
      names: { "background.base.site-starfield": "Starry sky", "background.base.library": "Library", "background.base.writer-study": "Writer's study" },
    },
  },
} as const;

export default function PlanetStandControls({ controller, snapshot, backgroundController, backgroundSnapshot, onClose, inspection }: {
  controller: Pick<PlanetStandCustomizationController, "open" | "preview" | "apply" | "cancel" | "retrySave">;
  snapshot: PlanetStandCustomizationSnapshot;
  backgroundController: Pick<PlanetBackgroundCustomizationController, "open" | "preview" | "apply" | "cancel" | "retrySave">;
  backgroundSnapshot: PlanetBackgroundCustomizationSnapshot;
  onClose: () => void;
  inspection?: {
    phase: GlobeStandInspectionPhase;
    available: boolean;
    onStart: () => unknown;
    onReturn: () => unknown;
    onInsetsChange: (insets: Partial<ViewInsets>) => void;
  };
}) {
  const { language } = useInterfaceLanguage();
  const [tab, setTab] = useState<"stand" | "background">("stand");
  const isStand = tab === "stand";
  const current = isStand ? snapshot : backgroundSnapshot;
  const copy = isStand ? planetStandCopy.locales[language] : planetBackgroundCopy.locales[language];
  const title = language === "ru" ? "Оформление глобуса" : "Globe appearance";
  const options = isStand
    ? GLOBE_STAND_IDS.map(value => ({ value, label: planetStandCopy.locales[language].names[value] }))
    : GLOBE_BACKGROUND_IDS.map(value => ({ value, label: planetBackgroundCopy.locales[language].names[value] }));
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  const panel = useRef<HTMLElement>(null);
  const inspectButton = useRef<HTMLButtonElement>(null);
  const inspecting = Boolean(inspection && inspection.phase !== "closed");
  const wasInspecting = useRef(false);
  const inspectionCopy = language === "ru"
    ? { start: "Рассмотреть подставку", back: "Вернуться к глобусу", hint: "Потяните для вращения. Масштаб — кнопками + и −." }
    : { start: "Inspect stand", back: "Return to globe", hint: "Drag to rotate. Use + and − to zoom." };
  useEffect(() => {
    if (wasInspecting.current && !inspecting && current.isOpen) inspectButton.current?.focus({ preventScroll: true });
    wasInspecting.current = inspecting;
  }, [current.isOpen, inspecting]);
  const reportInsets = inspection?.onInsetsChange;
  useLayoutEffect(() => {
    if (!reportInsets) return;
    const element = panel.current, root = element?.closest(".literary-globe");
    if (!inspecting || !current.isOpen || !element || !root) { reportInsets({}); return; }
    const measure = () => {
      const area = root.getBoundingClientRect(), bounds = element.getBoundingClientRect();
      if (area.width <= 0 || area.height <= 0) return;
      reportInsets(window.matchMedia("(max-width: 980px)").matches
        ? { top: Math.max(0, Math.ceil(bounds.bottom - area.top + 12)) }
        : { left: Math.max(0, Math.ceil(bounds.right - area.left + 12)) });
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element); observer?.observe(root);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [current.isOpen, inspecting, reportInsets]);
  const activeController = isStand ? controller : backgroundController;
  useEffect(() => { if (current.isOpen) select.current?.focus({ preventScroll: true }); }, [current.isOpen, tab]);
  const switchTab = (next: "stand" | "background") => {
    if (next === tab) return;
    // Both tabs edit the same draft. Closing the panel owns whole-draft rollback.
    if ((next === "stand" ? controller : backgroundController).open()) setTab(next);
  };
  return <div className="planet-stand-controls" data-planet-stand-controls="" data-stand-inspecting={inspecting ? "true" : undefined}>
    <button type="button" className="planet-stand-controls__toggle" data-planet-stand-toggle=""
      data-planet-stand-inspection-return={inspecting ? "" : undefined}
      aria-expanded={current.isOpen} aria-controls={`${id}-panel`}
      onClick={() => inspecting ? inspection?.onReturn() : current.isOpen ? onClose() : activeController.open()}>{inspecting ? inspectionCopy.back : language === "ru" ? "Оформление" : "Appearance"}</button>
    {current.isOpen && <section ref={panel} className="planet-stand-controls__panel" id={`${id}-panel`}
      data-planet-stand-panel={isStand ? "" : undefined} data-planet-stand-phase={isStand ? current.phase : undefined}
      data-planet-background-panel={isStand ? undefined : ""} data-planet-background-phase={isStand ? undefined : current.phase}
      aria-labelledby={`${id}-heading`}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (inspecting) inspection?.onReturn(); else onClose(); }
      }}>
      <div className="planet-stand-controls__heading">
        <h2 id={`${id}-heading`}>{title}</h2>
        <button type="button" data-planet-stand-close={isStand ? "" : undefined}
          data-planet-background-close={isStand ? undefined : ""} aria-label={copy.close} onClick={onClose}>×</button>
      </div>
      <div className="planet-stand-controls__tabs" role="group" aria-label={language === "ru" ? "Раздел оформления" : "Appearance category"}>
        <button type="button" data-planet-customization-tab="stand" aria-pressed={isStand}
          onClick={() => switchTab("stand")}>{language === "ru" ? "Подставка" : "Stand"}</button>
        <button type="button" data-planet-customization-tab="background" aria-pressed={!isStand}
          onClick={() => switchTab("background")}>{language === "ru" ? "Фон" : "Background"}</button>
      </div>
      <label htmlFor={`${id}-select`}>{copy.label}</label>
      <select ref={select} id={`${id}-select`} data-planet-stand-select={isStand ? "" : undefined}
        data-planet-background-select={isStand ? undefined : ""}
        value={current.previewId ?? current.appliedId}
        onChange={event => isStand ? controller.preview(event.currentTarget.value as GlobeStandId)
          : backgroundController.preview(event.currentTarget.value as GlobeBackgroundId)}>
        {options.map(option => <option key={option.value} value={option.value}
          data-planet-stand-option={isStand ? option.value : undefined}
          data-planet-background-option={isStand ? undefined : option.value}>{option.label}</option>)}
      </select>
      <p className="planet-stand-controls__summary" data-planet-composition-summary="">
        {language === "ru" ? "Подставка: " : "Stand: "}{planetStandCopy.locales[language].names[snapshot.displayedId]}
        {" · "}{language === "ru" ? "Фон: " : "Background: "}{planetBackgroundCopy.locales[language].names[backgroundSnapshot.displayedId]}
      </p>
      {inspection && isStand && !inspecting && <button ref={inspectButton} type="button" data-planet-stand-inspect=""
        className="planet-stand-controls__inspect" disabled={!inspection.available} onClick={inspection.onStart}>{inspectionCopy.start}</button>}
      <p className="planet-stand-controls__hint">{inspecting ? inspectionCopy.hint : copy.hint}</p>
      <p className="planet-stand-controls__status" role="status" aria-live="polite" aria-atomic="true">
        {current.phase === "preparing" ? copy.preparing : current.phase === "preview" && !inspecting ? copy.preview : current.phase === "error" ? copy.failed : ""}
      </p>
      <div className="planet-stand-controls__actions">
        <button type="button" data-planet-stand-apply={isStand ? "" : undefined} data-planet-background-apply={isStand ? undefined : ""}
          disabled={current.phase !== "preview" || current.saveState === "saving"}
          onClick={() => { select.current?.focus({ preventScroll: true }); activeController.apply(); }}>{copy.apply}</button>
        <button type="button" data-planet-stand-cancel={isStand ? "" : undefined}
          data-planet-background-cancel={isStand ? undefined : ""} onClick={onClose}>{copy.cancel}</button>
      </div>
      <p className="planet-stand-controls__status" role="status" aria-live="polite" aria-atomic="true"
        data-planet-stand-save-state={isStand ? current.saveState : undefined}
        data-planet-background-save-state={isStand ? undefined : current.saveState}>
        {current.saveState === "saving" ? copy.saving : current.saveState === "failed" ? copy.saveFailed : ""}
      </p>
      {current.saveState === "failed" && <button type="button" data-planet-stand-save-retry={isStand ? "" : undefined}
        data-planet-background-save-retry={isStand ? undefined : ""} onClick={() => {
        select.current?.focus({ preventScroll: true });
        activeController.retrySave();
      }}>{copy.retry}</button>}
    </section>}
  </div>;
}
