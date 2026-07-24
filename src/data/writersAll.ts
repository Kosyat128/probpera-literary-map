import { writers } from "./writers";
import { russianWriters } from "./writersRussia";
import { europeanWriters } from "./writersEurope";
import { asianWriters } from "./writersAsia";
import { americanWriters } from "./writersAmerica";
import { southAmericanWriters } from "./writersSouthAmerica";
import { africanWriters } from "./writersAfrica";
import { oceaniaWriters } from "./writersOceania";
import { middleEastWriters } from "./writersMiddleEast";
import { scandinavianWriters } from "./writersScandinavia";

export const allWriters = [
  ...writers,
  ...russianWriters,
  ...europeanWriters,
  ...asianWriters,
  ...americanWriters,
  ...southAmericanWriters,
  ...africanWriters,
  ...oceaniaWriters,
  ...middleEastWriters,
  ...scandinavianWriters,
];
