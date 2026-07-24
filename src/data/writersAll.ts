import { writers } from "./writers";
import { europeanWriters } from "./writersEurope";
import { asianWriters } from "./writersAsia";
import { americanWriters } from "./writersAmerica";
import { africanWriters } from "./writersAfrica";
import { oceaniaWriters } from "./writersOceania";
import { russianWriters } from "./writersRussia";

export const allWriters = [
  ...writers,
  ...russianWriters,
  ...europeanWriters,
  ...asianWriters,
  ...americanWriters,
  ...africanWriters,
  ...oceaniaWriters,
];
