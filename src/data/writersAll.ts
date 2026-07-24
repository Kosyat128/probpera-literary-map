import { writers } from "./writers";
import { europeanWriters } from "./writersEurope";
import { asianWriters } from "./writersAsia";
import { americanWriters } from "./writersAmerica";
import { africanWriters } from "./writersAfrica";
import { oceaniaWriters } from "./writersOceania";

export const allWriters = [
  ...writers,
  ...europeanWriters,
  ...asianWriters,
  ...americanWriters,
  ...africanWriters,
  ...oceaniaWriters,
];
