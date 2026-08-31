import type { Country } from "./types";
import { mergeRussianWriterExpansion } from "./russianWriterExpansion";

export const russia: Country = {
  id: "russia",
  name: "Россия",
  code: "ru",
  writers: mergeRussianWriterExpansion([
    {
      id: "nestor",
      name: "Нестор Летописец",
      years: "ок. 1056-1114",
      birthDate: "1056",
      deathDate: "1114",
      birthPlace: "Киевская Русь",
      deathPlace: "Киевская Русь",
      coordinates: {
        lat: 50.4501,
        lng: 30.5234
      },
      portrait: "",
      bio: "Монах Киево-Печерского монастыря, традиционно считающийся автором или одним из составителей «Повести временных лет» - важнейшего памятника древнерусской литературы.",
      works: [
        "Повесть временных лет"
      ],
      genres: [
        "летопись",
        "историческая литература"
      ],
      language: "древнерусский",
      nationality: "древнерусский книжник",
      awards: [],
      relatedWriters: [],
      tags: [
        "Древняя Русь",
        "летописание"
      ],
      articleUrl: ""
    },
    {
      id: "kirill-turovsky",
      name: "Кирилл Туровский",
      years: "ок. 1130-1182",
      birthDate: "1130",
      deathDate: "1182",
      birthPlace: "Туров, Киевская Русь",
      deathPlace: "Туров, Киевская Русь",
      coordinates: {
        lat: 52.0636,
        lng: 27.7356
      },
      portrait: "",
      bio: "Епископ Туровский, богослов, проповедник и один из крупнейших авторов древнерусской литературы XII века.",
      works: [
        "Слова Кирилла Туровского",
        "Молитвы",
        "Притчи"
      ],
      genres: [
        "проповедь",
        "богословская литература"
      ],
      language: "древнерусский",
      nationality: "древнерусский книжник",
      awards: [],
      relatedWriters: [],
      tags: [
        "Древняя Русь",
        "церковная литература"
      ],
      articleUrl: ""
    },
    {
      id: "avvakum",
      name: "Протопоп Аввакум Петров",
      years: "1620/1621-1682",
      birthDate: "1620",
      deathDate: "1682",
      birthPlace: "Григорово, Нижегородский край",
      deathPlace: "Пустозерск",
      coordinates: {
        lat: 55.4667,
        lng: 45.9333
      },
      portrait: "",
      bio: "Священник, писатель и один из лидеров старообрядческого движения. Автор знаменитого «Жития протопопа Аввакума», одного из первых произведений русской автобиографической прозы.",
      works: [
        "Житие протопопа Аввакума"
      ],
      genres: [
        "автобиография",
        "житие"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "старообрядчество",
        "древнерусская литература"
      ],
      articleUrl: ""
    },
    {
      id: "kantemir",
      name: "Антиох Дмитриевич Кантемир",
      years: "1708-1744",
      birthDate: "1708-09-10",
      deathDate: "1744-03-31",
      birthPlace: "Константинополь",
      deathPlace: "Париж",
      coordinates: {
        lat: 41.0082,
        lng: 28.9784
      },
      portrait: "",
      bio: "Русский поэт, переводчик и дипломат, один из основателей русской светской сатиры XVIII века.",
      works: [
        "Сатиры"
      ],
      genres: [
        "сатира",
        "поэзия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "классицизм"
      ],
      articleUrl: ""
    },
    {
      id: "trediakovsky",
      name: "Василий Кириллович Тредиаковский",
      years: "1703-1769",
      birthDate: "1703-03-22",
      deathDate: "1769-08-06",
      birthPlace: "Астрахань",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 46.3497,
        lng: 48.0408
      },
      portrait: "",
      bio: "Русский поэт, переводчик и филолог, один из реформаторов русского стихосложения XVIII века.",
      works: [
        "Езда в остров любви",
        "Телемахида"
      ],
      genres: [
        "поэзия",
        "перевод"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "классицизм"
      ],
      articleUrl: ""
    },
    {
      id: "lomonosov",
      name: "Михаил Васильевич Ломоносов",
      years: "1711-1765",
      birthDate: "1711-11-19",
      deathDate: "1765-04-15",
      birthPlace: "Мишанинская, Архангелогородская губерния",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 64.4165,
        lng: 40.8122
      },
      portrait: "",
      bio: "Русский учёный, поэт и реформатор русского литературного языка. Один из крупнейших представителей русского классицизма.",
      works: [
        "Ода на день восшествия на престол Елисаветы Петровны",
        "Российская грамматика"
      ],
      genres: [
        "ода",
        "научная литература",
        "поэзия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "классицизм"
      ],
      articleUrl: ""
    },
        {
      id: "derzhavin",
      name: "Гавриил Романович Державин",
      years: "1743-1816",
      birthDate: "1743-07-14",
      deathDate: "1816-07-20",
      birthPlace: "Казань, Российская империя",
      deathPlace: "Званка, Новгородская губерния",
      coordinates: {
        lat: 55.7963,
        lng: 49.1088
      },
      portrait: "",
      bio: "Русский поэт эпохи классицизма, государственный деятель, один из крупнейших русских поэтов XVIII века.",
      works: [
        "Фелица",
        "Водопад",
        "Бог"
      ],
      genres: [
        "ода",
        "лирика"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "классицизм"
      ],
      articleUrl: ""
    },
    {
      id: "fonvizin",
      name: "Денис Иванович Фонвизин",
      years: "1745-1792",
      birthDate: "1745-04-14",
      deathDate: "1792-12-01",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русский писатель и драматург эпохи Просвещения, автор одной из самых известных русских комедий XVIII века.",
      works: [
        "Недоросль",
        "Бригадир"
      ],
      genres: [
        "комедия",
        "драматургия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "Просвещение"
      ],
      articleUrl: ""
    },
    {
      id: "karamzin",
      name: "Николай Михайлович Карамзин",
      years: "1766-1826",
      birthDate: "1766-12-12",
      deathDate: "1826-06-03",
      birthPlace: "Михайловка, Симбирская губерния",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 54.3142,
        lng: 48.4031
      },
      portrait: "",
      bio: "Русский писатель, историк и журналист, один из крупнейших представителей русского сентиментализма.",
      works: [
        "Бедная Лиза",
        "История государства Российского"
      ],
      genres: [
        "сентиментализм",
        "история",
        "проза"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XVIII век",
        "сентиментализм"
      ],
      articleUrl: ""
    },
    {
      id: "zhukovsky",
      name: "Василий Андреевич Жуковский",
      years: "1783-1852",
      birthDate: "1783-02-09",
      deathDate: "1852-04-24",
      birthPlace: "Мишенское, Тульская губерния",
      deathPlace: "Баден-Баден",
      coordinates: {
        lat: 53.9785,
        lng: 37.5275
      },
      portrait: "",
      bio: "Русский поэт, переводчик и литературный наставник. Один из основоположников русского романтизма.",
      works: [
        "Светлана",
        "Людмила",
        "Эолова арфа"
      ],
      genres: [
        "романтизм",
        "баллада",
        "лирика"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [
        "pushkin"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "batushkov",
      name: "Константин Николаевич Батюшков",
      years: "1787-1855",
      birthDate: "1787-05-29",
      deathDate: "1855-07-19",
      birthPlace: "Вологда, Российская империя",
      deathPlace: "Вологда",
      coordinates: {
        lat: 59.2205,
        lng: 39.8915
      },
      portrait: "",
      bio: "Русский поэт эпохи романтизма, оказавший влияние на развитие русской лирической поэзии.",
      works: [
        "Мои пенаты",
        "Воспоминания о Царском Селе"
      ],
      genres: [
        "романтизм",
        "лирика"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [
        "zhukovsky",
        "pushkin"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "krylov",
      name: "Иван Андреевич Крылов",
      years: "1769-1844",
      birthDate: "1769-02-13",
      deathDate: "1844-11-21",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русский баснописец, поэт и драматург. Его басни стали частью русской литературной традиции.",
      works: [
        "Ворона и Лисица",
        "Стрекоза и Муравей",
        "Лебедь, Щука и Рак"
      ],
      genres: [
        "басня",
        "сатира"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "басня"
      ],
      articleUrl: ""
    },
    {
      id: "griboedov",
      name: "Александр Сергеевич Грибоедов",
      years: "1795-1829",
      birthDate: "1795-01-15",
      deathDate: "1829-02-11",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Тегеран",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русский драматург, поэт, дипломат и композитор. Автор бессмертной комедии «Горе от ума».",
      works: [
        "Горе от ума"
      ],
      genres: [
        "комедия",
        "драматургия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [
        "pushkin"
      ],
      tags: [
        "XIX век",
        "драматургия"
      ],
      articleUrl: ""
    },
    {
      id: "pushkin",
      name: "Александр Сергеевич Пушкин",
      years: "1799-1837",
      birthDate: "1799-06-06",
      deathDate: "1837-02-10",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Великий русский поэт, драматург и прозаик, основоположник современного русского литературного языка.",
      workDetails: [
        {
          "id": "eugene-onegin-editorial",
          "title": "Евгений Онегин",
          "coverUrl": "brand/book-covers/eugene-onegin-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/eugene-onegin-editorial.webp",
          "coverSourceUrl": "brand/book-covers/eugene-onegin-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/eugene-onegin-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        },
        {
          "id": "the-captains-daughter-editorial",
          "title": "Капитанская дочка",
          "coverUrl": "brand/book-covers/the-captains-daughter-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-captains-daughter-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-captains-daughter-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-captains-daughter-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Борис Годунов",
        "Повести Белкина"
      ],
      genres: [
        "поэзия",
        "роман",
        "драма"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [
        "zhukovsky",
        "griboedov"
      ],
      tags: [
        "Золотой век русской литературы",
        "романтизм",
        "реализм"
      ],
      articleUrl: ""
    },
        {
      id: "lermontov",
      name: "Михаил Юрьевич Лермонтов",
      years: "1814-1841",
      birthDate: "1814-10-15",
      deathDate: "1841-07-27",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Пятигорск, Российская империя",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русский поэт, прозаик и драматург, один из крупнейших представителей русского романтизма.",
      workDetails: [
        {
          "id": "a-hero-of-our-time-editorial",
          "title": "Герой нашего времени",
          "coverUrl": "brand/book-covers/a-hero-of-our-time-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/a-hero-of-our-time-editorial.webp",
          "coverSourceUrl": "brand/book-covers/a-hero-of-our-time-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/a-hero-of-our-time-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Мцыри",
        "Демон",
        "Бородино"
      ],
      genres: [
        "романтизм",
        "поэзия",
        "проза"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [
        "pushkin"
      ],
      tags: [
        "XIX век",
        "романтизм"
      ],
      articleUrl: ""
    },
    {
      id: "gogol",
      name: "Николай Васильевич Гоголь",
      years: "1809-1852",
      birthDate: "1809-04-01",
      deathDate: "1852-02-21",
      birthPlace: "Великие Сорочинцы, Полтавская губерния",
      deathPlace: "Москва",
      coordinates: {
        lat: 50.0258,
        lng: 33.9422
      },
      portrait: "",
      bio: "Русский писатель, драматург и публицист, один из основателей русской реалистической прозы.",
      works: [
        "Мёртвые души",
        "Ревизор",
        "Шинель",
        "Вечера на хуторе близ Диканьки"
      ],
      genres: [
        "реализм",
        "сатира",
        "повесть"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [
        "pushkin"
      ],
      tags: [
        "XIX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "turgenev",
      name: "Иван Сергеевич Тургенев",
      years: "1818-1883",
      birthDate: "1818-11-09",
      deathDate: "1883-09-03",
      birthPlace: "Орел, Российская империя",
      deathPlace: "Буживаль, Франция",
      coordinates: {
        lat: 52.9685,
        lng: 36.0696
      },
      portrait: "",
      bio: "Русский писатель, поэт и драматург, один из крупнейших представителей русского реализма XIX века.",
      works: [
        "Дворянское гнездо",
        "Записки охотника",
        "Муму"
      ],
      workDetails: [
        {
          id: "fathers-and-sons",
          title: "Отцы и дети",
          firstPublished: 1862,
          originalLanguage: "русский",
          genres: [
            "роман",
            "реализм"
          ],
          tags: [
            "поколения",
            "нигилизм",
            "семья",
            "Россия XIX века"
          ],
          description: "Роман о столкновении поколений и мировоззрений в России накануне великих общественных перемен. В центре повествования - Евгений Базаров, чья уверенность в отрицании всех авторитетов проходит испытание дружбой, любовью и самой жизнью.",
          coverUrl: "brand/book-covers/fathers-and-sons-editorial.webp",
          coverThumbnailUrl: "brand/book-covers/thumbs/fathers-and-sons-editorial.webp",
          coverSourceUrl: "brand/book-covers/fathers-and-sons-editorial.webp",
          coverRights: {
            status: "editorial-original",
            licenseName: "Редакционное оформление «Пробы Пера»",
            creator: "Редакция «Пробы Пера»",
            rightsHolder: "Проба Пера",
            sourceUrl: "brand/book-covers/fathers-and-sons-editorial.webp",
            checkedAt: "2026-08-01",
            note: "Собственная художественная обложка сайта; не является воспроизведением конкретного издательского тиража."
          },
          sourceUrl: "https://www.culture.ru/materials/258142/otcy-i-deti-glavnoe-o-romane",
          editorial: {
            status: "verified",
            reviewedAt: "2026-08-01"
          }
        }
      ],
      genres: [
        "реализм",
        "роман",
        "повесть"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "goncharov",
      name: "Иван Александрович Гончаров",
      years: "1812-1891",
      birthDate: "1812-06-18",
      deathDate: "1891-09-27",
      birthPlace: "Симбирск, Российская империя",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 54.3142,
        lng: 48.4031
      },
      portrait: "",
      bio: "Русский писатель и литературный критик, автор одного из главных романов русской литературы XIX века.",
      workDetails: [
        {
          "id": "oblomov-editorial",
          "title": "Обломов",
          "coverUrl": "brand/book-covers/oblomov-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/oblomov-editorial.webp",
          "coverSourceUrl": "brand/book-covers/oblomov-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/oblomov-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Обыкновенная история",
        "Обрыв"
      ],
      genres: [
        "реализм",
        "роман"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "ostrovsky",
      name: "Александр Николаевич Островский",
      years: "1823-1886",
      birthDate: "1823-04-12",
      deathDate: "1886-06-14",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Щелыково, Костромская губерния",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русский драматург, основатель национального репертуара русского театра.",
      works: [
        "Гроза",
        "Бесприданница",
        "Свои люди - сочтёмся!"
      ],
      genres: [
        "драма",
        "комедия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "драматургия"
      ],
      articleUrl: ""
    },
    {
      id: "nekrasov",
      name: "Николай Алексеевич Некрасов",
      years: "1821-1878",
      birthDate: "1821-12-10",
      deathDate: "1878-01-08",
      birthPlace: "Немиров, Подольская губерния",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 48.967,
        lng: 28.846
      },
      portrait: "",
      bio: "Русский поэт, издатель и общественный деятель, редактор журнала «Современник».",
      works: [
        "Кому на Руси жить хорошо",
        "Русские женщины",
        "Мороз, Красный нос"
      ],
      genres: [
        "поэзия",
        "гражданская лирика"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "dostoevsky",
      name: "Фёдор Михайлович Достоевский",
      years: "1821-1881",
      birthDate: "1821-11-11",
      deathDate: "1881-02-09",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "assets/writer-portraits/q991.webp",
      portraitAlt: "Фёдор Михайлович Достоевский, фотография В. Я. Лауфферта, 1872 год",
      portraitSourceUrl: "https://commons.wikimedia.org/wiki/File:Fyodor_Dostoyevsky_(Laufert,_1872).jpg",
      portraitRights: {
        status: "public-domain",
        licenseName: "Public Domain Mark 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
        creator: "В. Я. Лауфферт",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Fyodor_Dostoyevsky_(Laufert,_1872).jpg",
        checkedAt: "2026-08-02"
      },
      bio: "Фёдор Достоевский пришёл в литературу как внимательный исследователь человека, оказавшегося перед нравственным выбором. После ареста по делу петрашевцев, инсценировки казни, каторги и ссылки его проза стала особенно напряжённым разговором о свободе, вере, вине и сострадании. В больших романах писателя сталкиваются не готовые ответы, а самостоятельные голоса героев - поэтому «Преступление и наказание», «Идиот» и «Братья Карамазовы» продолжают звучать современно и влиять на литературу, театр, философию и психологию.",
      works: [
        "Идиот",
      ],
      workDetails: [
        {
          id: "crime-and-punishment",
          title: "Преступление и наказание",
          originalTitle: "Преступление и наказание",
          firstPublished: 1866,
          originalLanguage: "русский",
          genres: ["роман", "психологическая проза"],
          tags: ["вина", "нравственный выбор", "Петербург", "реализм"],
          description: "Роман о преступлении, самообмане и трудном возвращении к человеческой связи. Впервые публиковался по частям в журнале «Русский вестник» в 1866 году.",
          coverUrl: "brand/book-covers/crime-and-punishment-editorial.webp",
          coverThumbnailUrl: "brand/book-covers/thumbs/crime-and-punishment-editorial.webp",
          coverSourceUrl: "brand/book-covers/crime-and-punishment-editorial.webp",
          coverRights: {
            status: "editorial-original",
            licenseName: "Редакционное оформление «Пробы Пера»",
            creator: "Редакция «Пробы Пера»",
            rightsHolder: "Проба Пера",
            sourceUrl: "brand/book-covers/crime-and-punishment-editorial.webp",
            checkedAt: "2026-08-01",
            note: "Собственная художественная обложка сайта; не воспроизводит конкретное издательское оформление."
          },
          sourceUrl: "https://fedordostoevsky.ru/works/lifetime/crime/",
          editorial: {
            status: "verified",
            reviewedAt: "2026-07-26"
          }
        }
      ,
        {
          "id": "the-brothers-karamazov-editorial",
          "title": "Братья Карамазовы",
          "coverUrl": "brand/book-covers/the-brothers-karamazov-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-brothers-karamazov-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-brothers-karamazov-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-brothers-karamazov-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        },
        {
          "id": "demons-editorial",
          "title": "Бесы",
          "coverUrl": "brand/book-covers/demons-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/demons-editorial.webp",
          "coverSourceUrl": "brand/book-covers/demons-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/demons-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      genres: [
        "роман",
        "психологическая проза",
        "философская литература"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм"
      ],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-26",
        sources: [
          {
            title: "Фотоархив и биографические материалы Ф. М. Достоевского",
            url: "https://fedordostoevsky.ru/",
            publisher: "Музей Достоевского"
          }
        ]
      },
      articleUrl: ""
    },
    {
      id: "tolstoy",
      name: "Лев Николаевич Толстой",
      years: "1828-1910",
      birthDate: "1828-09-09",
      deathDate: "1910-11-20",
      birthPlace: "Ясная Поляна, Тульская губерния",
      deathPlace: "Астапово, Рязанская губерния",
      coordinates: {
        lat: 54.0746,
        lng: 37.5282
      },
      portrait: "assets/writer-portraits/q7243.webp",
      portraitAlt: "Лев Николаевич Толстой, фотография 1897 года или ранее",
      portraitSourceUrl: "https://commons.wikimedia.org/wiki/File:Leo_Tolstoj.jpg",
      portraitRights: {
        status: "public-domain",
        licenseName: "Public Domain Mark 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
        creator: "Неизвестный фотограф",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Leo_Tolstoj.jpg",
        checkedAt: "2026-08-02"
      },
      bio: "Лев Толстой превратил семейную хронику и исторический роман в масштабное исследование человеческой жизни. В «Войне и мире» частная судьба существует внутри движения истории, а в «Анне Карениной» общественный порядок раскрывается через любовь, одиночество и цену личного выбора. После духовного кризиса писатель всё чаще обращался к вопросам веры, непротивления насилию и нравственной ответственности. Его художественная точность, внимание к внутренней речи и способность видеть человека в постоянном изменении повлияли на прозу всего XX века.",
      works: [
        "Воскресение",
        "Смерть Ивана Ильича"
      ],
      workDetails: [
        {
          id: "war-and-peace",
          title: "Война и мир",
          originalTitle: "Война и мир",
          firstPublished: 1869,
          originalLanguage: "русский",
          genres: ["роман-эпопея", "исторический роман"],
          tags: ["наполеоновские войны", "семья", "история", "реализм"],
          description: "Роман-эпопея, в котором судьбы семей Ростовых, Болконских, Курагиных и Безухова разворачиваются на фоне войн с Наполеоном. Толстой соединяет семейную хронику, историческое повествование и философские размышления о свободе, необходимости и роли личности в истории. Отдельное книжное издание в шести томах вышло в 1868-1869 годах.",
          coverUrl: "brand/book-covers/war-and-peace-editorial.webp",
          coverThumbnailUrl: "brand/book-covers/thumbs/war-and-peace-editorial.webp",
          coverSourceUrl: "brand/book-covers/war-and-peace-editorial.webp",
          coverRights: {
            status: "editorial-original",
            licenseName: "Редакционное оформление «Пробы Пера»",
            creator: "Редакция «Пробы Пера»",
            rightsHolder: "Проба Пера",
            sourceUrl: "brand/book-covers/war-and-peace-editorial.webp",
            checkedAt: "2026-08-01",
            note: "Собственная художественная обложка сайта; не воспроизводит конкретное издательское оформление."
          },
          sourceUrl: "https://tolstoy.ru/creativity/90-volume-collection-of-the-works/",
          editorial: {
            status: "verified",
            reviewedAt: "2026-07-26"
          }
        }
      ,
        {
          "id": "anna-karenina-editorial",
          "title": "Анна Каренина",
          "coverUrl": "brand/book-covers/anna-karenina-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/anna-karenina-editorial.webp",
          "coverSourceUrl": "brand/book-covers/anna-karenina-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/anna-karenina-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      genres: [
        "реализм",
        "роман",
        "повесть"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм",
        "мировая литература"
      ],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-26",
        sources: [
          {
            title: "Лев Толстой: музейные и биографические материалы",
            url: "https://tolstoymuseum.ru/",
            publisher: "Государственный музей Л. Н. Толстого"
          }
        ]
      },
      articleUrl: ""
    },
        {
      id: "chekhov",
      name: "Антон Павлович Чехов",
      years: "1860-1904",
      birthDate: "1860-01-29",
      deathDate: "1904-07-15",
      birthPlace: "Таганрог, Российская империя",
      deathPlace: "Баденвейлер, Германия",
      coordinates: {
        lat: 47.2362,
        lng: 38.8969
      },
      portrait: "assets/writer-portraits/q5682.webp",
      portraitAlt: "Антон Павлович Чехов, портрет работы Осипа Браза, 1898 год",
      portraitSourceUrl: "https://commons.wikimedia.org/wiki/File:Chekhov_1898_by_Osip_Braz.jpg",
      portraitRights: {
        status: "public-domain",
        licenseName: "Public Domain Mark 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
        creator: "Осип Эммануилович Браз",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Chekhov_1898_by_Osip_Braz.jpg",
        checkedAt: "2026-08-02"
      },
      bio: "Антон Чехов совмещал литературу с медициной и смотрел на человека без назидательности, но с редкой точностью и сочувствием. Он обновил короткий рассказ, научив его говорить через паузы, детали и недосказанность, а пьесы «Чайка», «Три сестры» и «Вишнёвый сад» изменили язык мирового театра. В Мелихове Чехов не только написал десятки произведений, но и бесплатно лечил крестьян, участвовал в борьбе с холерой и строил школы. За внешней простотой его прозы всегда скрывается сложная жизнь, в которой смешное соседствует с тревожным и трагическим.",
      works: [
        "Три сестры",
        "Чайка",
        "Палата № 6"
      ],
      workDetails: [
        {
          id: "the-cherry-orchard",
          title: "Вишнёвый сад",
          firstPublished: 1904,
          originalLanguage: "русский",
          genres: [
            "пьеса",
            "комедия"
          ],
          tags: [
            "память",
            "перемены",
            "дворянская усадьба",
            "русский театр"
          ],
          description: "Последняя пьеса Чехова о семье, которая возвращается в родовое имение накануне его продажи. За будничными разговорами и комическими паузами раскрывается болезненный разрыв между прошлым, настоящим и ещё не наступившим будущим.",
          coverUrl: "brand/book-covers/cherry-orchard-editorial.webp",
          coverThumbnailUrl: "brand/book-covers/thumbs/cherry-orchard-editorial.webp",
          coverSourceUrl: "brand/book-covers/cherry-orchard-editorial.webp",
          coverRights: {
            status: "editorial-original",
            licenseName: "Редакционное оформление «Пробы Пера»",
            creator: "Редакция «Пробы Пера»",
            rightsHolder: "Проба Пера",
            sourceUrl: "brand/book-covers/cherry-orchard-editorial.webp",
            checkedAt: "2026-08-01",
            note: "Собственная художественная обложка сайта; не является воспроизведением конкретного издательского тиража."
          },
          sourceUrl: "https://www.culture.ru/materials/253776/kak-chitat-vishnevyi-sad-chekhova",
          editorial: {
            status: "verified",
            reviewedAt: "2026-08-01"
          }
        }
      ],
      genres: [
        "рассказ",
        "драма",
        "реализм"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм",
        "драматургия"
      ],
      editorial: {
        status: "verified",
        reviewedAt: "2026-07-26",
        sources: [
          {
            title: "Чеховское Мелихово - история и музейные материалы",
            url: "https://chekhovmuseum.com/museum/about/history",
            publisher: "Музей-заповедник А. П. Чехова «Мелихово»"
          }
        ]
      },
      articleUrl: ""
    },
    {
      id: "leskov",
      name: "Николай Семёнович Лесков",
      years: "1831-1895",
      birthDate: "1831-02-04",
      deathDate: "1895-03-05",
      birthPlace: "Орловская губерния",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 52.9685,
        lng: 36.0696
      },
      portrait: "",
      bio: "Русский писатель и публицист, известный произведениями о народной жизни и самобытных характерах.",
      works: [
        "Левша",
        "Очарованный странник",
        "Леди Макбет Мценского уезда"
      ],
      genres: [
        "повесть",
        "рассказ",
        "реализм"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "реализм"
      ],
      articleUrl: ""
    },
    {
      id: "saltykov-shchedrin",
      name: "Михаил Евграфович Салтыков-Щедрин",
      years: "1826-1889",
      birthDate: "1826-01-27",
      deathDate: "1889-05-10",
      birthPlace: "Спас-Угол, Тверская губерния",
      deathPlace: "Санкт-Петербург",
      coordinates: {
        lat: 56.0,
        lng: 37.0
      },
      portrait: "",
      bio: "Русский писатель-сатирик, публицист и государственный деятель.",
      works: [
        "История одного города",
        "Господа Головлёвы",
        "Пошехонская старина"
      ],
      genres: [
        "сатира",
        "роман",
        "реализм"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XIX век",
        "сатира"
      ],
      articleUrl: ""
    },
    {
      id: "buninin",
      name: "Иван Алексеевич Бунин",
      years: "1870-1953",
      birthDate: "1870-10-22",
      deathDate: "1953-11-08",
      birthPlace: "Воронеж, Российская империя",
      deathPlace: "Париж, Франция",
      coordinates: {
        lat: 51.6608,
        lng: 39.2003
      },
      portrait: "",
      bio: "Русский писатель и поэт, первый русский лауреат Нобелевской премии по литературе (1933).",
      works: [
        "Жизнь Арсеньева",
        "Господин из Сан-Франциско",
        "Тёмные аллеи"
      ],
      genres: [
        "проза",
        "поэзия",
        "реализм"
      ],
      language: "русский",
      nationality: "русский",
      awards: [
        "Нобелевская премия по литературе 1933 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "blok",
      name: "Александр Александрович Блок",
      years: "1880-1921",
      birthDate: "1880-11-28",
      deathDate: "1921-08-07",
      birthPlace: "Санкт-Петербург",
      deathPlace: "Петроград",
      coordinates: {
        lat: 59.9311,
        lng: 30.3609
      },
      portrait: "",
      bio: "Русский поэт Серебряного века, один из крупнейших представителей символизма.",
      works: [
        "Двенадцать",
        "Незнакомка",
        "Стихи о Прекрасной Даме"
      ],
      genres: [
        "символизм",
        "поэзия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "Серебряный век",
        "символизм"
      ],
      articleUrl: ""
    },
    {
      id: "akhmatova",
      name: "Анна Андреевна Ахматова",
      years: "1889-1966",
      birthDate: "1889-06-23",
      deathDate: "1966-03-05",
      birthPlace: "Большой Фонтан, Российская империя",
      deathPlace: "Домодедово, СССР",
      coordinates: {
        lat: 46.4333,
        lng: 30.7667
      },
      portrait: "",
      bio: "Русская поэтесса Серебряного века, одна из крупнейших фигур русской поэзии XX века.",
      works: [
        "Реквием",
        "Вечер",
        "Чётки"
      ],
      genres: [
        "поэзия",
        "акмеизм"
      ],
      language: "русский",
      nationality: "русская",
      awards: [],
      relatedWriters: [],
      tags: [
        "Серебряный век",
        "акмеизм"
      ],
      articleUrl: ""
    },
    {
      id: "bulgakov",
      name: "Михаил Афанасьевич Булгаков",
      years: "1891-1940",
      birthDate: "1891-05-15",
      deathDate: "1940-03-10",
      birthPlace: "Киев, Российская империя",
      deathPlace: "Москва, СССР",
      coordinates: {
        lat: 50.4501,
        lng: 30.5234
      },
      portrait: "",
      bio: "Русский писатель и драматург, автор одного из самых известных романов XX века.",
      works: [
      ],
      workDetails: [
        {
          id: "master-and-margarita",
          title: "Мастер и Маргарита",
          originalTitle: "Мастер и Маргарита",
          firstPublished: 1967,
          originalLanguage: "русский",
          genres: ["роман", "фантастика", "сатира"],
          tags: ["Москва", "Понтий Пилат", "творчество", "свобода"],
          description: "Главный роман Михаила Булгакова, над которым писатель работал в 1928-1940 годах. Первая журнальная публикация состоялась посмертно, с купюрами, в 1966-1967 годах.",
          coverUrl: "https://covers.openlibrary.org/b/id/15013644-L.jpg",
          coverSourceUrl: "https://openlibrary.org/works/OL36999384W",
          coverRights: {
            status: "external-preview",
            sourceUrl: "https://openlibrary.org/works/OL36999384W",
            checkedAt: "2026-07-26",
            note: "Внешнее превью Open Library; файл не хранится в проекте."
          },
          sourceUrl: "https://bulgakovmuseum.ru/",
          editorial: {
            status: "reviewed",
            reviewedAt: "2026-07-26"
          }
        }
      ,
        {
          "id": "the-white-guard-editorial",
          "title": "Белая гвардия",
          "coverUrl": "brand/book-covers/the-white-guard-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/the-white-guard-editorial.webp",
          "coverSourceUrl": "brand/book-covers/the-white-guard-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/the-white-guard-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        },
        {
          "id": "heart-of-a-dog-editorial",
          "title": "Собачье сердце",
          "coverUrl": "brand/book-covers/heart-of-a-dog-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/heart-of-a-dog-editorial.webp",
          "coverSourceUrl": "brand/book-covers/heart-of-a-dog-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/heart-of-a-dog-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      genres: [
        "роман",
        "сатира",
        "фантастика"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "модернизм"
      ],
      articleUrl: ""
    },
    {
      id: "solzhenitsyn",
      name: "Александр Исаевич Солженицын",
      years: "1918-2008",
      birthDate: "1918-12-11",
      deathDate: "2008-08-03",
      birthPlace: "Кисловодск, Россия",
      deathPlace: "Москва, Россия",
      coordinates: {
        lat: 43.9051,
        lng: 42.7169
      },
      portrait: "",
      bio: "Русский писатель, историк и общественный деятель, лауреат Нобелевской премии по литературе 1970 года.",
      works: [
        "Архипелаг ГУЛАГ",
        "Один день Ивана Денисовича",
        "Раковый корпус"
      ],
      genres: [
        "роман",
        "документальная проза"
      ],
      language: "русский",
      nationality: "русский",
      awards: [
        "Нобелевская премия по литературе 1970 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
  id: "esenin",
  name: "Сергей Александрович Есенин",
      years: "1895-1925",
      birthDate: "1895-09-21",
      deathDate: "1925-12-28",
      birthPlace: "Константиново, Рязанская губерния",
      deathPlace: "Ленинград, СССР",
      coordinates: {
        lat: 54.9048,
        lng: 39.5108
      },
      portrait: "",
      bio: "Русский поэт, один из крупнейших представителей русской поэзии XX века, известный лирикой о природе, родине и человеке.",
      works: [
        "Анна Снегина",
        "Письмо к женщине",
        "Чёрный человек"
      ],
      genres: [
        "поэзия",
        "лирика"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "Серебряный век",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "tsvetaeva",
      name: "Марина Ивановна Цветаева",
      years: "1892-1941",
      birthDate: "1892-10-08",
      deathDate: "1941-08-31",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Елабуга, СССР",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русская поэтесса Серебряного века, одна из крупнейших фигур мировой поэзии XX века.",
      works: [
        "Поэма Горы",
        "Поэма Конца",
        "Лебединый стан"
      ],
      genres: [
        "поэзия",
        "лирика"
      ],
      language: "русский",
      nationality: "русская",
      awards: [],
      relatedWriters: [],
      tags: [
        "Серебряный век",
        "поэзия"
      ],
      articleUrl: ""
    },
    {
      id: "mandelstam",
      name: "Осип Эмильевич Мандельштам",
      years: "1891-1938",
      birthDate: "1891-01-15",
      deathDate: "1938-12-27",
      birthPlace: "Варшава, Российская империя",
      deathPlace: "пересыльный лагерь под Владивостоком",
      coordinates: {
        lat: 52.2297,
        lng: 21.0122
      },
      portrait: "",
      bio: "Русский поэт и прозаик, один из крупнейших представителей акмеизма.",
      works: [
        "Камень",
        "Стихотворения"
      ],
      genres: [
        "поэзия",
        "акмеизм"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "Серебряный век",
        "акмеизм"
      ],
      articleUrl: ""
    },
    {
      id: "pasternak",
      name: "Борис Леонидович Пастернак",
      years: "1890-1960",
      birthDate: "1890-01-29",
      deathDate: "1960-05-30",
      birthPlace: "Москва, Российская империя",
      deathPlace: "Переделкино, СССР",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Русский поэт и писатель, лауреат Нобелевской премии по литературе 1958 года.",
      workDetails: [
        {
          "id": "doctor-zhivago-editorial",
          "title": "Доктор Живаго",
          "coverUrl": "brand/book-covers/doctor-zhivago-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/doctor-zhivago-editorial.webp",
          "coverSourceUrl": "brand/book-covers/doctor-zhivago-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/doctor-zhivago-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Сестра моя - жизнь"
      ],
      genres: [
        "роман",
        "поэзия"
      ],
      language: "русский",
      nationality: "русский",
      awards: [
        "Нобелевская премия по литературе 1958 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "nabrakov",
      name: "Владимир Владимирович Набоков",
      years: "1899-1977",
      birthDate: "1899-04-22",
      deathDate: "1977-07-02",
      birthPlace: "Санкт-Петербург, Российская империя",
      deathPlace: "Монтрё, Швейцария",
      coordinates: {
        lat: 59.9311,
        lng: 30.3609
      },
      portrait: "",
      bio: "Русский и американский писатель, известный романами на русском и английском языках.",
      works: [
        "Лолита",
        "Дар",
        "Защита Лужина"
      ],
      genres: [
        "роман",
        "модернизм"
      ],
      language: "русский, английский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "XX век",
        "русское зарубежье"
      ],
      articleUrl: ""
    },
    {
      id: "sholokhov",
      name: "Михаил Александрович Шолохов",
      years: "1905-1984",
      birthDate: "1905-05-24",
      deathDate: "1984-02-21",
      birthPlace: "Кружилинский, Российская империя",
      deathPlace: "Вёшенская, СССР",
      coordinates: {
        lat: 49.8747,
        lng: 41.7347
      },
      portrait: "",
      bio: "Русский советский писатель, лауреат Нобелевской премии по литературе 1965 года.",
      workDetails: [
        {
          "id": "and-quiet-flows-the-don-editorial",
          "title": "Тихий Дон",
          "coverUrl": "brand/book-covers/and-quiet-flows-the-don-editorial.webp",
          "coverThumbnailUrl": "brand/book-covers/thumbs/and-quiet-flows-the-don-editorial.webp",
          "coverSourceUrl": "brand/book-covers/and-quiet-flows-the-don-editorial.webp",
          "coverRights": {
            "status": "editorial-original",
            "licenseName": "Редакционное оформление «Пробы Пера»",
            "creator": "Редакция «Пробы Пера»",
            "rightsHolder": "Проба Пера",
            "sourceUrl": "brand/book-covers/and-quiet-flows-the-don-editorial.webp",
            "checkedAt": "2026-08-02",
            "note": "Собственное редакционное оформление; не является обложкой конкретного издательского издания."
          },
          "editorial": {
            "status": "draft"
          }
        }
      ],
      works: [
        "Поднятая целина"
      ],
      genres: [
        "роман",
        "эпос"
      ],
      language: "русский",
      nationality: "русский",
      awards: [
        "Нобелевская премия по литературе 1965 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "brodsky",
      name: "Иосиф Александрович Бродский",
      years: "1940-1996",
      birthDate: "1940-05-24",
      deathDate: "1996-01-28",
      birthPlace: "Ленинград, СССР",
      deathPlace: "Нью-Йорк, США",
      coordinates: {
        lat: 59.9311,
        lng: 30.3609
      },
      portrait: "",
      bio: "Русский и американский поэт, эссеист, лауреат Нобелевской премии по литературе 1987 года.",
      works: [
        "Часть речи",
        "Остановка в пустыне"
      ],
      genres: [
        "поэзия",
        "эссе"
      ],
      language: "русский, английский",
      nationality: "русский",
      awards: [
        "Нобелевская премия по литературе 1987 года"
      ],
      relatedWriters: [],
      tags: [
        "XX век",
        "Нобелевская премия"
      ],
      articleUrl: ""
    },
    {
      id: "pelevin",
      name: "Виктор Олегович Пелевин",
      years: "1962-",
      birthDate: "1962-11-22",
      birthPlace: "Москва, СССР",
      coordinates: {
        lat: 55.7558,
        lng: 37.6173
      },
      portrait: "",
      bio: "Современный русский писатель, один из наиболее известных представителей постмодернизма.",
      works: [
        "Generation «П»",
        "Чапаев и Пустота",
        "S.N.U.F.F."
      ],
      genres: [
        "роман",
        "постмодернизм"
      ],
      language: "русский",
      nationality: "русский",
      awards: [],
      relatedWriters: [],
      tags: [
        "современная литература",
        "постмодернизм"
      ],
      articleUrl: ""
    }
  ])
};
