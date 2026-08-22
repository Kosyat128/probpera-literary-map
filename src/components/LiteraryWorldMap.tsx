import type { Ref } from "react";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import LiteraryGlobe, { type LiteraryGlobeMode } from "./LiteraryGlobe";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

interface Props {
  countries: Country[];
  atlasCountries?: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: WriterProfile | null;
  onCountrySelect?: (country: Country) => void;
  onWriterSelect?: (country: Country, writer: WriterProfile) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
  filters?: WriterFilterState;
  onFiltersChange?: (filters: WriterFilterState) => void;
  mode?: LiteraryGlobeMode;
  rootRef?: Ref<HTMLElement>;
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
      />
    </section>
  );
}
