import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import LiteraryGlobe from "./LiteraryGlobe";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

interface Props {
  countries: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: WriterProfile | null;
  onCountrySelect?: (country: Country) => void;
  onWriterSelect?: (writer: WriterProfile | null) => void;
  filters?: WriterFilterState;
  onFiltersChange?: (filters: WriterFilterState) => void;
}

export default function LiteraryWorldMap({
  countries,
  selectedCountry,
  onCountrySelect,
}: Props) {
  const { t } = useInterfaceLanguage();

  return (
    <section
      className="world-map-stage"
      aria-label={t("Интерактивный литературный глобус")}
    >
      <LiteraryGlobe
        countries={countries}
        selectedCountry={selectedCountry}
        onCountrySelect={onCountrySelect}
      />
    </section>
  );
}
