import type { Country } from "./types";
import { france } from "./writers/france";
import { russia } from "./writers/russia";

export const countries: Country[] = [france, russia];
