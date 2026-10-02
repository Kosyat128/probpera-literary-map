import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandBookIcon from "./BrandBookIcon";
import BrandQuillIcon from "./BrandQuillIcon";
import BrandFilterIcon from "./BrandFilterIcon";
import BrandSearchIcon from "./BrandSearchIcon";
import BrandSparkleIcon from "./BrandSparkleIcon";
import InterfaceLanguageControl from "./InterfaceLanguageControl";

type Props = {
  closeButtonRef: RefObject<HTMLButtonElement>;
  searchButtonRef: RefObject<HTMLButtonElement>;
  filtersButtonRef: RefObject<HTMLButtonElement>;
  filtersOpen: boolean;
  immersive: boolean;
  applicationRoot?: boolean;
  languageControl?: ReactNode;
  onAppearance?: () => void;
  onSource?: () => void;
  onCollection?: () => void;
  onClose: () => void;
  onFiltersToggle: () => void;
  onRandomJourney: () => void;
  onSearchToggle: () => void;
  randomDisabled?: boolean;
  searchOpen: boolean;
};

function MenuChevronIcon() {
  return <svg className="atlas-application-menu-chevron" viewBox="0 0 16 16" fill="none"
    width="14" height="14" aria-hidden="true" focusable="false">
    <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export default function AtlasExperienceChrome({
  closeButtonRef,
  searchButtonRef,
  filtersButtonRef,
  filtersOpen,
  immersive,
  applicationRoot = false,
  languageControl = <InterfaceLanguageControl presentation={applicationRoot ? "flags" : "labels"} />,
  onAppearance,
  onSource,
  onCollection,
  onClose,
  onFiltersToggle,
  onRandomJourney,
  onSearchToggle,
  randomDisabled = false,
  searchOpen,
}: Props) {
  const { language, t } = useInterfaceLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRootRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const languageAvailable = languageControl !== null;
  const menuLabel = language === "ru" ? "Меню" : "Menu";
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) closeButtonRef.current?.focus({ preventScroll: true });
  };
  const runMenuAction = (action?: () => void) => {
    closeMenu(true);
    action?.();
  };

  useEffect(() => {
    // Parent panels own their existing focus and scene state. Opening this
    // disclosure closes them first; a later parent opening dismisses it.
    if (!menuOpen) return;
    if (!applicationRoot || !immersive || searchOpen || filtersOpen || !languageAvailable) {
      setMenuOpen(false);
      return;
    }
    menuPanelRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [menuOpen, applicationRoot, immersive, searchOpen, filtersOpen, languageAvailable]);

  useEffect(() => {
    // The canonical locale control keeps its provider/URL behavior. A locale
    // change also dismisses the disclosure without replacing the globe.
    setMenuOpen(false);
  }, [language]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRootRef.current?.contains(event.target)) {
        const restore = Boolean(menuPanelRef.current?.contains(document.activeElement));
        setMenuOpen(false);
        if (restore) closeButtonRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [menuOpen, closeButtonRef]);

  return (
    <>
      <div className="atlas-cosmic-field" aria-hidden="true">
        <span className="atlas-cosmic-layer atlas-cosmic-layer--far" />
        <span className="atlas-cosmic-layer atlas-cosmic-layer--near" />
        <span className="atlas-celestial-engraving" />
        <span className="atlas-ambient-halo" />
      </div>
      <header
        className={`atlas-immersive-chrome${applicationRoot ? " atlas-application-chrome" : ""}`}
        aria-hidden={immersive ? undefined : "true"}
      >
        <div className="atlas-immersive-identity">
          <img
            src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
            alt=""
            aria-hidden="true"
            width="42"
            height="42"
            decoding="async"
          />
          <div>
            <small>{t("Интерактивная энциклопедия")}</small>
            <strong>{t("Литературная планета")}</strong>
          </div>
        </div>
        {applicationRoot ? <nav className="atlas-application-actions" aria-label={t("Литературная планета")}>
          <IconButton
            ref={filtersButtonRef}
            className="atlas-immersive-filter-toggle atlas-application-toolbar-button atlas-application-toolbar-button--filter"
            size="md"
            surface="dark"
            icon={<BrandFilterIcon />}
            aria-expanded={filtersOpen}
            aria-controls="atlas-filter-panel"
            aria-label={t("Фильтры глобуса")}
            title={t("Фильтры глобуса")}
            data-atlas-action="toggle-filters"
            onClick={() => { closeMenu(); onFiltersToggle(); }}
          />
          <IconButton
            ref={searchButtonRef}
            className="atlas-immersive-search-toggle atlas-application-toolbar-button atlas-application-toolbar-button--search"
            size="md"
            surface="dark"
            icon={<BrandSearchIcon />}
            aria-expanded={searchOpen}
            aria-controls="atlas-search-panel"
            aria-label={t("Поиск по Литературной планете")}
            title={t("Поиск")}
            data-atlas-action="toggle-search"
            onPointerDown={event => {
              // Retain the current mobile Search blur/click ordering.
              if (searchOpen && event.isPrimary && event.button === 0) event.preventDefault();
            }}
            onClick={() => { closeMenu(); onSearchToggle(); }}
          />
          <div ref={menuRootRef} className="atlas-application-menu"
            data-atlas-application-menu={menuOpen ? "open" : "closed"}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
            }}
            onKeyDown={event => {
              if (event.key !== "Escape" || !menuOpen) return;
              event.preventDefault(); event.stopPropagation(); closeMenu(true);
            }}>
            <IconButton
              ref={closeButtonRef}
              className="atlas-application-menu-toggle atlas-application-toolbar-button atlas-application-toolbar-button--menu"
              size="md"
              surface="dark"
              icon={<svg className="atlas-application-menu-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>}
              aria-label={menuLabel}
              title={menuLabel}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              data-atlas-action="toggle-menu"
              onClick={() => {
                if (menuOpen) { closeMenu(true); return; }
                if (searchOpen) onSearchToggle();
                if (filtersOpen) onFiltersToggle();
                setMenuOpen(true);
              }}
            />
            {menuOpen && <div className="atlas-application-menu-backdrop" aria-hidden="true"
              onPointerDown={event => { event.preventDefault(); event.stopPropagation(); closeMenu(true); }} />}
            <div ref={menuPanelRef} id={menuId} className="atlas-application-menu-panel"
              data-atlas-application-menu-panel="" role="group" aria-label={menuLabel} hidden={!menuOpen}>
              <p className="atlas-application-menu-heading">{t("Литературная планета")}</p>
              <div className="atlas-application-menu-group atlas-application-menu-group--personal"
                role="group" aria-label={language === "ru" ? "Личная планета" : "Your planet"}>
                {onAppearance && <Button className="atlas-application-menu-action atlas-application-menu-action--appearance"
                  size="md" surface="dark" variant="secondary" startIcon={<BrandQuillIcon />} endIcon={<MenuChevronIcon />}
                  data-atlas-action="open-appearance" onClick={() => runMenuAction(onAppearance)}>
                  {language === "ru" ? "Оформление" : "Appearance"}
                </Button>}
                <Button className="atlas-application-menu-action atlas-application-menu-action--collection"
                  size="md" surface="dark" variant="secondary" startIcon={<BrandBookIcon />} endIcon={<MenuChevronIcon />}
                  data-atlas-action="open-collection" onClick={() => runMenuAction(onCollection)}>
                  {language === "ru" ? "Коллекция" : "Collection"}
                </Button>
              </div>
              <div className="atlas-application-menu-group atlas-application-menu-group--explore"
                role="group" aria-label={language === "ru" ? "Исследовать планету" : "Explore the planet"}>
                <Button className="atlas-application-menu-action atlas-application-menu-action--journey"
                  size="md" surface="dark" variant="secondary" startIcon={<BrandSparkleIcon />}
                  disabled={randomDisabled} data-atlas-action="random-journey"
                  aria-label={t("Случайное литературное путешествие")}
                  onClick={() => runMenuAction(onRandomJourney)}>
                  {t("Случайное путешествие")}
                </Button>
                {onSource && <Button className="atlas-application-menu-action atlas-application-menu-action--source"
                  size="md" surface="dark" variant="secondary" endIcon={<MenuChevronIcon />}
                  startIcon={<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 11v6M12 7.3v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>}
                  data-atlas-action="globe-source" onClick={() => runMenuAction(onSource)}>
                  {language === "ru" ? "Источник и права" : "Source and rights"}
                </Button>}
              </div>
              <div className="atlas-application-menu-language"
                onClickCapture={event => {
                  if (event.target instanceof Element && event.target.closest("button:not(:disabled)")) closeMenu(true);
                }}>
                <span className="atlas-application-menu-language-title">{t("Язык интерфейса")}</span>
                {languageControl}
              </div>
            </div>
          </div>
        </nav> : <nav aria-label={t("Литературная планета")}>
          <Button
            ref={searchButtonRef}
            className="atlas-immersive-search-toggle"
            size="md"
            surface="dark"
            variant="secondary"
            startIcon={<BrandSearchIcon />}
            aria-expanded={searchOpen}
            aria-controls="atlas-search-panel"
            aria-label={t("Поиск по Литературной планете")}
            data-atlas-action="toggle-search"
            onPointerDown={event => {
              // Keep the mobile input focused until this button owns its click.
              // An earlier blur would close Search and make that click reopen it.
              if (applicationRoot && searchOpen && event.isPrimary && event.button === 0) event.preventDefault();
            }}
            onClick={onSearchToggle}
          >
            {t("Поиск")}
          </Button>
          <Button
            ref={filtersButtonRef}
            className="atlas-immersive-filter-toggle"
            size="md"
            surface="dark"
            variant="secondary"
            startIcon={<BrandFilterIcon />}
            aria-expanded={filtersOpen}
            aria-controls="atlas-filter-panel"
            aria-label={t("Фильтры глобуса")}
            data-atlas-action="toggle-filters"
            onClick={onFiltersToggle}
          >
            {t("Фильтры глобуса")}
          </Button>
          <Button
            className="atlas-immersive-random"
            size="md"
            surface="dark"
            variant="secondary"
            startIcon={<BrandSparkleIcon />}
            disabled={randomDisabled}
            aria-label={t("Случайное литературное путешествие")}
            data-atlas-action="random-journey"
            onClick={onRandomJourney}
          >
            {t("Случайное путешествие")}
          </Button>
          {languageControl}
          <IconButton
            ref={closeButtonRef}
            className="atlas-immersive-close"
            size="md"
            surface="dark"
            icon={applicationRoot ? <BrandBookIcon /> : <BrandCloseIcon />}
            aria-label={applicationRoot ? (language === "ru" ? "Коллекция" : "Collection") : t("Закрыть Литературную планету")}
            data-atlas-action={applicationRoot ? "open-collection" : "exit-immersive"}
            onClick={applicationRoot ? onCollection : onClose}
          />
        </nav>}
      </header>
    </>
  );
}
