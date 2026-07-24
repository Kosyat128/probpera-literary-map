import { writers } from "./writers";
import { russianWriters } from "./writersRussia";
import { europeanWriters } from "./writersEurope";
import { asianWriters } from "./writersAsia";
import { americanWriters } from "./writersAmerica";
import { africanWriters } from "./writersAfrica";
import { oceaniaWriters } from "./writersOceania";
import { middleEastWriters } from "./writersMiddleEast";

export const allWriters = [
  ...writers,
  ...russianWriters,
  ...europeanWriters,
  ...asianWriters,
  ...americanWriters,
  ...africanWriters,
  ...oceaniaWriters,
  ...middleEastWriters,
];
