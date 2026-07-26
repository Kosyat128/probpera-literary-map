export type CountryMetadata = {
  continent: string;
  region: string;
  officialLanguage: string;
  literaryPeriods: string[];
  literaryMovements: string[];
};

export const countryMetadata: Record<string, CountryMetadata> = {
  russia: {
    continent: "Европа и Азия",
    region: "Восточная Европа",
    officialLanguage: "русский",
    literaryPeriods: [
      "Древнерусская литература",
      "XVIII век",
      "Золотой век русской литературы",
      "Серебряный век",
      "Литература XX века",
      "Современная литература"
    ],
    literaryMovements: [
      "Классицизм",
      "Сентиментализм",
      "Романтизм",
      "Реализм",
      "Символизм",
      "Футуризм"
    ]
  },
  france: {
    continent: "Европа",
    region: "Западная Европа",
    officialLanguage: "французский",
    literaryPeriods: [
      "Средневековая литература",
      "Классицизм",
      "Просвещение",
      "XIX век",
      "XX век"
    ],
    literaryMovements: [
      "Классицизм",
      "Романтизм",
      "Реализм",
      "Символизм",
      "Экзистенциализм"
    ]
  }
};
