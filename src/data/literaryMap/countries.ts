import { russia } from "../writers/russia";
import { convertWriters } from "../writers/convertWriter";

const convertedRussianWriters = convertWriters(russia.writers);

export const literaryCountries = {
  russia: {
    name: "Россия",
    flag: "🇷🇺",
    writers: convertedRussianWriters.length,
    articles: 127,
    places: 45,
    nobel: convertedRussianWriters.filter(writer => writer.nobelYear).length,
    influence: 95,
    writersList: convertedRussianWriters,
    authors: convertedRussianWriters.slice(0, 5).map(writer => writer.fullName || writer.name)
  },

  france: {
    name: "Франция",
    flag: "🇫🇷",
    writers: 96,
    articles: 51,
    places: 30,
    nobel: 16,
    influence: 90,
    authors: ["Виктор Мари Гюго", "Оноре де Бальзак", "Гюстав Флобер", "Марсель Пруст"]
  },

  uk: {
    name: "Великобритания",
    flag: "🇬🇧",
    writers: 120,
    articles: 67,
    places: 40,
    nobel: 14,
    influence: 95,
    authors: ["Уильям Шекспир", "Чарльз Диккенс", "Джейн Остин", "Джордж Оруэлл"]
  },

  usa: {
    name: "США",
    flag: "🇺🇸",
    writers: 150,
    articles: 80,
    places: 50,
    nobel: 13,
    influence: 96,
    authors: ["Эрнест Хемингуэй", "Марк Твен", "Уильям Фолкнер", "Фрэнсис Скотт Фицджеральд"]
  },

  japan: {
    name: "Япония",
    flag: "🇯🇵",
    writers: 80,
    articles: 40,
    places: 25,
    nobel: 2,
    influence: 85,
    authors: ["Ясунари Кавабата", "Кэндзабуро Оэ", "Харуки Мураками"]
  }
};
