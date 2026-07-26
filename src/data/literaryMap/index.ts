export { literaryCountries } from "./countries";

export type LiteraryCountry =
  (typeof import("./countries").literaryCountries)[keyof typeof import("./countries").literaryCountries];
