import type { Ref } from "react";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import LiteraryGlobe, {
  type GlobeCountrySelectionSource,
  type GlobeExplicitFocusRequest,
  type LiteraryGlobeMode,
} from "./LiteraryGlobe";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { GlobeViewSample } from "./GlobeViewObserver";

interface Props {
  countries: Country[];
  atlasCountries?: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: WriterProfile | null;
  onCountrySelect?: (
    country: Country,
    source?: GlobeCountrySelectionSource
  ) => void;
  onWriterSelect?: (country: Country, writer: WriterProfile) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
  filters?: WriterFilterState;
  onFiltersChange?: (filters: WriterFilterState) => void;
  mode?: LiteraryGlobeMode;
  rootRef?: Ref<HTMLElement>;
  onViewSample?: (sample: GlobeViewSample) => void;
  onHoverCountryChange?: (country: Country | null) => void;
  focusRequest?: GlobeExplicitFocusRequest | null;
  economical?: boolean;
}

export default function LiteraryWorldMap({
  countries,
  atlasCountries,
  selectedCountry,
  selectedWriter,
  onCountrySelect,
  onWriterSelect,
  showNobelLaureates,
  nobelCountryId,
  mode = "embedded",
  rootRef,
  onViewSample,
  onHoverCountryChange,
  focusRequest,
  economical = false,
}: Props) {
  const { t } = useInterfaceLanguage();

  return (
    <section
      ref={rootRef}
      className="world-map-stage"
      aria-label={t("Интерактивный литературный глобус")}
      data-globe-mode={mode}
    >
      <LiteraryGlobe
        countries={countries}
        atlasCountries={atlasCountries}
        selectedCountry={selectedCountry}
        selectedWriter={selectedWriter}
        onCountrySelect={onCountrySelect}
        onWriterSelect={onWriterSelect}
        showNobelLaureates={showNobelLaureates}
        nobelCountryId={nobelCountryId}
        mode={mode}
        onViewSample={onViewSample}
        onHoverCountryChange={onHoverCountryChange}
        focusRequest={focusRequest}
        economical={economical}
      />
    </section>
  );
}
