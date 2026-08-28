import type { Country } from "../types";

export const usa: Country = {
  id: "usa",
  name: "США",
  code: "us",
  writers: [
    {
      id: "william_bradford",
      name: "Уильям Брэдфорд",
      years: "1590-1657",
      birthDate: "1590",
      deathDate: "1657-05-09",
      birthPlace: "Олдхэм, Англия",
      deathPlace: "Плимутская колония",
      coordinates: {
        lat: 53.5409,
        lng: -2.1183
      },
      portrait: "",
      bio: "Английский колонист, историк и губернатор Плимутской колонии. Автор хроники о первых годах существования колонии.",
      works: [
        "История Плимутской плантации"
      ],
      genres: [
        "история",
        "мемуары",
        "хроника"
      ],
      language: "английский",
      nationality: "англичанин",
      awards: [],
      relatedWriters: [],
      tags: [
        "колониальная литература",
        "XVII век"
      ],
      articleUrl: ""
    },
    {
      id: "anne_bradstreet",
      name: "Энн Брэдстрит",
      years: "1612-1672",
      birthDate: "1612-03-20",
      deathDate: "1672-09-16",
      birthPlace: "Нортгемптон, Англия",
      deathPlace: "Андовер, Массачусетс",
      coordinates: {
        lat: 42.6584,
        lng: -71.1369
      },
      portrait: "",
      bio: "Первая значительная американская поэтесса, одна из первых опубликованных авторов английской литературы в Северной Америке.",
      works: [
        "Десятая муза, недавно явившаяся в Америке"
      ],
      genres: [
        "поэзия",
        "религиозная литература"
      ],
      language: "английский",
      nationality: "англичанка",
      awards: [],
      relatedWriters: [],
      tags: [
        "колониальная литература",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "benjamin_franklin",
      name: "Бенджамин Франклин",
      years: "1706-1790",
      birthDate: "1706-01-17",
      deathDate: "1790-04-17",
      birthPlace: "Бостон, Британская Америка",
      deathPlace: "Филадельфия, США",
      coordinates: {
        lat: 42.3601,
        lng: -71.0589
      },
      portrait: "",
      bio: "Американский просветитель, писатель, учёный и государственный деятель, один из отцов-основателей США.",
      works: [
        "Автобиография Бенджамина Франклина",
        "Альманах бедного Ричарда"
      ],
      genres: [
        "автобиография",
        "эссе",
        "публицистика"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "Просвещение"
      ],
      articleUrl: ""
    },
    {
      id: "thomas_paine",
      name: "Томас Пейн",
      years: "1737-1809",
      birthDate: "1737-02-09",
      deathDate: "1809-06-08",
      birthPlace: "Тетфорд, Англия",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 52.9807,
        lng: 0.2277
      },
      portrait: "",
      bio: "Англо-американский писатель и политический мыслитель, один из важнейших публицистов эпохи Американской революции.",
      works: [
        "Здравый смысл",
        "Права человека",
        "Век разума"
      ],
      genres: [
        "публицистика",
        "философская литература"
      ],
      language: "английский",
      nationality: "англо-американский",
      awards: [],
      relatedWriters: [
        "benjamin_franklin"
      ],
      tags: [
        "XVIII век",
        "Просвещение"
      ],
      articleUrl: ""
    },
    {
      id: "thomas_jefferson",
      name: "Томас Джефферсон",
      years: "1743-1826",
      birthDate: "1743-04-13",
      deathDate: "1826-07-04",
      birthPlace: "Шадуэлл, Виргиния",
      deathPlace: "Монтичелло, США",
      coordinates: {
        lat: 37.5323,
        lng: -78.4536
      },
      portrait: "",
      bio: "Американский политический деятель, писатель и автор Декларации независимости США.",
      works: [
        "Декларация независимости США",
        "Записки о штате Виргиния"
      ],
      genres: [
        "политическая литература",
        "эссе"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "американское Просвещение"
      ],
      articleUrl: ""
    },
    {
      id: "washington_irving",
      name: "Вашингтон Ирвинг",
      years: "1783-1859",
      birthDate: "1783-04-03",
      deathDate: "1859-11-28",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Тэрритаун, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель, один из первых профессиональных авторов США, мастер короткой прозы и сатиры.",
      works: [
        "Рип ван Винкль",
        "Легенда о Сонной Лощине",
        "История Нью-Йорка"
      ],
      genres: [
        "рассказ",
        "сатира",
        "романтизм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
        {
      id: "james_fenimore_cooper",
      name: "Джеймс Фенимор Купер",
      years: "1789-1851",
      birthDate: "1789-09-15",
      deathDate: "1851-09-14",
      birthPlace: "Берлингтон, США",
      deathPlace: "Куперстаун, США",
      coordinates: {
        lat: 40.0712,
        lng: -74.8649
      },
      portrait: "",
      bio: "Американский писатель, один из основателей американского исторического и приключенческого романа.",
      works: [
        "Последний из могикан",
        "Зверобой",
        "Следопыт",
        "Пионеры"
      ],
      genres: [
        "приключенческий роман",
        "исторический роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "washington_irving"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "edgar_allan_poe",
      name: "Эдгар Аллан По",
      years: "1809-1849",
      birthDate: "1809-01-19",
      deathDate: "1849-10-07",
      birthPlace: "Бостон, США",
      deathPlace: "Балтимор, США",
      coordinates: {
        lat: 42.3601,
        lng: -71.0589
      },
      portrait: "",
      bio: "Американский писатель, поэт и литературный критик, один из основателей жанров детектива и психологического хоррора.",
      workDetails: [
        {
          "id": "the-fall-of-the-house-of-usher-editorial",
          "title": "Падение дома Ашеров",
          "coverUrl": "brand/book-covers/the-fall-of-the-house-of-usher-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-fall-of-the-house-of-usher-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-fall-of-the-house-of-usher-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-fall-of-the-house-of-usher-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Ворон",
        "Убийства на улице Морг",
        "Чёрный кот"
      ],
      genres: [
        "готика",
        "детектив",
        "ужасы",
        "поэзия"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "романтизм",
        "готическая литература"
      ],
      articleUrl: ""
    },
    {
      id: "ralph_waldo_emerson",
      name: "Ральф Уолдо Эмерсон",
      years: "1803-1882",
      birthDate: "1803-05-25",
      deathDate: "1882-04-27",
      birthPlace: "Бостон, США",
      deathPlace: "Конкорд, США",
      coordinates: {
        lat: 42.3601,
        lng: -71.0589
      },
      portrait: "",
      bio: "Американский философ, эссеист и поэт, один из основателей американского трансцендентализма.",
      works: [
        "Природа",
        "Эссе",
        "Американский учёный"
      ],
      genres: [
        "эссе",
        "философия",
        "поэзия"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "henry_david_thoreau"
      ],
      tags: [
        "XIX век",
        "трансцендентализм"
      ],
      articleUrl: ""
    },
    {
      id: "henry_david_thoreau",
      name: "Генри Дэвид Торо",
      years: "1817-1862",
      birthDate: "1817-07-12",
      deathDate: "1862-05-06",
      birthPlace: "Конкорд, США",
      deathPlace: "Конкорд, США",
      coordinates: {
        lat: 42.4604,
        lng: -71.3489
      },
      portrait: "",
      bio: "Американский писатель, философ и натуралист, представитель трансцендентализма.",
      works: [
        "Уолден, или Жизнь в лесу",
        "Гражданское неповиновение"
      ],
      genres: [
        "эссе",
        "философская проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "ralph_waldo_emerson"
      ],
      tags: [
        "XIX век",
        "трансцендентализм"
      ],
      articleUrl: ""
    },
    {
      id: "nathaniel_hawthorne",
      name: "Натаниэль Готорн",
      years: "1804-1864",
      birthDate: "1804-07-04",
      deathDate: "1864-05-19",
      birthPlace: "Салем, США",
      deathPlace: "Плимут, США",
      coordinates: {
        lat: 42.5195,
        lng: -70.8967
      },
      portrait: "",
      bio: "Американский писатель, один из крупнейших представителей американского романтизма.",
      works: [
        "Алая буква",
        "Дом о семи фронтонах",
        "Мраморный фавн"
      ],
      genres: [
        "роман",
        "романтизм",
        "готика"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "edgar_allan_poe"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "herman_melville",
      name: "Герман Мелвилл",
      years: "1819-1891",
      birthDate: "1819-08-01",
      deathDate: "1891-09-28",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель, автор одного из величайших романов мировой литературы.",
      works: [
        "Моби Дик",
        "Билли Бадд",
        "Тайпи"
      ],
      genres: [
        "роман",
        "морская литература",
        "символизм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "nathaniel_hawthorne"
      ],
      tags: [
        "XIX век",
        "мировая литература"
      ],
      articleUrl: ""
    },
        {
      id: "walt_whitman",
      name: "Уолт Уитмен",
      years: "1819-1892",
      birthDate: "1819-05-31",
      deathDate: "1892-03-26",
      birthPlace: "Уэст-Хиллс, США",
      deathPlace: "Камден, США",
      coordinates: {
        lat: 40.8154,
        lng: -73.4148
      },
      portrait: "",
      bio: "Американский поэт, один из крупнейших реформаторов американской поэзии XIX века.",
      works: [
        "Листья травы",
        "О капитане! Мой капитан!"
      ],
      genres: [
        "поэзия",
        "лирика"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "поэзия",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "emily_dickinson",
      name: "Эмили Дикинсон",
      years: "1830-1886",
      birthDate: "1830-12-10",
      deathDate: "1886-05-15",
      birthPlace: "Амхерст, США",
      deathPlace: "Амхерст, США",
      coordinates: {
        lat: 42.3732,
        lng: -72.5199
      },
      portrait: "",
      bio: "Американская поэтесса, одна из самых значительных фигур мировой лирики XIX века.",
      works: [
        "Стихотворения Эмили Дикинсон"
      ],
      genres: [
        "поэзия",
        "лирика"
      ],
      language: "английский",
      nationality: "американка",
      awards: [],
      relatedWriters: [
        "walt_whitman"
      ],
      tags: [
        "XIX век",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "mark_twain",
      name: "Марк Твен",
      years: "1835-1910",
      birthDate: "1835-11-30",
      deathDate: "1910-04-21",
      birthPlace: "Флорида, США",
      deathPlace: "Реддинг, США",
      coordinates: {
        lat: 39.469,
        lng: -91.79
      },
      portrait: "",
      bio: "Американский писатель и сатирик, один из крупнейших представителей американской литературы XIX века.",
      works: [
        "Приключения Тома Сойера",
        "Приключения Гекльберри Финна",
        "Янки из Коннектикута при дворе короля Артура"
      ],
      genres: [
        "роман",
        "сатира",
        "приключенческая литература"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "henry_james",
      name: "Генри Джеймс",
      years: "1843-1916",
      birthDate: "1843-04-15",
      deathDate: "1916-02-28",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Челси, Великобритания",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель, один из крупнейших мастеров психологического романа.",
      workDetails: [
        {
          "id": "the-turn-of-the-screw-editorial",
          "title": "Поворот винта",
          "coverUrl": "brand/book-covers/the-turn-of-the-screw-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-turn-of-the-screw-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-turn-of-the-screw-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-turn-of-the-screw-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Портрет леди",
        "Вашингтонская площадь"
      ],
      genres: [
        "роман",
        "психологическая проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "модернизм"
      ],
      articleUrl: ""
    },
    {
      id: "jack_london",
      name: "Джек Лондон",
      years: "1876-1916",
      birthDate: "1876-01-12",
      deathDate: "1916-11-22",
      birthPlace: "Сан-Франциско, США",
      deathPlace: "Глен-Эллен, США",
      coordinates: {
        lat: 37.7749,
        lng: -122.4194
      },
      portrait: "",
      bio: "Американский писатель и журналист, автор приключенческих и социально-философских произведений.",
      works: [
        "Мартин Иден",
        "Зов предков"
      ],
      workDetails: [
        {
          id: "the-sea-wolf",
          title: "Морской волк",
          originalTitle: "The Sea-Wolf",
          firstPublished: 1904,
          originalLanguage: "английский",
          genres: [
            "приключенческий роман",
            "морской роман"
          ],
          tags: [
            "море",
            "выживание",
            "воля",
            "нравственный выбор"
          ],
          description: "Роман о столкновении литературного критика Хэмфри ван Вейдена с капитаном Волком Ларсеном. Морское приключение становится спором о силе, свободе, сострадании и цене человеческого достоинства.",
          coverUrl: "brand/book-covers/sea-wolf-editorial.webp",
          coverThumbnailUrl: "brand/book-covers/thumbs/sea-wolf-editorial.webp",
          coverSourceUrl: "brand/book-covers/sea-wolf-editorial.webp",
          coverRights: {
            status: "editorial-original",
            licenseName: "Редакционное оформление «Пробы Пера»",
            creator: "Редакция «Пробы Пера»",
            rightsHolder: "Проба Пера",
            sourceUrl: "brand/book-covers/sea-wolf-editorial.webp",
            checkedAt: "2026-08-01",
            note: "Собственная художественная обложка сайта; не является воспроизведением конкретного издательского тиража."
          },
          sourceUrl: "https://www.gutenberg.org/ebooks/1074",
          editorial: {
            status: "verified",
            reviewedAt: "2026-08-01"
          }
        }
      ,
        {
          "id": "white-fang-editorial",
          "title": "Белый клык",
          "coverUrl": "brand/book-covers/white-fang-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/white-fang-editorial.webp",
          "coverSourceUrl": "brand/book-covers/white-fang-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/white-fang-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      genres: [
        "приключенческий роман",
        "реализм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "приключенческая литература"
      ],
      articleUrl: ""
    },
    {
      id: "edith_wharton",
      name: "Эдит Уортон",
      years: "1862-1937",
      birthDate: "1862-01-24",
      deathDate: "1937-08-11",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Сен-Брис-су-Форе, Франция",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американская писательница и первая женщина - лауреат Пулитцеровской премии за художественное произведение.",
      works: [
        "Эпоха невинности",
        "Дом веселья",
        "Итан Фром"
      ],
      genres: [
        "роман",
        "реализм"
      ],
      language: "английский",
      nationality: "американка",
      awards: [
        "Пулитцеровская премия 1921 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "theodore_dreiser",
      name: "Теодор Драйзер",
      years: "1871-1945",
      birthDate: "1871-08-27",
      deathDate: "1945-12-28",
      birthPlace: "Терре-Хот, США",
      deathPlace: "Голливуд, США",
      coordinates: {
        lat: 39.4667,
        lng: -87.4139
      },
      portrait: "",
      bio: "Американский писатель и журналист, один из крупнейших представителей американского натурализма.",
      workDetails: [
        {
          "id": "an-american-tragedy-editorial",
          "title": "Американская трагедия",
          "coverUrl": "brand/book-covers/an-american-tragedy-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/an-american-tragedy-editorial.webp",
          "coverSourceUrl": "brand/book-covers/an-american-tragedy-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/an-american-tragedy-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Сестра Керри",
        "Финансист"
      ],
      genres: [
        "натурализм",
        "роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "натурализм"
      ],
      articleUrl: ""
    },
        {
      id: "francis_scott_fitzgerald",
      name: "Фрэнсис Скотт Фицджеральд",
      years: "1896-1940",
      birthDate: "1896-09-24",
      deathDate: "1940-12-21",
      birthPlace: "Сент-Пол, США",
      deathPlace: "Лос-Анджелес, США",
      coordinates: {
        lat: 44.9537,
        lng: -93.09
      },
      portrait: "",
      bio: "Американский писатель, один из главных представителей «потерянного поколения», автор романов о поколении эпохи джаза.",
      workDetails: [
        {
          "id": "tender-is-the-night-editorial",
          "title": "Ночь нежна",
          "coverUrl": "brand/book-covers/tender-is-the-night-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/tender-is-the-night-editorial.webp",
          "coverSourceUrl": "brand/book-covers/tender-is-the-night-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/tender-is-the-night-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Великий Гэтсби",
        "По эту сторону рая"
      ],
      genres: [
        "роман",
        "реализм",
        "модернизм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "ernest_hemingway"
      ],
      tags: [
        "XX век",
        "потерянное поколение"
      ],
      articleUrl: ""
    },
    {
      id: "ernest_hemingway",
      name: "Эрнест Хемингуэй",
      years: "1899-1961",
      birthDate: "1899-07-21",
      deathDate: "1961-07-02",
      birthPlace: "Оук-Парк, США",
      deathPlace: "Кетчум, США",
      coordinates: {
        lat: 41.885,
        lng: -87.7845
      },
      portrait: "",
      bio: "Американский писатель и журналист, лауреат Нобелевской премии по литературе 1954 года, один из крупнейших авторов XX века.",
      workDetails: [
        {
          "id": "for-whom-the-bell-tolls-editorial",
          "title": "По ком звонит колокол",
          "coverUrl": "brand/book-covers/for-whom-the-bell-tolls-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/for-whom-the-bell-tolls-editorial.webp",
          "coverSourceUrl": "brand/book-covers/for-whom-the-bell-tolls-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/for-whom-the-bell-tolls-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Старик и море",
        "Прощай, оружие!",
        "И восходит солнце"
      ],
      genres: [
        "роман",
        "повесть",
        "военная проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Нобелевская премия по литературе 1954 года",
        "Пулитцеровская премия 1953 года"
      ],
      relatedWriters: [
        "francis_scott_fitzgerald"
      ],
      tags: [
        "XX век",
        "Нобелевская премия",
        "потерянное поколение"
      ],
      articleUrl: ""
    },
    {
      id: "william_faulkner",
      name: "Уильям Фолкнер",
      years: "1897-1962",
      birthDate: "1897-09-25",
      deathDate: "1962-07-06",
      birthPlace: "Нью-Олбани, США",
      deathPlace: "Байхалия, США",
      coordinates: {
        lat: 34.4943,
        lng: -89.0078
      },
      portrait: "",
      bio: "Американский писатель, лауреат Нобелевской премии по литературе 1949 года, один из крупнейших представителей модернизма.",
      workDetails: [
        {
          "id": "the-sound-and-the-fury-editorial",
          "title": "Шум и ярость",
          "coverUrl": "brand/book-covers/the-sound-and-the-fury-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-sound-and-the-fury-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-sound-and-the-fury-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-sound-and-the-fury-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Когда я умирала",
        "Свет в августе",
        "Авессалом, Авессалом!"
      ],
      genres: [
        "модернизм",
        "южная готика",
        "роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Нобелевская премия по литературе 1949 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "eugene_oneill",
      name: "Юджин О’Нил",
      years: "1888-1953",
      birthDate: "1888-10-16",
      deathDate: "1953-11-27",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Бостон, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский драматург, лауреат Нобелевской премии по литературе 1936 года, крупнейший автор американского театра.",
      works: [
        "Долгий день уходит в ночь",
        "Любовь под вязами",
        "Император Джонс"
      ],
      genres: [
        "драма",
        "театр"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Нобелевская премия по литературе 1936 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "драматургия"
      ],
      articleUrl: ""
    },
    {
      id: "john_steinbeck",
      name: "Джон Стейнбек",
      years: "1902-1968",
      birthDate: "1902-02-27",
      deathDate: "1968-12-20",
      birthPlace: "Салинас, США",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 36.6777,
        lng: -121.6555
      },
      portrait: "",
      bio: "Американский писатель, лауреат Нобелевской премии по литературе 1962 года, известный произведениями о простых людях и социальной несправедливости.",
      workDetails: [
        {
          "id": "the-grapes-of-wrath-editorial",
          "title": "Гроздья гнева",
          "coverUrl": "brand/book-covers/the-grapes-of-wrath-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-grapes-of-wrath-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-grapes-of-wrath-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-grapes-of-wrath-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "О мышах и людях",
        "К востоку от Эдема"
      ],
      genres: [
        "социальный роман",
        "реализм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Нобелевская премия по литературе 1962 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "sinclair_lewis",
      name: "Синклер Льюис",
      years: "1885-1951",
      birthDate: "1885-02-07",
      deathDate: "1951-01-10",
      birthPlace: "Саук-Сентер, США",
      deathPlace: "Рим, Италия",
      coordinates: {
        lat: 45.5916,
        lng: -94.5728
      },
      portrait: "",
      bio: "Американский писатель, первый американец, получивший Нобелевскую премию по литературе.",
      works: [
        "Бэббит",
        "Эроусмит",
        "Главная улица"
      ],
      genres: [
        "сатирический роман",
        "реализм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Нобелевская премия по литературе 1930 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "john_dos_passos",
      name: "Джон Дос Пассос",
      years: "1896-1970",
      birthDate: "1896-01-14",
      deathDate: "1970-09-28",
      birthPlace: "Чикаго, США",
      deathPlace: "Балтимор, США",
      coordinates: {
        lat: 41.8781,
        lng: -87.6298
      },
      portrait: "",
      bio: "Американский писатель, представитель модернизма и автор экспериментальных романов о современной Америке.",
      works: [
        "Манхэттен",
        "США"
      ],
      genres: [
        "модернизм",
        "роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "ernest_hemingway"
      ],
      tags: [
        "XX век",
        "модернизм"
      ],
      articleUrl: ""
    },
        {
      id: "henry_miller",
      name: "Генри Миллер",
      years: "1891-1980",
      birthDate: "1891-12-26",
      deathDate: "1980-06-07",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Пасифик-Палисейдс, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель и художник, известный экспериментальной прозой и новаторским стилем.",
      works: [
        "Тропик Рака",
        "Тропик Козерога",
        "Чёрная весна"
      ],
      genres: [
        "автобиографический роман",
        "модернизм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "модернизм"
      ],
      articleUrl: ""
    },
    {
      id: "ray_bradbury",
      name: "Рэй Брэдбери",
      years: "1920-2012",
      birthDate: "1920-08-22",
      deathDate: "2012-06-05",
      birthPlace: "Уокиган, США",
      deathPlace: "Лос-Анджелес, США",
      coordinates: {
        lat: 42.3636,
        lng: -87.8448
      },
      portrait: "",
      bio: "Американский писатель-фантаст, один из самых известных авторов научной фантастики XX века.",
      workDetails: [
        {
          "id": "dandelion-wine-editorial",
          "title": "Вино из одуванчиков",
          "coverUrl": "brand/book-covers/dandelion-wine-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/dandelion-wine-editorial.webp",
          "coverSourceUrl": "brand/book-covers/dandelion-wine-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/dandelion-wine-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        },
        {
          "id": "fahrenheit-451-editorial",
          "title": "451° по Фаренгейту",
          "coverUrl": "brand/book-covers/fahrenheit-451-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/fahrenheit-451-editorial.webp",
          "coverSourceUrl": "brand/book-covers/fahrenheit-451-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/fahrenheit-451-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Марсианские хроники",
      ],
      genres: [
        "научная фантастика",
        "антиутопия",
        "фэнтези"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Пулитцеровская премия за особые достижения 2007 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "фантастика"
      ],
      articleUrl: ""
    },
    {
      id: "isaac_asimov",
      name: "Айзек Азимов",
      years: "1920-1992",
      birthDate: "1920-01-02",
      deathDate: "1992-04-06",
      birthPlace: "Петровичи, СССР",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 53.12,
        lng: 32.16
      },
      portrait: "",
      bio: "Американский писатель-фантаст, биохимик и популяризатор науки, один из крупнейших авторов научной фантастики.",
      works: [
        "Основание",
        "Я, робот",
        "Стальные пещеры"
      ],
      genres: [
        "научная фантастика",
        "философская проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "ray_bradbury"
      ],
      tags: [
        "XX век",
        "фантастика"
      ],
      articleUrl: ""
    },
    {
      id: "kurt_vonnegut",
      name: "Курт Воннегут",
      years: "1922-2007",
      birthDate: "1922-11-11",
      deathDate: "2007-04-11",
      birthPlace: "Индианаполис, США",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 39.7684,
        lng: -86.1581
      },
      portrait: "",
      bio: "Американский писатель, известный сатирической и антиутопической прозой.",
      workDetails: [
        {
          "id": "slaughterhouse-five-editorial",
          "title": "Бойня номер пять",
          "coverUrl": "brand/book-covers/slaughterhouse-five-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/slaughterhouse-five-editorial.webp",
          "coverSourceUrl": "brand/book-covers/slaughterhouse-five-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/slaughterhouse-five-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Колыбель для кошки",
        "Сирены Титана"
      ],
      genres: [
        "сатира",
        "научная фантастика",
        "роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "ray_bradbury"
      ],
      tags: [
        "XX век",
        "постмодернизм"
      ],
      articleUrl: ""
    },
    {
      id: "jerome_david_salinger",
      name: "Джером Дэвид Сэлинджер",
      years: "1919-2010",
      birthDate: "1919-01-01",
      deathDate: "2010-01-27",
      birthPlace: "Нью-Йорк, США",
      deathPlace: "Корниш, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель, наиболее известный романом о подростковом взрослении.",
      workDetails: [
        {
          "id": "the-catcher-in-the-rye-editorial",
          "title": "Над пропастью во ржи",
          "coverUrl": "brand/book-covers/the-catcher-in-the-rye-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-catcher-in-the-rye-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-catcher-in-the-rye-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-catcher-in-the-rye-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Девять рассказов"
      ],
      genres: [
        "роман",
        "рассказ"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "американская литература"
      ],
      articleUrl: ""
    },
    {
      id: "ralph_ellison",
      name: "Ральф Эллисон",
      years: "1913-1994",
      birthDate: "1913-03-01",
      deathDate: "1994-04-16",
      birthPlace: "Оклахома-Сити, США",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 35.4676,
        lng: -97.5164
      },
      portrait: "",
      bio: "Американский писатель и литературный критик, автор одного из главных романов XX века об идентичности и расовом опыте.",
      works: [
        "Человек-невидимка"
      ],
      genres: [
        "роман",
        "социальная проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Национальная книжная премия США 1953 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "американская литература"
      ],
      articleUrl: ""
    },
    {
      id: "harper_lee",
      name: "Харпер Ли",
      years: "1926-2016",
      birthDate: "1926-04-28",
      deathDate: "2016-02-19",
      birthPlace: "Монровилл, США",
      deathPlace: "Монровилл, США",
      coordinates: {
        lat: 31.527,
        lng: -87.3247
      },
      portrait: "",
      bio: "Американская писательница, автор одного из самых известных романов американской литературы XX века.",
      workDetails: [
        {
          "id": "to-kill-a-mockingbird-editorial",
          "title": "Убить пересмешника",
          "coverUrl": "brand/book-covers/to-kill-a-mockingbird-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/to-kill-a-mockingbird-editorial.webp",
          "coverSourceUrl": "brand/book-covers/to-kill-a-mockingbird-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/to-kill-a-mockingbird-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Пойди, поставь сторожа"
      ],
      genres: [
        "роман",
        "социальная проза"
      ],
      language: "английский",
      nationality: "американка",
      awards: [
        "Пулитцеровская премия 1961 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Пулитцеровская премия"
      ],
      articleUrl: ""
    },
    {
      id: "jack_kerouac",
      name: "Джек Керуак",
      years: "1922-1969",
      birthDate: "1922-03-12",
      deathDate: "1969-10-21",
      birthPlace: "Лоуэлл, США",
      deathPlace: "Санкт-Петербург, США",
      coordinates: {
        lat: 42.6334,
        lng: -71.3162
      },
      portrait: "",
      bio: "Американский писатель и поэт, один из главных представителей движения битников.",
      works: [
        "На дороге",
        "Бродяги Дхармы"
      ],
      genres: [
        "роман",
        "автобиографическая проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "бит-поколение"
      ],
      articleUrl: ""
    },
        {
      id: "vladimir_nabokov",
      name: "Владимир Набоков",
      years: "1899-1977",
      birthDate: "1899-04-22",
      deathDate: "1977-07-02",
      birthPlace: "Санкт-Петербург, Российская империя",
      deathPlace: "Монтрё, Швейцария",
      coordinates: {
        lat: 59.9343,
        lng: 30.3351
      },
      portrait: "",
      bio: "Русско-американский писатель, поэт и литературовед, один из крупнейших мастеров прозы XX века.",
      workDetails: [
        {
          "id": "lolita-editorial",
          "title": "Лолита",
          "coverUrl": "brand/book-covers/lolita-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/lolita-editorial.webp",
          "coverSourceUrl": "brand/book-covers/lolita-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/lolita-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Дар",
        "Приглашение на казнь",
        "Защита Лужина"
      ],
      genres: [
        "роман",
        "модернизм",
        "литературная проза"
      ],
      language: "русский и английский",
      nationality: "русско-американский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "эмигрантская литература"
      ],
      articleUrl: ""
    },
    {
      id: "tony_morrison",
      name: "Тони Моррисон",
      years: "1931-2019",
      birthDate: "1931-02-18",
      deathDate: "2019-08-05",
      birthPlace: "Лорейн, США",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 41.4528,
        lng: -82.1824
      },
      portrait: "",
      bio: "Американская писательница, лауреат Нобелевской премии по литературе 1993 года, одна из крупнейших авторов современной американской литературы.",
      works: [
        "Песнь Соломона",
        "Самые голубые глаза"
      ],
      workDetails: [
        {
          id: "beloved",
          title: "Возлюбленная",
          originalTitle: "Beloved",
          firstPublished: 1987,
          originalLanguage: "английский",
          genres: ["роман", "историческая проза"],
          tags: ["память", "рабство", "семья", "травма"],
          description: "В центре романа - Сэти, бывшая рабыня, и травматическая память, преследующая её семью. Книга вышла в 1987 году и получила Пулитцеровскую премию за художественную литературу в 1988 году.",
          coverUrl: "brand/book-covers/beloved-editorial.webp",
          coverThumbnailUrl: "brand/book-covers/thumbs/beloved-editorial.webp",
          coverSourceUrl: "brand/book-covers/beloved-editorial.webp",
          coverRights: {
            status: "editorial-original",
            licenseName: "Редакционное оформление «Пробы Пера»",
            creator: "Редакция «Пробы Пера»",
            rightsHolder: "Проба Пера",
            sourceUrl: "brand/book-covers/beloved-editorial.webp",
            checkedAt: "2026-08-01",
            note: "Собственная художественная обложка сайта; не воспроизводит конкретное издательское оформление."
          },
          sourceUrl: "https://www.pulitzer.org/winners/toni-morrison",
          editorial: {
            status: "verified",
            reviewedAt: "2026-07-26"
          }
        }
      ],
      genres: [
        "роман",
        "социальная проза"
      ],
      language: "английский",
      nationality: "американка",
      awards: [
        "Нобелевская премия по литературе 1993 года",
        "Пулитцеровская премия 1988 года"
      ],
      relatedWriters: [
        "ralph_ellison"
      ],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "philip_roth",
      name: "Филип Рот",
      years: "1933-2018",
      birthDate: "1933-03-19",
      deathDate: "2018-05-22",
      birthPlace: "Ньюарк, США",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 40.7357,
        lng: -74.1724
      },
      portrait: "",
      bio: "Американский писатель, один из крупнейших романистов второй половины XX века.",
      works: [
        "Американская пастораль",
        "Людское клеймо",
        "Прощай, Коламбус"
      ],
      genres: [
        "роман",
        "социальная проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Пулитцеровская премия 1998 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "американский роман"
      ],
      articleUrl: ""
    },
    {
      id: "cormac_mccarthy",
      name: "Кормак Маккарти",
      years: "1933-2023",
      birthDate: "1933-07-20",
      deathDate: "2023-06-13",
      birthPlace: "Провиденс, США",
      deathPlace: "Санта-Фе, США",
      coordinates: {
        lat: 41.824,
        lng: -71.4128
      },
      portrait: "",
      bio: "Американский писатель, один из крупнейших представителей современной американской прозы.",
      works: [
        "Старикам тут не место",
        "Дорога",
        "Кровавый меридиан"
      ],
      genres: [
        "роман",
        "вестерн",
        "постапокалипсис"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Пулитцеровская премия 2007 года"
      ],
      relatedWriters: [],
      tags: [
        "XXI век",
        "современная литература"
      ],
      articleUrl: ""
    },
    {
      id: "don_delillo",
      name: "Дон Делилло",
      years: "1936-",
      birthDate: "1936-11-20",
      birthPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель, один из ведущих представителей постмодернизма.",
      works: [
        "Белый шум",
        "Подземный мир",
        "Весы"
      ],
      genres: [
        "постмодернизм",
        "роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [
        "philip_roth"
      ],
      tags: [
        "XX век",
        "постмодернизм"
      ],
      articleUrl: ""
    },
    {
      id: "paul_auster",
      name: "Пол Остер",
      years: "1947-2024",
      birthDate: "1947-02-03",
      deathDate: "2024-04-30",
      birthPlace: "Ньюарк, США",
      deathPlace: "Бруклин, США",
      coordinates: {
        lat: 40.7357,
        lng: -74.1724
      },
      portrait: "",
      bio: "Американский писатель, сценарист и переводчик, известный интеллектуальной прозой.",
      works: [
        "Нью-Йоркская трилогия",
        "Левиафан",
        "Книга иллюзий"
      ],
      genres: [
        "роман",
        "постмодернизм"
      ],
      language: "английский",
      nationality: "американец",
      awards: [],
      relatedWriters: [],
      tags: [
        "современная литература"
      ],
      articleUrl: ""
    },
    {
      id: "stephen_king",
      name: "Стивен Кинг",
      years: "1947-",
      birthDate: "1947-09-21",
      birthPlace: "Портленд, США",
      coordinates: {
        lat: 43.6591,
        lng: -70.2568
      },
      portrait: "",
      bio: "Американский писатель, один из самых популярных авторов современной литературы, мастер жанров ужасов и триллера.",
      works: [
        "Оно",
        "Сияние",
        "Зелёная миля",
        "Побег из Шоушенка"
      ],
      genres: [
        "ужасы",
        "триллер",
        "роман"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Медаль Национального фонда искусств США"
      ],
      relatedWriters: [],
      tags: [
        "современная литература",
        "хоррор"
      ],
      articleUrl: ""
    },
    {
      id: "bob_dylan",
      name: "Боб Дилан",
      years: "1941-",
      birthDate: "1941-05-24",
      birthPlace: "Дулут, США",
      coordinates: {
        lat: 46.7867,
        lng: -92.1005
      },
      portrait: "",
      bio: "Американский поэт, музыкант и автор песен, лауреат Нобелевской премии по литературе 2016 года.",
      works: [
        "Тексты песен",
        "Хроники"
      ],
      genres: [
        "поэзия",
        "песенная литература"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Нобелевская премия по литературе 2016 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "colson_whitehead",
      name: "Колсон Уайтхед",
      years: "1969-",
      birthDate: "1969-11-06",
      birthPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 40.7128,
        lng: -74.006
      },
      portrait: "",
      bio: "Американский писатель, дважды лауреат Пулитцеровской премии за художественную литературу.",
      works: [
        "Подземная железная дорога",
        "Мальчики из Никеля"
      ],
      genres: [
        "роман",
        "историческая проза"
      ],
      language: "английский",
      nationality: "американец",
      awards: [
        "Пулитцеровская премия 2017 года",
        "Пулитцеровская премия 2020 года"
      ],
      relatedWriters: [],
      tags: [
        "XXI век",
        "современная литература"
      ],
      articleUrl: ""
    }
  ]
};
