import type { RefObject } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandFilterIcon from "./BrandFilterIcon";
import BrandSearchIcon from "./BrandSearchIcon";
import InterfaceLanguageControl from "./InterfaceLanguageControl";

type Props = {
  closeButtonRef: RefObject<HTMLButtonElement>;
  searchButtonRef: RefObject<HTMLButtonElement>;
  filtersButtonRef: RefObject<HTMLButtonElement>;
  filtersOpen: boolean;
  immersive: boolean;
  onClose: () => void;
  onFiltersToggle: () => void;
  onSearchToggle: () => void;
  searchOpen: boolean;
};

export default function AtlasExperienceChrome({
  closeButtonRef,
  searchButtonRef,
  filtersButtonRef,
  filtersOpen,
  immersive,
  onClose,
  onFiltersToggle,
  onSearchToggle,
  searchOpen,
}: Props) {
  const { t } = useInterfaceLanguage();

  return (
    <>
      <div className="atlas-cosmic-field" aria-hidden="true">
        <span className="atlas-cosmic-layer atlas-cosmic-layer--far" />
        <span className="atlas-cosmic-layer atlas-cosmic-layer--near" />
        <span className="atlas-celestial-engraving" />
        <span className="atlas-ambient-halo" />
      </div>
      <header
        className="atlas-immersive-chrome"
        aria-hidden={immersive ? undefined : "true"}
      >
        <div className="atlas-immersive-identity">
          <span aria-hidden="true">✦</span>
          <div>
            <small>{t("Интерактивная энциклопедия")}</small>
            <strong>{t("Литературная планета")}</strong>
          </div>
        </div>
        <nav aria-label={t("Литературная планета")}>
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
          <InterfaceLanguageControl />
          <IconButton
            ref={closeButtonRef}
            className="atlas-immersive-close"
            size="md"
            surface="dark"
            icon={<BrandCloseIcon />}
            aria-label={t("Закрыть Литературную планету")}
            data-atlas-action="exit-immersive"
            onClick={onClose}
          />
        </nav>
      </header>
    </>
  );
}
