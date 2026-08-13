import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import LiteraryGlobe from "./LiteraryGlobe";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

interface Props {
  countries: Country[];
  atlasCountries?: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: WriterProfile | null;
  onCountrySelect?: (country: Country) => void;
  onWriterSelect?: (writer: WriterProfile | null) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
  filters?: WriterFilterState;
  onFiltersChange?: (filters: WriterFilterState) => void;
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
}: Props) {
  const { t } = useInterfaceLanguage();

  return (
    <section
      className="world-map-stage"
      aria-label={t("Интерактивный литературный глобус")}
    >
      <LiteraryGlobe
        countries={countries}
        atlasCountries={atlasCountries}
        selectedCountry={selectedCountry}
        selectedWriter={selectedWriter}
        onCountrySelect={onCountrySelect}
        onWriterSelect={(country, writer) => {
          onCountrySelect?.(country);
          onWriterSelect?.(writer);
        }}
        showNobelLaureates={showNobelLaureates}
        nobelCountryId={nobelCountryId}
      />
    </section>
  );
}
