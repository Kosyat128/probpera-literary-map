import type { Country } from "../types";

export const philippines: Country = {
  id: "philippines",
  name: "Филиппины",
  code: "ph",

  writers: [

    {
      id: "francisco_balagtas",
      name: "Франсиско Балагтас",
      fullName: "Francisco Balagtas",
      years: "1788-1862",
      birthDate: "1788-04-02",
      deathDate: "1862-02-20",
      birthPlace: "Булаг, Филиппины",

      coordinates: {
        lat: 14.7942,
        lng: 120.8799
      },

      portrait: "",

      bio: "Филиппинский поэт и драматург, один из основателей классической литературы на тагальском языке.",

      works: [
        "Florante at Laura"
      ],

      genres: [
        "поэзия",
        "эпос"
      ],

      language: "тагалог",

      nationality: "филиппинец",

      awards: [],

      relatedWriters: [
        "jose_rizal"
      ],

      tags: [
        "XVIII век",
        "XIX век",
        "классика"
      ],

      articleUrl: ""
    },


    {
      id: "jose_rizal",
      name: "Хосе Рисаль",
      fullName: "José Protacio Rizal",
      years: "1861-1896",
      birthDate: "1861-06-19",
      deathDate: "1896-12-30",

      birthPlace: "Каламба, Филиппины",

      coordinates: {
        lat: 14.211,
        lng: 121.165
      },

      portrait: "",

      bio: "Филиппинский писатель и мыслитель. Автор романов, ставших важнейшими произведениями национальной литературы.",

      works: [
        "Noli Me Tángere",
        "El filibusterismo"
      ],

      genres: [
        "роман",
        "социальная проза"
      ],

      language: "испанский",

      nationality: "филиппинец",

      awards: [],

      relatedWriters: [
        "francisco_balagtas",
        "nick_joaquin"
      ],

      tags: [
        "XIX век",
        "национальная литература"
      ],

      articleUrl: ""
    },


    {
      id: "nick_joaquin",
      name: "Ник Хоакин",
      fullName: "Nicomedes Joaquín",
      years: "1917-2004",
      birthDate: "1917-05-04",
      deathDate: "2004-04-29",

      birthPlace: "Манила, Филиппины",

      coordinates: {
        lat: 14.5995,
        lng: 120.9842
      },

      portrait: "",

      bio: "Один из крупнейших филиппинских писателей XX века, мастер рассказа, романа и эссе.",

      works: [
        "The Woman Who Had Two Navels",
        "A Portrait of the Artist as Filipino"
      ],

      genres: [
        "роман",
        "рассказ",
        "эссе"
      ],

      language: "английский",

      nationality: "филиппинец",

      awards: [
        "Национальный артист Филиппин"
      ],

      relatedWriters: [
        "f_sionil_jose",
        "edith_tiempo"
      ],

      tags: [
        "XX век",
        "современная классика"
      ],

      articleUrl: ""
    },


    {
      id: "f_sionil_jose",
      name: "Ф. Сионил Хосе",
      fullName: "Francisco Sionil José",
      years: "1924-2022",

      birthDate: "1924-12-03",
      deathDate: "2022-01-06",

      birthPlace: "Росалес, Филиппины",

      coordinates: {
        lat: 15.894,
        lng: 120.632
      },

      portrait: "",

      bio: "Филиппинский романист, один из самых известных авторов страны в XX веке.",

      works: [
        "Rosales Saga",
        "The Pretenders"
      ],

      genres: [
        "роман",
        "историческая проза"
      ],

      language: "английский",

      nationality: "филиппинец",

      awards: [],

      relatedWriters: [
        "nick_joaquin"
      ],

      tags: [
        "XX век"
      ],

      articleUrl: ""
    },


    {
      id: "edith_tiempo",
      name: "Эдит Тиампо",
      fullName: "Edith L. Tiempo",

      years: "1919-2011",

      birthDate: "1919-04-22",
      deathDate: "2011-08-16",

      birthPlace: "Баяван, Филиппины",

      coordinates: {
        lat: 9.37,
        lng: 122.8
      },

      portrait: "",

      bio: "Филиппинская поэтесса и писательница, одна из крупнейших фигур англоязычной литературы страны.",

      works: [
        "The Tracks of Babylon and Other Poems"
      ],

      genres: [
        "поэзия",
        "роман"
      ],

      language: "английский",

      nationality: "филиппинка",

      awards: [],

      relatedWriters: [
        "nick_joaquin"
      ],

      tags: [
        "XX век",
        "поэзия"
      ],

      articleUrl: ""
    },


    {
      id: "miguel_syjuco",
      name: "Мигель Сихуко",

      fullName: "Miguel Syjuco",

      years: "1976-",

      birthDate: "1976-11-17",

      deathDate: "",

      birthPlace: "Манила, Филиппины",

      coordinates: {
        lat: 14.5995,
        lng: 120.9842
      },

      portrait: "",

      bio: "Современный филиппинский писатель, получивший международное признание благодаря роману «Ilustrado».",

      works: [
        "Ilustrado"
      ],

      genres: [
        "роман",
        "современная проза"
      ],

      language: "английский",

      nationality: "филиппинец",

      awards: [
        "Man Asian Literary Prize"
      ],

      relatedWriters: [
        "nick_joaquin"
      ],

      tags: [
        "XXI век",
        "современная литература"
      ],

      articleUrl: ""
    }

  ]
};
