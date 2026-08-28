import type { Country } from "../types";

export const antiguaAndBarbuda: Country = {
  id: "antigua_and_barbuda",
  name: "Антигуа и Барбуда",
  code: "ag",
  writers: [
    {
      id: "jamaica_kincaid",
      name: "Джамейка Кинкейд",
      years: "1949-",
      birthDate: "1949-05-25",
      birthPlace: "Сент-Джонс, Антигуа",
      coordinates: {
        lat: 17.1274,
        lng: -61.8468
      },
      portrait: "",
      bio: "Антигуанская писательница и эссеистка, одна из наиболее известных представительниц современной англоязычной литературы Карибского региона. В её произведениях исследуются темы колониального наследия, семьи, памяти и личной идентичности.",
      works: [
        "Энни Джон",
        "Люси",
        "Автобиография моей матери",
        "Моя садовница"
      ],
      genres: [
        "роман",
        "рассказ",
        "эссе"
      ],
      language: "английский",
      nationality: "антигуанка",
      awards: [],
      relatedWriters: [
        "alison_hughes"
      ],
      tags: [
        "XX век",
        "XXI век",
        "карибская литература",
        "постколониальная литература"
      ],
      articleUrl: ""
    },

    {
      id: "alison_hughes",
      name: "Элисон Хьюз",
      years: "1962-",
      birthDate: "1962-01-01",
      birthPlace: "Антигуа и Барбуда",
      coordinates: {
        lat: 17.1274,
        lng: -61.8468
      },
      portrait: "",
      bio: "Современная писательница Антигуа и Барбуды. Автор произведений для детей и взрослых. В её творчестве отражаются темы семьи, культуры, общества и жизни Карибского региона.",
      works: [
        "Uncle Earl and the Sea",
        "Emily Carr: A Brave Canadian Artist"
      ],
      genres: [
        "детская литература",
        "проза"
      ],
      language: "английский",
      nationality: "антигуанка",
      awards: [],
      relatedWriters: [
        "jamaica_kincaid"
      ],
      tags: [
        "XXI век",
        "современная литература"
      ],
      articleUrl: ""
    }
  ]
};
