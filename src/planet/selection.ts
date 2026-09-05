/** Pure canonical presentation/selection functions; no catalog or 3D runtime. */
export {
  countryForLanguage,
  countryWithActiveLanguage,
  selectCountryEnglishTranslation,
} from "../data/countryLocalization";
export {
  selectBookAuthorByline,
  selectBookAuthorNames,
  selectBookAuthorRefs,
  selectBookMetadataLabels,
  selectBookOriginalLanguage,
  selectBookText,
  selectBookWriterName,
  selectWriterDisplayName,
  selectWriterYears,
} from "../data/bookLocalization";
export { selectWriterBiography } from "../data/writerBiography";
export {
  createGlobeCoordinates,
  formatGlobeCoordinatesDms,
  resolveCountryGlobeCoordinates,
  resolveGlobeCoordinateContext,
} from "../components/globeCoordinates";
export {
  chooseRandomLiteraryDestination,
  rememberLiteraryDestination,
} from "../components/globeDiscovery";
export {
  readAtlasUrlState,
  withAtlasUrlState,
} from "../utils/atlasUrlState";
export {
  createAtlasExperienceState,
  atlasExperienceReducer,
} from "../atlas/atlasExperienceState";
export type { AtlasExperienceEvent, AtlasExperienceState } from "../atlas/atlasExperienceState";
export type { AtlasUrlFilter, AtlasUrlState } from "../utils/atlasUrlState";
