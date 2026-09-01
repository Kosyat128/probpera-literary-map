import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getCountrySiteCopy, getSiteCopy } from "../data/cms/siteCopy";

export type InterfaceLanguage = "ru" | "en";

const STORAGE_KEY = "probpera-interface-language";
const EVENT_NAME = "probpera:interface-language";
const observedInterfaceSourceText = new Set<string>();

export function isObservedInterfaceSourceText(value: string) {
  return observedInterfaceSourceText.has(value);
}

const englishInterfaceText: Record<string, string> = {
  "Чтение становится событием, когда мысль продолжается в разговоре.":
    "Reading becomes an event when an idea continues through conversation.",
  "Редакционный принцип клуба": "The club's editorial principle",
  "Энциклопедия сообщества": "Community encyclopedia",
  книг: "books",
  "Прогресс чтения": "Reading progress",
  "минут чтения": "minutes",
  "смысловых разделов": "sections",
  "Литературный журнал и энциклопедия": "Literary journal and encyclopedia",
  "Архив пополняется ежедневно": "The archive grows every day",
  "Литературный журнал": "Literary journal",
  "Основная навигация": "Main navigation",
  Карта: "Map",
  Статьи: "Articles",
  Разделы: "Sections",
  Календарь: "Calendar",
  Форум: "Forum",
  "О проекте": "About",
  "Настройки статистики": "Analytics settings",
  "Точная и бережная статистика": "Accurate, privacy-conscious analytics",
  "Яндекс Метрика поможет увидеть посещаемость по странам и регионам. Она загрузится только с вашего разрешения; Вебвизор отключён.":
    "Yandex Metrica helps us understand readership by country and region. It loads only with your permission; session replay is disabled.",
  "Разрешить статистику": "Allow analytics",
  "Только необходимые": "Necessary only",
  "Открыть единый поиск": "Open site search",
  Поиск: "Search",
  Войти: "Sign in",
  "Быстрая навигация": "Quick navigation",
  Книги: "Books",
  "Журнал о литературе и искусстве слова":
    "A journal about literature and the art of language",
  "Литература -": "Literature is",
  "это целый мир!": "a world of its own!",
  "Статьи, биографии, редкие книги и первая интерактивная литературная энциклопедия стран - в одном редакционном пространстве.":
    "Essays, biographies, rare books and an interactive literary encyclopedia of the world - in one editorial space.",
  "Открыть глобус": "Explore the globe",
  "Открыть архив": "Open archive",
  "Развернуть архив полностью": "Expand archive fully",
  "Погрузиться": "Enter the Literary Planet",
  "Погрузиться в Литературную планету": "Enter the Literary Planet",
  "Искать в Литературной планете": "Search the Literary Planet",
  "Открыть фильтры планеты": "Open Literary Planet filters",
  "Закрыть Литературную планету": "Close the Literary Planet",
  "Развернуть архив страны": "Expand country archive",
  "Свернуть архив страны": "Collapse country archive",
  "Читать журнал": "Read the journal",
  стран: "countries",
  писателей: "writers",
  произведений: "works",
  "Журнал «Проба Пера»": "Proba Pera magazine",
  "Литературный журнал · с 2025 года": "Literary journal · since 2025",
  "Интерактивная энциклопедия": "Interactive encyclopedia",
  "Литературная планета": "Literary Planet",
  "Выберите страну на интерактивном глобусе - откроются писатели, произведения, эпохи и проверенная редакционная справка.":
    "Choose a country on the interactive globe to discover its writers, works, periods and editor-reviewed literary history.",
  "Найти страну": "Find a country",
  "Найти страну, писателя или книгу": "Find a country, writer or book",
  "Россия, Франция, Япония…": "Russia, France, Japan…",
  "Россия, Достоевский, «Моби Дик»…": "Russia, Dostoevsky, Moby-Dick…",
  "Результаты поиска": "Search results",
  "Избранные архивы": "Featured archives",
  "Страна не найдена в выбранной коллекции.":
    "No country was found in this collection.",
  "Фильтры глобуса": "Globe filters",
  "Поиск по Литературной планете": "Search the Literary Planet",
  "Все страны": "All countries",
  "Нобелевские лауреаты": "Nobel laureates",
  "10+ авторов": "10+ writers",
  "Крупнейшие архивы": "Largest archives",
  "С портретами": "With portraits",
  "С реальными портретами": "With real portraits",
  Проверено: "Reviewed",
  "Страны с проверенными карточками": "Countries with verified records",
  "Интерактивный глобус · ручная навигация":
    "Interactive globe · manual navigation",
  "В этой коллекции пока нет стран": "There are no countries in this collection yet",
  "Открываем «Литературную планету»…": "Opening Literary Planet…",
  "Открываем архив…": "Opening the archive…",
  "Текстовый указатель стран": "Text index of countries",
  "Навигация по «Пробе Пера»": "Explore Proba Pera",
  "Навигация по Литературной планете": "Literary Planet navigation",
  Мир: "World",
  "Показать на глобусе": "Show on globe",
  "Место писателя на глобусе пока не указано":
    "This writer's place on the globe is not available yet",
  "Случайное литературное путешествие": "Random literary journey",
  "Случайное путешествие": "Surprise me",
  "Управлять глобусом": "Control globe",
  "Вернуться к прокрутке": "Return to page scroll",
  "Все темы и разделы сайта": "All subjects and sections",
  "От редакционных статей до мировой литературной энциклопедии.":
    "From original essays to a world literary encyclopedia.",
  "Открыть интерактивный каталог": "Open the interactive directory",
  "Проба Пера в цифрах": "Proba Pera in numbers",
  публикаций: "publications",
  публикация: "publication",
  публикации: "publications",
  "Авторский архив": "Author archive",
  "Редакционная витрина": "Editorial selection",
  "Свежие публикации": "Latest publications",
  "Авторские статьи, рецензии, литературные истории и материалы о языке.":
    "Original essays, reviews, literary stories and writing about language.",
  "Другие свежие статьи": "More recent articles",
  "мин. чтения": "min read",
  "мин.": "min",
  "Подключаем редакционный архив…": "Opening the editorial archive…",
  "Наведите, чтобы открыть публикации": "Open to browse publications",
  "Полный архив журнала": "Complete journal archive",
  "Все публикации": "All publications",
  "материал в архиве": "publication in the archive",
  "материала в архиве": "publications in the archive",
  "материалов в архиве": "publications in the archive",
  Читать: "Read",
  Исследовать: "Explore",
  Смотреть: "View",
  Открыть: "Open",
  Энциклопедия: "Encyclopedia",
  "Культура и язык": "Culture and language",
  События: "Events",
  "Сообщество и проект": "Community and project",
  "Все публикации журнала": "All journal publications",
  "Полный авторский архив: статьи, рецензии, эссе, литературные истории и тематические циклы.":
    "The complete editorial archive: articles, reviews, essays, literary stories and thematic series.",
  "Мнение о книге": "Book reviews",
  "Книга и экранизация": "Books and screen adaptations",
  "Книжный гид и подборки": "Reading guides and selections",
  "Литературные премии": "Literary prizes",
  "Биографии и судьбы писателей": "Writers: lives and biographies",
  "О литературе и культуре": "Literature and culture",
  "Разное": "Miscellaneous",
  "Фольклор и мифология": "Folklore and mythology",
  "Язык и редкие слова": "Language and rare words",
  "Литературные истории": "Literary stories",
  "Рассказы и литературные истории": "Stories and literary histories",
  "Авторские рассказы и эссе, судьбы произведений, писательские замыслы и культурные открытия.":
    "Original stories and essays, the lives of works, writers' ideas and cultural discoveries.",
  "Книжный архив": "Book archive",
  "Литературный календарь": "Literary calendar",
  "Указатель писателей": "Writers index",
  "Быстрый вход в биографии, произведения и литературные связи авторов из энциклопедии.":
    "A direct route to biographies, works and literary connections across the encyclopedia.",
  "Обсуждения книг, статей, переводов и экранизаций с общей системой рейтинга и профилей.":
    "Discussions of books, articles, translations and adaptations with shared profiles and ratings.",
  "Личный кабинет и библиотека": "Account and personal library",
  "Сохранённые материалы, любимые книги, страны и писатели, оценки и история участия.":
    "Saved publications, favourite books, countries and writers, ratings and participation history.",
  "О проекте и редакции": "About the project and editors",
  "Миссия «Пробы Пера», редакционный стандарт, источники, исправления и авторские права.":
    "The mission of Proba Pera, editorial standards, sources, corrections and copyright.",
  "Форум, оценки и обсуждения": "Forum, ratings and discussions",
  "Профиль и личная библиотека": "Profile and personal library",
  "Редакция, источники и правила": "Editors, sources and standards",
  авторов: "writers",
  "Редкие издания, классика и современная литература - с контекстом и без лишних спойлеров.":
    "Rare editions, classics and contemporary books - with context and without unnecessary spoilers.",
  "Сравниваем текст и экранную версию: что изменилось, что потерялось и что стало сильнее.":
    "Comparing the written work and its screen adaptation: what changed, what was lost and what became stronger.",
  "Тематические маршруты для чтения: классика, современная проза и книги, к которым хочется вернуться.":
    "Curated reading routes through classics, contemporary prose and books worth revisiting.",
  "История крупнейших наград, лауреаты, произведения и культурный контекст.":
    "The history of major prizes, their laureates, works and cultural context.",
  "Тщательные человеческие биографии: судьба, время, характер и главные тексты автора.":
    "Carefully researched biographies: a writer’s life, time, character and defining works.",
  "Большие редакционные эссе о чтении, библиотеках, культурной памяти и будущем книги.":
    "Long-form essays on reading, libraries, cultural memory and the future of books.",
  "Персонажи, сюжеты и образы устной традиции - от славянского фольклора до мировых мифологий.":
    "Characters, stories and imagery from oral traditions, from Slavic folklore to world mythology.",
  "История слов, точные значения и выразительные возможности русского языка без сухой словарной подачи.":
    "Word histories, precise meanings and the expressive possibilities of Russian, presented as living language.",
  "Необычные судьбы произведений, авторские замыслы, профессии писателей и культурные открытия.":
    "The unusual lives of books, writers’ ideas and professions, and cultural discoveries.",
  "Страны, национальные традиции и писатели, благодаря которым мировая литература говорит разными голосами.":
    "Countries, national traditions and the writers who give world literature its many voices.",
  "Книги связаны с авторами, странами, эпохами и статьями журнала - с фильтрами и редакционной проверкой обложек.":
    "Books connected to writers, countries, periods and journal articles, with filters and editorial cover review.",
  "Дни рождения и памяти писателей с точными датами и быстрым переходом к карточке автора.":
    "Writers’ birthdays and memorial dates, with verified dates and direct links to their profiles.",
  "Язык интерфейса": "Interface language",
  "Русский язык": "Russian",
  "Английский язык": "English",
  "Оригинал на русском языке": "Original publication in Russian",
  "К журналу": "Back to journal",
  "Настройки чтения": "Reading settings",
  "Уменьшить шрифт": "Decrease font size",
  "Увеличить шрифт": "Increase font size",
  "Остановить автоматическую прокрутку": "Pause automatic scrolling",
  "Продолжить автоматическую прокрутку": "Resume automatic scrolling",
  "В этом материале": "In this article",
  "Закрыть": "Close",
  "Материал читается как единое эссе.":
    "This publication is structured as a continuous essay.",
  слов: "words",
  просмотров: "views",
  "Режим печатной книги": "Printed book mode",
  "Авторская публикация журнала «Проба Пера»":
    "An original publication by Proba Pera",
  "Оригинал публикации ↗": "Original publication ↗",
  "Постоянная ссылка ↗": "Permanent link ↗",
  "Материал временно не открылся.": "This publication is temporarily unavailable.",
  "Прочитать оригинал на probpera.ru": "Read the original on probpera.ru",
  "Открыть постоянную ссылку": "Open the permanent link",
  "Готовим материал к чтению…": "Preparing the article…",
  "Конец материала": "End of article",
  "Источники и библиография": "Sources and bibliography",
  "Спасибо за внимательное прочтение статьи":
    "Thank you for reading with care",
  "Авторский текст сохранён в исходном виде. Замечания по фактам и языку проходят отдельную редакционную проверку.":
    "The author’s text is preserved in its original form. Notes on facts and language undergo a separate editorial review.",
  "Продолжить чтение": "Continue reading",
  "Соседние публикации": "Adjacent publications",
  "Предыдущий материал": "Previous article",
  "Следующий материал": "Next article",
  "Удалить статью из библиотеки": "Remove article from your library",
  "Сохранить статью": "Save article",
  "Сохранено в библиотеке": "Saved to your library",
  "Сохранить на потом": "Save for later",
  "Тёмный режим": "Dark mode",
  "Светлый режим": "Light mode",
  "Ночь": "Night",
  "Свет": "Light",
  "Книга": "Book",
  "Режим оформления": "Display mode",
  "Книги, авторы, страны": "Books, writers, countries",
  "Произведения связаны с карточками писателей и литературными традициями стран. Расширенные сведения публикуются только после редакционной проверки.":
    "Works are connected to writer profiles and national literary traditions. Extended information is published only after editorial review.",
  "произведений из единой базы стран": "works from the unified country archive",
  "Поиск по книге, автору или стране": "Search by book, writer or country",
  "Например, Достоевский или Япония": "For example, Dostoevsky or Japan",
  "Фильтры книжного архива": "Book archive filters",
  "Отбор архива": "Archive selection",
  "результатов": "results",
  "Все связанные произведения": "All linked works",
  "Весь архив": "Complete archive",
  "Карточки с подтверждёнными данными": "Records with verified metadata",
  "Непроверенные": "Not verified",
  "Карточки в редакционной очереди": "Records in the editorial queue",
  "С обложками": "With covers",
  "Изображения с указанным источником": "Images with documented sources",
  "До 1945 года": "Before 1945",
  "Опубликовано до 1945": "Published before 1945",
  "Ранние издания и классика": "Early works and classics",
  "После 1945 года": "After 1945",
  "Опубликовано после 1945": "Published after 1945",
  "Литература второй половины XX-XXI века": "Literature from the late 20th and 21st centuries",
  "Классика до середины XX века": "Classics through the mid-20th century",
  "Первое издание - не позднее 1945 года": "First published no later than 1945",
  "Послевоенная и современная литература": "Postwar and contemporary literature",
  "Первое издание - с 1946 года по настоящее время": "First published from 1946 to the present",
  "Закрыть карточку книги": "Close book details",
  "Редакционная обложка": "Editorial cover for",
  "Редакционная обложка «Пробы Пера»": "Proba Pera editorial cover",
  "Редакционная обложка произведения": "Editorial cover for",
  Иллюстрация: "Illustration",
  "Иллюстрация из статьи о произведении": "Illustration from an article about",
  "Редакционная иллюстрация из связанной статьи · не является обложкой конкретного издания":
    "Editorial image from a related article · not the cover of a specific edition",
  "Проверено редакцией": "Editorially verified",
  "Не проверено": "Not verified",
  "Редакционная карточка": "Editorial record",
  "Архивная запись": "Archive record",
  Автор: "Writer",
  Страна: "Country",
  "Первая публикация": "First published",
  "Язык оригинала": "Original language",
  "Произведение уже связано с автором и страной. Расширенная аннотация, история публикации и библиография находятся в редакционной очереди - неподтверждённые сведения здесь не публикуются.":
    "This work is already linked to its writer and country. The extended summary, publication history and bibliography remain in editorial review; unverified information is not published here.",
  "Темы и жанры книги": "Book subjects and genres",
  "Добавить в мою библиотеку": "Add to my library",
  "Открыть автора и страну": "Open writer and country",
  "Источник сведений": "Information source",
  "Исходная запись кандидата": "Candidate source record",
  "Источник обложки": "Cover source",
  "Внешнее превью · файл не хранится на сайте":
    "External preview · the file is not stored on this website",
  "Редакционная обложка «Пробы Пера» · не является обложкой конкретного издания":
    "Original Proba Pera artwork · not the cover of a specific edition",
  "Права на изображение проверены": "Image rights verified",
  проверено: "verified",
  "редакционная карточка": "editorial record",
  "в очереди": "in review",
  "Сохранить книгу": "Save book",
  "О книге": "About the book",
  "Книга в журнале": "This book in the journal",
  "Статьи и упоминания": "Articles and mentions",
  "Ищем материалы о книге…": "Finding articles about this book…",
  "Статья о книге": "Book review",
  "Материал о книге": "Feature about the book",
  "Книга упоминается": "Book mentioned",
  "Ничего не найдено": "Nothing found",
  "Попробуйте другое название, автора, страну или фильтр.":
    "Try another title, writer, country or filter.",
  "Показать ещё 12": "Show 12 more",
  "Показать ещё 13": "Show 13 more",
  "Единый каталог": "Unified catalogue",
  "Найти в «Пробе Пера»": "Search Proba Pera",
  "Закрыть поиск": "Close search",
  "Страна, писатель, книга, статья, эпоха…":
    "Country, writer, book, article, period…",
  "Поиск одновременно проверяет страны, писателей, произведения и редакционные публикации.":
    "Search countries, writers, works and editorial publications at once.",
  Достоевский: "Dostoevsky",
  Япония: "Japan",
  Экранизация: "adaptation",
  "Совпадений не найдено": "No matches found",
  "Попробуйте фамилию, название произведения или другую форму слова.":
    "Try a surname, a work title or another form of the word.",
  автор: "writer",
  автора: "writers",
  произведение: "work",
  произведения: "works",
  статья: "article",
  статьи: "articles",
  статей: "articles",
  Страны: "Countries",
  страна: "country",
  страны: "countries",
  "В выбранной коллекции -": "In this collection:",
  С: "N",
  Ю: "S",
  Писатели: "Writers",
  Писатель: "Writer",
  "Ничего не найдено в выбранной коллекции.":
    "Nothing was found in the selected collection.",
  "карточка автора": "writer profile",
  "Поиск выполняется внутри сайта": "Search stays within this website",
  "Интерактивный литературный глобус": "Interactive literary globe",
  "Литературная планета временно недоступна":
    "Literary Planet is temporarily unavailable",
  "Готовим интерактивный глобус…": "Preparing the interactive globe…",
  "Используйте текстовый указатель стран ниже":
    "Use the country text index below",
  "Тяните, чтобы вращать": "Drag to rotate",
  "Колесо - масштаб": "Scroll to zoom",
  "Тяните или используйте стрелки": "Drag or use the arrow keys",
  "Колесо или ± - масштаб": "Scroll or use ± to zoom",
  "Нажмите, чтобы открыть архив страны": "Select to open the country archive",
  "Страна выбрана · карточка архива открыта":
    "Country selected · archive card open",
  "Интерактивный литературный глобус. Стрелки вращают, плюс и минус меняют масштаб, Home возвращает исходный вид.":
    "Interactive literary globe. Arrow keys rotate, plus and minus zoom, and Home restores the initial view.",
  "Управление глобусом": "Globe controls",
  "Уменьшить масштаб глобуса": "Zoom out of the globe",
  "Увеличить масштаб глобуса": "Zoom in on the globe",
  "Остановить автоматическое вращение": "Stop automatic rotation",
  "Включить автоматическое вращение": "Start automatic rotation",
  "Автовращение приостановлено, пока выбрана страна":
    "Automatic rotation is paused while a country is selected",
  "Автовращение приостановлено во время взаимодействия":
    "Automatic rotation is paused during interaction",
  "Автовращение отключено в режиме уменьшения движения":
    "Automatic rotation is disabled by reduced-motion preferences",
  "Вернуть исходный вид глобуса": "Restore the globe's initial view",
  Авто: "Auto",
  Пауза: "Paused",
  Сброс: "Reset",
  "Повторить загрузку глобуса": "Retry loading the globe",
  "Литературный архив": "Literary archive",
  "Закрыть панель": "Close panel",
  Столица: "Capital",
  "Литературное наследие страны": "The country’s literary heritage",
  "Эпохи и направления": "Periods and movements",
  "Биография в архиве": "Biography in the archive",
  "Для каждой биографии показан её фактический статус":
    "Each biography shows its actual review status",
  "Подтверждено источниками": "Source-verified",
  "Архивная справка · не проверена": "Archive note · not verified",
  "В редакционной очереди": "In editorial review",
  "Источники зафиксированы": "Sources recorded",
  "Источники ещё не зафиксированы": "Sources are not recorded yet",
  "Проверенная биография готовится": "A verified biography is in preparation",
  "Разделы карточки автора": "Writer card sections",
  "Произведения и награды": "Works and awards",
  "Источники и материалы": "Sources and related reading",
  "Редакционный архив": "Editorial archive",
  "Опубликованные произведения": "Published works",
  "Здесь показаны только произведения, прошедшие редакционную проверку.":
    "Only works that have passed editorial review are shown here.",
  "Проверенные произведения этого автора пока не опубликованы.":
    "No reviewed works have been published for this writer yet.",
  "Редакционная фиксация": "Editorial record",
  "Награды и отличия": "Awards and distinctions",
  "Награды автора и отличия произведений показаны с их фактическим редакционным статусом.":
    "Writer awards and work distinctions are shown with their actual editorial status.",
  "Награды и отличия этого автора пока не зафиксированы.":
    "No awards or distinctions have been recorded for this writer yet.",
  "Отличие произведения": "Work distinction",
  "Структурированная запись с зафиксированным источником":
    "Structured record with a documented source",
  "Запись прошла редакционную проверку":
    "The record has passed editorial review",
  "Источник ещё не зафиксирован": "The source has not been recorded yet",
  "Открыть источник": "Open source",
  Источник: "Source",
  "Для этой архивной справки источники ещё не зафиксированы.":
    "Sources have not yet been recorded for this archive note.",
  "Для этого автора проверенные произведения и награды пока не опубликованы.":
    "No verified works or awards have been published for this writer yet.",
  "В архиве этой страны пока нет опубликованных карточек писателей.":
    "This country archive has no published writer profiles yet.",
  "Открыть карточку автора": "Open writer profile",
  "Карточка автора": "Writer profile",
  "Литературная традиция": "Literary tradition",
  "Справочная карточка · требует расширения":
    "Reference record · expansion required",
  "Расширенная биография готовится для энциклопедии.":
    "An extended biography is being prepared for the encyclopedia.",
  "Основные произведения": "Major works",
  "Премии и награды": "Prizes and awards",
  "Материалы журнала": "Journal articles",
  Источники: "Sources",
  "Литературная хронология": "Literary chronology",
  "Интересные факты": "Notable facts",
  "Справочные тексты энциклопедии представлены в оригинале на русском языке.":
    "Encyclopedia reference texts are presented in their original Russian.",
  "Живая энциклопедия": "A living encyclopedia",
  "Даты рождения и памяти писателей складываются в живую историю мировой литературы.":
    "Writers’ birthdays and memorial dates form a living history of world literature.",
  "Предыдущий месяц": "Previous month",
  "Следующий месяц": "Next month",
  Сегодня: "Today",
  "Сводка месяца": "Month summary",
  "точных дат": "exact dates",
  "дней рождения": "birthdays",
  "дней памяти": "memorial dates",
  "Ближайшая дата": "Next date",
  "Выбранный день": "Selected day",
  "Хронология месяца": "Month chronology",
  "Показать месяц": "Show month",
  "День рождения": "Birthday",
  "День памяти": "In memoriam",
  "В этом месяце нет дат с известными днём и месяцем":
    "No dates with a verified day and month are available this month",
  "Показаны только даты с известными днём и месяцем. Записи, содержащие один год, больше не считаются событиями 1 января.":
    "Only dates with a known day and month are shown. Year-only records are no longer treated as events on 1 January.",
  "Не удалось обновить обсуждение. Попробуйте ещё раз.":
    "The discussion could not be refreshed. Please try again.",
  "Оценку не удалось сохранить. Попробуйте ещё раз.":
    "Your rating could not be saved. Please try again.",
  "Спасибо - ваша оценка сохранена.": "Thank you - your rating has been saved.",
  "Слишком много сообщений подряд. Подождите несколько минут.":
    "Too many messages were sent in a short time. Please wait a few minutes.",
  "Комментарий не удалось опубликовать. Проверьте текст и повторите.":
    "The comment could not be published. Check the text and try again.",
  "Комментарий опубликован.": "Comment published.",
  "Не удалось отправить жалобу.": "The report could not be sent.",
  "Спасибо. Комментарий передан редакции на проверку.":
    "Thank you. The comment has been sent to the editors for review.",
  "Открытые рейтинги и встроенные комментарии готовы и включатся после подключения серверной базы проекта.":
    "Open ratings and first-party comments are ready and will become active when the project database is connected.",
  "Обсуждение публикации": "Publication discussion",
  "Обсуждение книги": "Book discussion",
  "Мнение читателей": "Readers’ views",
  "Оценить публикацию": "Rate this publication",
  "Оценить книгу": "Rate this book",
  "Имя или никнейм": "Name or nickname",
  "Как к вам обращаться": "How should we address you?",
  Комментарий: "Comment",
  "Поделитесь впечатлением о материале":
    "Share your thoughts about this publication",
  "Поделитесь впечатлением о книге": "Share your thoughts about this book",
  "Публикуем…": "Publishing…",
  "Опубликовать комментарий": "Publish comment",
  Читатель: "Reader",
  "Пожаловаться редакции": "Report to the editors",
  "Начните содержательный разговор": "Start a thoughtful conversation",
  "Первый комментарий может оставить любой читатель.":
    "Any reader can leave the first comment.",
  "Книга дня": "Book of the day",
  "Книга месяца": "Book of the month",
  "Выбор энциклопедии": "Encyclopedia selection",
  "Открываем библиотеку…": "Opening the library…",
  "Начните литературное путешествие с одного из ключевых произведений национальной традиции.":
    "Begin a literary journey with a defining work from this national tradition.",
  "Каждый день энциклопедия выбирает новое произведение из единой базы стран.":
    "Each day the encyclopedia selects a new work from the unified country archive.",
  "Каждый месяц энциклопедия выбирает новое произведение из единой базы стран.":
    "Each month the encyclopedia selects a new work from the unified country archive.",
  "Темы книги": "Book subjects",
  "Редакционный стандарт": "Editorial standard",
  "Материал, которому можно доверять": "Material you can trust",
  "публикационную проверку по открытым авторитетным источникам":
    "the publication gate against open authoritative sources",
  "{count} карточка уже прошла публикационную проверку по открытым авторитетным источникам":
    "{count} writer profile has passed the publication gate against open authoritative sources",
  "{count} карточки уже прошли публикационную проверку по открытым авторитетным источникам":
    "{count} writer profiles have passed the publication gate against open authoritative sources",
  "{count} карточек уже прошли публикационную проверку по открытым авторитетным источникам":
    "{count} writer profiles have passed the publication gate against open authoritative sources",
  "{count} документальный портрет подключён без генерации лиц":
    "{count} documentary portrait is connected without generated faces",
  "{count} документальных портрета подключены без генерации лиц":
    "{count} documentary portraits are connected without generated faces",
  "{count} документальных портретов подключены без генерации лиц":
    "{count} documentary portraits are connected without generated faces",
  "Ещё {count} запись остаётся в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки":
    "{count} record remains in editorial review; automatically assembled drafts are not published before manual verification",
  "Ещё {count} записи остаются в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки":
    "{count} records remain in editorial review; automatically assembled drafts are not published before manual verification",
  "Ещё {count} записей остаются в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки":
    "{count} records remain in editorial review; automatically assembled drafts are not published before manual verification",
  "Издание глобуса": "Globe edition",
  "Источник и права текущего издания глобуса":
    "Source and rights for the current globe edition",
  "Источник и права": "Source and rights",
  "Издание не загрузилось. Предыдущее издание сохранено.":
    "The edition could not load. The previous edition is still active.",
  "Загружается издание": "Loading edition",
  "Источник издания": "Edition source",
  "Автор / составитель": "Author / compiler",
  Оригинал: "Original",
  Хранилище: "Holding institution",
  "Каталожная запись": "Catalog record",
  "Права и указание источника": "Rights and attribution",
  "Совмещение карты": "Map alignment",
  "Открыть запись источника": "Open source record",
  "Стиль не загрузился. Предыдущий стиль сохранён.":
    "The style could not load. The previous style is still active.",
  Повторить: "Retry",
  "Автовращение приостановлено во время наведения":
    "Auto-rotation is paused while pointing at the globe",
  "Автовращение приостановлено во время перелёта камеры":
    "Auto-rotation is paused during camera travel",
  "Автовращение приостановлено вне экрана":
    "Auto-rotation is paused while the globe is offscreen",
  Старинный: "Antique",
  Ретро: "Retro",
  Классический: "Classic",
  "Классич.": "Classic",
  Современный: "Modern",
  Модерн: "Modern",
  "Современное оформление · 2026": "Modern edition · 2026",
  "Классический атлас · 2026": "Classic atlas · 2026",
  "Текстуру Земли не удалось загрузить. Возвращён старинный стиль.":
    "The globe texture could not be loaded. Antique style has been restored.",
  "Загружается стиль": "Loading style",
  "лауреат на глобусе": "laureate on the globe",
  "лауреата на глобусе": "laureates on the globe",
  "лауреатов на глобусе": "laureates on the globe",
  "автор в архиве": "writer in the archive",
  "автора в архиве": "writers in the archive",
  "авторов в архиве": "writers in the archive",
  "Современная визуальная редакция 2026 года. Картография: Natural Earth.":
    "Modern visual edition, 2026. Cartography: Natural Earth.",
  "Классический картографический атлас, редакция 2026 года. Картография: Natural Earth.":
    "Classic cartographic atlas, 2026 edition. Cartography: Natural Earth.",
  "Полное имя, проверяемые даты, человеческая биография, ключевые произведения и открытые источники. Сомнительные сведения не маскируются уверенным тоном.":
    "Full names, verifiable dates, human biographies, major works and open sources. Uncertain claims are never disguised by a confident tone.",
  "Интересный факт о книге": "A notable book fact",
  "Проверить источник": "Check the source",
  "Собираем книжный архив…": "Building the book archive…",
  "Новые публикации": "New publications",
  "Читать в «Пробе Пера»": "Read in Proba Pera",
  "Читать статью": "Read article",
  "Все материалы рубрики": "All articles in this section",
  "Обсуждение номера": "Issue discussion",
  "Статья заканчивается, разговор - продолжается":
    "The article ends, the conversation continues",
  "Оценки и комментарии привязаны к конкретной публикации. Авторский текст остаётся неизменным, а читательская дискуссия живёт отдельно.":
    "Ratings and comments belong to a specific publication. The author’s text remains unchanged while reader discussion lives alongside it.",
  "Собираем авторский архив…": "Building the editorial archive…",
  "Литературное сообщество": "Literary community",
  "Разговор после чтения": "The conversation after reading",
  "Выберите тему, продолжите мысль из статьи или предложите собственный маршрут чтения.":
    "Choose a topic, continue an idea from an article or suggest your own reading route.",
  "Клуб внимательных читателей": "A club for attentive readers",
  "Форум для обстоятельного разговора о книгах, переводах и экранизациях. Без случайных виджетов: единый профиль, содержательные комментарии, рейтинги и редакционная модерация.":
    "A forum for thoughtful discussion of books, translations and adaptations. One profile, substantive comments, ratings and editorial moderation.",
  "Обсуждения книг и публикаций журнала":
    "Discussions of books and journal publications",
  "Оценки материалов и произведений": "Ratings for publications and works",
  "Профиль читателя и история участия":
    "Reader profile and participation history",
  "Открыть форум": "Open forum",
  "Вступить в клуб": "Join the club",
  "Лица мировой литературы": "Faces of world literature",
  "Авторы, с которых можно начать": "Writers to begin with",
  "Источник изображения": "Image source",
  "Фирменная заглушка портрета": "Branded portrait placeholder",
  Портрет: "Portrait",
  "Навигация по журналу": "Journal navigation",
  "Основные разделы": "Main sections",
  "Полный архив публикаций": "Complete publication archive",
  "Собираем каталог разделов…": "Building the section directory…",
  "Открытая редакция": "Open editorial process",
  "Как устроено доверие": "How trust is built",
  "Читатель видит не только готовый текст, но и правила, по которым сведения попадают в энциклопедию.":
    "Readers see not only the finished text, but also the rules by which information enters the encyclopedia.",
  "Сообщить об ошибке": "Report an error",
  "Редакционная политика": "Editorial policy",
  "Авторские статьи сохраняют индивидуальный голос. Фактические утверждения, даты, имена и библиография проверяются отдельно; спорные сведения помечаются, а не выдаются за установленные.":
    "Original articles retain their individual voice. Factual claims, dates, names and bibliography are checked separately; disputed information is labelled rather than presented as settled fact.",
  "Источники и фактчекинг": "Sources and fact-checking",
  "Приоритет получают библиотеки, музеи, архивы, научные издания и правообладатели. В карточках писателей и книг источник показывается рядом с подтверждаемым сведением.":
    "Libraries, museums, archives, scholarly editions and rights holders are prioritised. Sources appear beside the claims they support in writer and book records.",
  "Иллюстрации и права": "Images and rights",
  "Портреты не генерируются. Используются документальные изображения и легальные внешние превью; для обложек хранится источник, статус лицензии и дата последней проверки.":
    "Portraits are not generated. Documentary images and lawful external previews are used; every cover records its source, licence status and latest review date.",
  "Исправления и обновления": "Corrections and updates",
  "Существенные исправления проходят редакционную проверку. Читатель может сообщить о неточности по почте, указав страницу, фрагмент и надёжный источник.":
    "Material corrections undergo editorial review. Readers may report an error by email, identifying the page, passage and a reliable source.",
  "Собираем литературные даты…": "Building the literary calendar…",
  "Авторские статьи и единая интерактивная экосистема о мировой литературе: страны, писатели, книги, эпохи и разговор читателей.":
    "Original essays and a unified interactive ecosystem for world literature: countries, writers, books, periods and reader discussion.",
  "Карта сайта": "Site map",
  Журнал: "Journal",
  "Редкие слова": "Rare words",
  "Литературная карта": "Literary map",
  "Календарь событий": "Events calendar",
  "Исправления и авторские права": "Corrections and copyright",
  Сообщество: "Community",
  "Форум читателей": "Reader forum",
  "Личный кабинет": "My account",
  "Вход и регистрация": "Sign in and register",
  "Связаться с редакцией": "Contact the editors",
  Контакты: "Contacts",
  "Независимый литературный журнал": "Independent literary journal",
  "«Проба Пера»": "Proba Pera",
  "Авторский архив · 167 материалов": "Editorial archive · 167 publications",
  "Журнал, выстроенный для чтения": "A journal designed for reading",
  "Мнения о книгах, литературные эссе, биографии, экранизации и языковые наблюдения собраны в единую редакционную библиотеку.":
    "Book reviews, literary essays, biographies, adaptations and observations on language form one editorial library.",
  "Поиск по публикациям": "Search publications",
  "Название, тема или рубрика…": "Title, subject or section…",
  "Рубрики журнала": "Journal sections",
  "Все материалы": "All publications",
  "Текст и заголовки сохранены из оригинальных материалов":
    "Text and headings are preserved from the original publications",
  "Читать в новом режиме": "Read in the new reader",
  "Материалов по этому запросу пока нет":
    "No publications match this search yet",
  "Показать весь журнал": "Show the complete journal",
  "Показать ещё 12 материалов": "Show 12 more publications",
  "Открываем режим чтения…": "Opening the reader…",
  Новое: "New",
  "Статья по теме": "Related article",
  "Редакционный маршрут": "Editorial reading route",
  "Что читать дальше": "Continue reading",
  "Материалы подобраны по рубрике, теме и смысловым связям этой публикации.":
    "Recommendations are selected by section, subject and thematic links to this article.",
  "События на каждый день": "Events for every day",
  "Обложка книги": "Book cover",
  "Обложка конкретного издания": "Cover of a specific edition",
  "Издание на обложке": "Edition shown on the cover",
  "Темы для разговора": "Conversation topics",
  "С чего начать разговор": "Where to begin",
  "Читательский дневник": "Reader's journal",
  "Какая книга не отпускает вас сейчас?":
    "Which book can’t you put down right now?",
  "Искусство перевода": "The art of translation",
  "Когда перевод становится новой книгой":
    "When does a translation become a new book?",
  "Соберите собственный маршрут чтения":
    "Create your own reading route",
  "авторов в энциклопедии": "writers in the encyclopedia",
  "произведений в архиве": "works in the archive",
  "стран на карте": "countries on the map",
  "Место для спокойного и содержательного разговора о книгах - без шума и случайных рекомендаций. Здесь можно продолжить мысль из статьи, обсудить перевод, собрать читательский маршрут и сохранить историю собственного чтения.":
    "A place for calm, substantive conversation about books, without noise or random recommendations. Continue an idea from an article, discuss a translation, build a reading route and preserve the history of your reading.",
  "Читать обсуждения можно сразу. Профиль нужен только для участия в разговоре, оценок и личной библиотеки.":
    "Anyone can read the discussions. A profile is needed only to join the conversation, rate publications and use a personal library.",
  "Разговоры о книгах, статьях, переводах и экранизациях":
    "Conversations about books, articles, translations and adaptations",
  "Оценки, комментарии и тематические подборки читателей":
    "Reader ratings, comments and thematic collections",
  "Личная библиотека, любимые авторы, страны и история участия":
    "A personal library, favourite writers and countries, and participation history",
  "Тематические серии выбранного раздела":
    "Thematic series in the selected section",
  Серии: "Series",
  Все: "All",
  "Проба Пера": "Proba Pera",
  "Проба Пера - главная": "Proba Pera - home",
  иллюстраций: "illustrations",
  "Продолжено с места остановки": "Resumed where you left off",
  "статьи прочитано": "of article read",
  "Начать сначала": "Start over",
  "Открыть главное изображение": "Open the main image",
  "Открыть изображение": "Open image",
  "Открыть иллюстрацию": "Open illustration",
  "Галерея статьи": "Article gallery",
  изображений: "images",
  "Выбор изображения": "Image selection",
  "Показать изображение": "Show image",
  Рассмотреть: "View image",
  "Просмотр иллюстрации": "Image viewer",
  "Закрыть изображение": "Close image",
  "Переключение иллюстраций": "Image navigation",
  "Предыдущее изображение": "Previous image",
  "Следующее изображение": "Next image",
  "Ищем во всём архиве…": "Searching the complete archive…",
  "Подключаем статьи, книги, писателей и страны.":
    "Loading articles, books, writers and countries.",
  "Нобелевский лауреат": "Nobel laureate",
  "Нажмите на метку - откроется карточка лауреата":
    "Select the marker to open the laureate’s profile",
  "Нажмите на кластер - откроется Нобелевский контекст страны":
    "Select the cluster to open the country’s Nobel context",
  "Статья о лауреате": "Article about the laureate",
  "лауреат страны": "country laureate",
  "лауреата страны": "country laureates",
  "лауреатов страны": "country laureates",
  "Нобелевский архив": "Nobel archive",
  "Редакционная серия": "Editorial series",
  "Лауреаты Нобелевской премии · 1901-2025":
    "Nobel Prize laureates · 1901-2025",
  "История премии": "History of the prize",
  "Период архива": "Archive period",
  "Все годы": "All years",
  "Лауреаты по годам": "Laureates by year",
  "Статья журнала": "Magazine article",
  "Премия не присуждалась: ": "No prize was awarded in: ",
  "Сверено с официальным архивом": "Verified against the official archive",
  Рубрики: "Sections",
  "Вы следите за архивом страны": "You follow this country archive",
  "Следить за новыми материалами страны":
    "Follow new publications about this country",
  "Скрыть метки Нобелевских лауреатов этой страны":
    "Hide this country’s Nobel laureate markers",
  "Показать всех Нобелевских лауреатов этой страны на глобусе":
    "Show all of this country’s Nobel laureates on the globe",
  "Открыть биографию": "Open biography",
  "Вы следите за автором": "You follow this writer",
  "Следить за новыми материалами автора":
    "Follow new publications about this writer",
  "Открыть статью о лауреате": "Open the article about this laureate",
  "Лауреат Нобелевской премии по литературе":
    "Nobel Prize laureate in Literature",
  "Читать редакционный материал года": "Read the editorial article for this year",
  "Годовая статья готовится редакцией":
    "The editorial article for this year is in preparation",
  "Неизвестный автор": "Unknown writer",
  Лауреат: "Laureate",
  "Архив объединяет авторов и ключевые произведения литературной традиции страны.":
    "The archive brings together writers and defining works from this country’s literary tradition.",
  "Архив мира": "World archive",
  "Центр обзора": "View centre",
  "Иллюстрация к материалу": "Illustration for",
  "Фирменная обложка материала": "Branded cover for",
  "Источник портрета": "Portrait source",
  "Авторские публикации защищены законом.":
    "Original publications are protected by law.",
  "Пополняем словарный запас": "Expanding your vocabulary",
  "Профессии писателей": "Writers’ professions",
  Экранизации: "Adaptations",
  Фольклор: "Folklore",
  "Хантер С. Томпсон «Ангелы ада»":
    "Hunter S. Thompson, Hell’s Angels",
  "Первая большая работа основателя гонзо-журналистики: история создания, контекст и честное мнение после прочтения.":
    "The first major work by the founder of gonzo journalism: its origins, context and an honest response after reading.",
  "Семь знаковых писателей Японии": "Seven landmark writers from Japan",
  "От классической традиции до современной прозы - маршрут по авторам, прославившим японскую литературу.":
    "A route from the classical tradition to contemporary fiction through the writers who brought Japanese literature worldwide recognition.",
  "Редкие слова, которые помогут вам расширить словарный запас":
    "Rare words to expand your vocabulary",
  "Не словарь ради словаря, а живые значения, происхождение и примеры употребления в понятной редакционной подаче.":
    "Living meanings, origins and examples of usage presented with editorial clarity, rather than a dictionary for its own sake.",
  "Кем работали классики до литературной славы":
    "What classic writers did before literary fame",
  "Неожиданные профессии зарубежных авторов и то, как жизненный опыт становился частью их будущих книг.":
    "The unexpected professions of international writers and how lived experience entered their future books.",
  "12 минут": "12 min read",
  "15 минут": "15 min read",
  "9 минут": "9 min read",
  "11 минут": "11 min read",
  "«Алиса в Стране чудес»": "Alice’s Adventures in Wonderland",
  "Тираж первого издания 1865 года отозвали из-за качества печати иллюстраций Джона Тенниела. Из двух тысяч экземпляров успели раздать лишь около пятидесяти.":
    "The 1865 first edition was recalled because of the printing quality of John Tenniel’s illustrations. Only about fifty of the two thousand copies had been distributed.",
  "Библиотека Конгресса": "Library of Congress",
  "«Разум и чувства»": "Sense and Sensibility",
  "Первый роман Джейн Остин вышел в 1811 году без имени писательницы: на титульном листе было указано только «By a Lady» - «Написано леди».":
    "Jane Austen’s first novel was published in 1811 without her name: the title page identified its author only as “By a Lady.”",
  "Британская библиотека": "British Library",
  "«Маленький принц»": "The Little Prince",
  "Повесть впервые издали в Нью-Йорке 6 апреля 1943 года сразу на французском и английском языках. Французское издание появилось уже после войны - в 1946 году.":
    "The novella was first published in New York on 6 April 1943 in French and English at the same time. A French edition appeared after the war, in 1946.",
  "Национальная библиотека Франции": "National Library of France",
  "«Замок Отранто»": "The Castle of Otranto",
  "Роман Хораса Уолпола 1764 года, считающийся первым готическим романом, первоначально вышел анонимно и выдавался за найденную средневековую рукопись.":
    "Horace Walpole’s 1764 novel, widely regarded as the first Gothic novel, was initially published anonymously and presented as a discovered medieval manuscript.",
  "Писатели мира": "Writers of the world",
  "Лауреаты Нобелевской премии": "Nobel Prize laureates",
  "Истории литературных премий": "Stories of literary prizes",
  "Мировой фольклор и мифология": "World folklore and mythology",
  "Истории из мира литературы": "Stories from the literary world",
  "Лучшие книги и подборки": "Best books and reading lists",
  "Непризнанные современниками": "Unrecognised by their contemporaries",
  "Книги, от которых не оторваться": "Unputdownable books",
  "Экранизации бестселлеров XXI века":
    "Screen adaptations of 21st-century bestsellers",
  "Удачные экранизации классики": "Successful adaptations of classics",
  "Литературные факты и явления": "Literary facts and phenomena",
  "Крылатые выражения": "Famous expressions",
  "Бестселлеры XXI века": "21st-century bestsellers",
  "Лучшие книги писателей": "Writers’ best books",
  "Новые материалы редакции": "New editorial publications",
  "Отдельные редакционные материалы": "Standalone editorial publications",
  "Редакционные материалы": "Editorial publications",
  репутации: "reputation",
  "Не удалось загрузить обсуждения. Проверьте схему сообщества.":
    "Discussions could not be loaded. Check the community database schema.",
  "Не удалось загрузить ответы.": "Replies could not be loaded.",
  "Сервер сообщества ещё не подключён к этой сборке сайта.":
    "The community server is not connected to this site build yet.",
  "Никнейм должен содержать от 2 до 32 букв или цифр; допустимы пробел, точка, дефис и подчёркивание.":
    "Your nickname must be 2-32 letters or digits long; spaces, full stops, hyphens and underscores are allowed.",
  "Введите действующий адрес электронной почты.": "Enter a valid email address.",
  "Пароль должен содержать не менее 10 символов.":
    "Your password must contain at least 10 characters.",
  "Пароли не совпадают.": "The passwords do not match.",
  "Подтвердите согласие с правилами сообщества.":
    "Confirm that you agree to the community rules.",
  "Этот адрес уже зарегистрирован. Переключитесь на вход.":
    "This address is already registered. Switch to sign-in.",
  "Почта или пароль указаны неверно.": "The email address or password is incorrect.",
  "Письмо уже отправлялось недавно. Подождите немного и повторите попытку.":
    "An email was sent recently. Wait a moment and try again.",
  "Пароль не соответствует требованиям безопасности.":
    "The password does not meet the security requirements.",
  "Не удалось выполнить запрос": "The request could not be completed",
  "Регистрация принята. Проверьте почту и подтвердите адрес - после этого можно войти.":
    "Your registration has been received. Check your email and confirm the address before signing in.",
  "Вы вошли в клуб читателей.": "You are now signed in to the readers’ club.",
  "Не удалось связаться с сервером. Проверьте интернет и повторите попытку.":
    "The server could not be reached. Check your connection and try again.",
  "Войдите, чтобы оценивать обсуждения.": "Sign in to rate discussions.",
  "Обновите схему сообщества: модуль оценок форума ещё не установлен.":
    "Update the community schema: the forum ratings module is not installed yet.",
  "Используйте изображение JPG, PNG или WebP.": "Use a JPG, PNG or WebP image.",
  "Размер аватара не должен превышать 2 МБ.": "Your avatar must not exceed 2 MB.",
  "Аватар не загрузился. Проверьте миграцию хранилища профилей.":
    "The avatar could not be uploaded. Check the profile-storage migration.",
  "Изображение загружено, но профиль не обновился.":
    "The image was uploaded, but the profile could not be updated.",
  "Аватар обновлён.": "Avatar updated.",
  "Профиль не удалось сохранить.": "The profile could not be saved.",
  "Биография сохранена. Для подборок примените новую миграцию профиля.":
    "Your biography has been saved. Apply the new profile migration to enable reading lists.",
  "Профиль и литературные интересы сохранены.":
    "Your profile and literary interests have been saved.",
  "Не удалось обработать жалобу.": "The report could not be processed.",
  "Комментарий скрыт, жалоба закрыта.": "The comment was hidden and the report closed.",
  "Комментарий оставлен, жалоба закрыта.": "The comment was retained and the report closed.",
  "Войдите, чтобы передать публикацию модератору.": "Sign in to send a post to a moderator.",
  "Пользователь просит редакцию проверить эту публикацию форума.":
    "A user has asked the editorial team to review this forum post.",
  "Жалобу не удалось отправить. Проверьте миграцию модерации форума.":
    "The report could not be sent. Check the forum-moderation migration.",
  "Публикация передана редактору на проверку.": "The post has been sent to an editor for review.",
  "Не удалось обработать жалобу форума.": "The forum report could not be processed.",
  "Публикация форума скрыта, жалоба закрыта.": "The forum post was hidden and the report closed.",
  "Публикация оставлена, жалоба закрыта.": "The post was retained and the report closed.",
  "Моя библиотека": "My library",
  "Сохранённые материалы": "Saved items",
  "Сохранённый материал": "Saved item",
  "Статус чтения": "Reading status",
  "Хочу прочитать": "Want to read",
  Читаю: "Reading",
  Прочитано: "Finished",
  "Удалить из библиотеки": "Remove from library",
  "Нажмите оранжевое сердце у статьи или книги - материал появится здесь.":
    "Select the orange heart beside an article or book to save it here.",
  "Литературная траектория": "Your literary journey",
  "Страны и писатели, новые материалы о которых вы хотите отслеживать.":
    "Countries and writers whose new publications you want to follow.",
  "Отменить подписку": "Unfollow",
  Раздел: "Section",
  "Подписки добавляются в карточках стран и писателей.":
    "Follow countries and writers from their profile cards.",
  "Клуб читателей": "Readers’ club",
  "Говорилка - форум «Проба Пера»": "The Proba Pera forum",
  "Редакция «Пробы Пера»": "Proba Pera editorial team",
  "Личный кабинет «Пробы Пера»": "Your Proba Pera account",
  "Разделы сообщества": "Community sections",
  Профиль: "Profile",
  "Панель редакции": "Editorial dashboard",
  "Сообщество готово к подключению": "The community is ready to connect",
  "Интерфейс, защищённая схема профилей, форума, комментариев и рейтингов уже подготовлены. Для общей работы пользователей нужно указать публичные параметры проекта Supabase.":
    "The interface and secure schemas for profiles, the forum, comments and ratings are ready. Add the project’s public Supabase settings to enable shared community features.",
  "До подключения формы не сохраняют персональные данные.":
    "Forms do not store personal data until the connection is enabled.",
  "Проверяем сессию…": "Checking your session…",
  "Только для редакции": "Editorial access only",
  "Панель сообщества": "Community dashboard",
  "Внутренняя статистика и очередь модерации без рекламных счётчиков и сторонних комментариев.":
    "Internal statistics and the moderation queue, with no advertising trackers or third-party comments.",
  Обновить: "Refresh",
  "Требует решения": "Needs a decision",
  "Жалобы читателей": "Reader reports",
  Публикация: "Post",
  Оставить: "Keep",
  Скрыть: "Hide",
  "Открытых жалоб нет.": "There are no open reports.",
  "Жалобы на темы и ответы": "Reports on topics and replies",
  Тема: "Topic",
  Ответ: "Reply",
  "Открытых жалоб на форум нет.": "There are no open forum reports.",
  "Последняя активность": "Recent activity",
  записей: "entries",
  "Тема форума": "Forum topic",
  "Ответ форума": "Forum reply",
  Вернуть: "Restore",
  "Активность появится после запуска сообщества.": "Activity will appear after the community launches.",
  "Читайте глубже. Обсуждайте уважительно.": "Read deeply. Discuss respectfully.",
  "Один профиль связывает ваши оценки, комментарии, форум и личную библиотеку внутри «Пробы Пера».":
    "One profile connects your ratings, comments, forum activity and personal library across Proba Pera.",
  "Комментарии и рейтинги без сторонних виджетов": "Comments and ratings without third-party widgets",
  "Обсуждения книг, статей и переводов": "Discussions about books, articles and translations",
  "Спокойная редакционная модерация": "Considered editorial moderation",
  "Ваши данные не используются для рекламного профилирования.":
    "Your data is not used for advertising profiles.",
  Здравствуйте: "Hello",
  "Теперь можно участвовать в обсуждениях, оценивать публикации и книги, сохранять историю комментариев.":
    "You can now join discussions, rate publications and books, and keep your comment history.",
  Почта: "Email",
  Статус: "Status",
  "Участник клуба читателей": "Readers’ club member",
  Аватар: "Avatar",
  "Профиль читателя": "Reader profile",
  "Репутация в клубе": "Club reputation",
  "Загрузка…": "Uploading…",
  "Сменить аватар": "Change avatar",
  "О себе": "About you",
  "Несколько слов о ваших читательских интересах": "A few words about your reading interests",
  "Любимые литературные страны": "Favourite literary countries",
  "Выберите страну": "Choose a country",
  Добавить: "Add",
  "Убрать из подборки": "Remove from selection",
  "Любимые писатели": "Favourite writers",
  "Выберите писателя": "Choose a writer",
  "Сначала выберите страну": "Choose a country first",
  "Сохранить профиль": "Save profile",
  "Перейти в форум": "Open forum",
  Выйти: "Sign out",
  "Новый читатель": "New reader",
  "С возвращением": "Welcome back",
  "Вступить в литературный клуб": "Join the literary club",
  "Войти в «Пробу Пера»": "Sign in to Proba Pera",
  "Никнейм в сообществе": "Community nickname",
  "Например, Читатель_ПП": "For example, Booklover_PP",
  "Электронная почта": "Email address",
  Пароль: "Password",
  "Скрыть пароль": "Hide password",
  "Показать пароль": "Show password",
  Показать: "Show",
  "Повторите пароль": "Repeat password",
  "Не менее 10 символов. Не используйте пароль от почты или социальных сетей.":
    "Use at least 10 characters. Do not reuse your email or social-media password.",
  "Я принимаю правила уважительного общения и обработку данных, необходимых для работы профиля.":
    "I accept the respectful-conduct rules and the processing of data required for my profile.",
  "Форма полностью готова. Регистрация включится после подключения серверных ключей проекта в GitHub Actions.":
    "The form is ready. Registration will be enabled after the project’s server keys are connected in GitHub Actions.",
  "Подождите…": "Please wait…",
  Зарегистрироваться: "Register",
  "Уже есть аккаунт - войти": "Already have an account? Sign in",
  "Нет аккаунта - зарегистрироваться": "No account yet? Register",
  "Разговор о литературе": "A conversation about literature",
  "Все темы": "All topics",
  "Войдите, чтобы открыть новую тему.": "Sign in to start a new topic.",
  "Новая тема": "New topic",
  "Разделы форума": "Forum sections",
  "Все обсуждения": "All discussions",
  "Найти обсуждение": "Find a discussion",
  "Книга, автор, тема или читатель": "Book, writer, subject or reader",
  Порядок: "Sort order",
  "Сначала новые": "Newest first",
  "По рейтингу": "By rating",
  "По числу ответов": "By reply count",
  Найдено: "Found",
  из: "of",
  "Передать модератору": "Report to a moderator",
  "Оценка обсуждения": "Discussion score",
  "Поддержать обсуждение": "Upvote discussion",
  "Снизить оценку обсуждения": "Downvote discussion",
  "Оценка ответа": "Reply score",
  "Полезный ответ": "Upvote reply",
  "Снизить оценку ответа": "Downvote reply",
  "Ответить по существу…": "Write a substantive reply…",
  "Отправить ответ": "Post reply",
  "Войдите, чтобы ответить": "Sign in to reply",
  "Раздел форума": "Forum section",
  "Название обсуждения": "Discussion title",
  "Текст обсуждения": "Discussion text",
  "Сформулируйте вопрос или тему…": "State your question or topic…",
  "Опубликовать тему": "Publish topic",
  рейтинг: "score",
  "Первое обсуждение ещё не открыто.": "No discussions have been started yet.",
  "Измените запрос или выберите другой раздел форума.": "Change your search or choose another forum section.",
  "Начните разговор о книге, авторе, переводе или экранизации.":
    "Start a conversation about a book, writer, translation or screen adaptation.",
  "В этой ветке пока нет тем. Откройте первое содержательное обсуждение.":
    "There are no topics in this section yet. Start the first thoughtful discussion.",
  "Книжный клуб": "Book club",
  "Совместное чтение и обсуждение книги месяца": "Read and discuss the book of the month together",
  "Впечатления, вопросы и внимательный разбор текста": "Impressions, questions and close reading",
  Классика: "Classics",
  "Произведения, выдержавшие проверку временем": "Works that have stood the test of time",
  "Современная литература": "Contemporary literature",
  "Новые книги, авторы и литературные явления": "New books, writers and literary developments",
  Поэзия: "Poetry",
  "Стихи, поэтика, чтения и переводы": "Poems, poetics, readings and translations",
  Переводы: "Translations",
  "Сравнение переводов и разговор о языке": "Comparing translations and discussing language",
  "Книга и экран: находки, потери и интерпретации": "Books on screen: discoveries, losses and interpretations",
  "Страны, писатели и маршруты мировой литературы": "Countries, writers and journeys through world literature",
  "Подборки читателей": "Readers’ lists",
  "Личные списки книг и тематические маршруты": "Personal book lists and thematic reading paths",
  "Вопрос редакции": "Ask the editors",
  "Предложения, уточнения и темы для материалов": "Suggestions, corrections and ideas for future publications",
  Читатели: "Readers",
  "Темы форума": "Forum topics",
  Комментарии: "Comments",
  Оценки: "Ratings",
  Просмотры: "Views",
  "Открытые жалобы": "Open reports",
  "Черновик сохранён на этом устройстве.": "Draft saved on this device.",
  "Редакционный JSON подготовлен.": "Editorial JSON prepared.",
  "Анонс для социальных сетей скопирован.": "Social-media summary copied.",
  "Не удалось скопировать автоматически - выделите текст вручную.":
    "Automatic copying failed. Select and copy the text manually.",
  "Редакционная мастерская": "Editorial workspace",
  "Черновик новой публикации": "New publication draft",
  "Форма сохраняет материал локально, проверяет обязательные поля и подготавливает JSON для публикационного архива.":
    "The form saves material locally, checks required fields and prepares JSON for the publication archive.",
  Заголовок: "Title",
  "Точный редакционный заголовок": "Final editorial title",
  "Краткое описание": "Short description",
  "Для карточки, поиска и социальных сетей": "For cards, search and social media",
  "Изображение и источник": "Image and source",
  "Источники и редакционные заметки": "Sources and editorial notes",
  "Название источника, ссылка, что именно подтверждает":
    "Source title, link and the claim it supports",
  "Текст статьи": "Article text",
  "<h2>Вступление</h2><p>Текст…</p>": "<h2>Introduction</h2><p>Text…</p>",
  "Предпросмотр карточки": "Card preview",
  "Заголовок будущей публикации": "Future publication title",
  "Краткое описание поможет читателю понять тему материала.":
    "A short description helps readers understand the subject.",
  "Содержательный заголовок": "Descriptive title",
  "SEO-описание не короче 80 знаков": "SEO description is at least 80 characters",
  "Указана иллюстрация": "Image provided",
  "Зафиксированы источники": "Sources recorded",
  "Основной текст готов": "Main text ready",
  "Экспортировать JSON": "Export JSON",
  "Скопировать анонс": "Copy summary",
  "Проба Пера · восстановление": "Proba Pera · recovery",
  "Страница столкнулась с ошибкой": "This page encountered an error",
  "Состояние сохранено в журнале редакции. Обновите страницу - публикации и ваша библиотека не пострадали.":
    "The error has been recorded in the editorial log. Refresh the page; your publications and library are safe.",
  "Обновить страницу": "Refresh page",
  "Пока нет опубликованных переводов на английский язык": "No English translations have been published yet",
  Удалить: "Remove",
  "из библиотеки": "from library",
  "в библиотеку": "to library",
  "Выбор редакции": "Editors’ picks",
  "Весь журнал": "Explore the journal",
  "Темы и разделы": "Topics and sections",
  "Специальный проект": "Special project",
  "Редакционные блоки": "Editorial blocks",
  "На главную": "Home",
  "Эта страница пока недоступна на английском языке": "This page is not available in English yet",
  "Редакция готовит проверенный перевод. Русский оригинал не выдаётся за английскую версию.":
    "The editorial team is preparing a reviewed translation. The Russian original is never presented as English.",
  Обновлено: "Updated",
  "Литературная экосистема, где страна, автор, книга и статья связаны.":
    "A literary ecosystem connecting countries, writers, books and articles.",
  "Вернуться на главную": "Return home",
  "Объявление редакции": "Editorial announcement",
  "Оформление блока": "Block appearance",
  Стиль: "Style",
  Фон: "Background",
  "Изображения баннера": "Banner images",
  ссылка: "link",
  Подробнее: "Learn more",
  Дополнительно: "More",
  "Социальные сети": "Social media",
  "адрес ожидает подключения": "link not configured",
  "Укажите адрес вашей страницы Boosty": "Add the URL of your Boosty page",
  "ВКонтакте": "VK",
  Дзен: "Dzen",
  Одноклассники: "Odnoklassniki",
  "Проверенный английский перевод справки о стране ещё готовится.":
    "A reviewed English translation of this country profile is being prepared.",
  "Тексты без проверенного перевода скрыты в английской версии.":
    "Text without a reviewed translation is hidden in the English version.",
  "Проверенный английский перевод биографии ещё готовится.":
    "A reviewed English translation of this biography is being prepared.",
  "Поделиться во ВКонтакте": "Share on VK",
  "Поделиться в Telegram": "Share on Telegram",
  "Поделиться в Одноклассниках": "Share on Odnoklassniki",
  "Поделиться материалом": "Share this publication",
  Поделиться: "Share",
  "Ссылка скопирована": "Link copied",
  "Копировать ссылку": "Copy link",
  "Нет сети - доступны уже открытые материалы": "Offline - previously opened publications remain available",
  "Доступна новая версия журнала": "A new version of the journal is available",
  "Дата рождения": "Date of birth",
  "Дата смерти": "Date of death",
  Прожил: "Lived",
  лет: "years",
  "Период жизни": "Lifetime",
  "Место рождения": "Place of birth",
  "Место смерти": "Place of death",
  Направление: "Movement",
  "Литературная эпоха": "Literary period",
  Языки: "Languages",
  "Связанные авторы": "Related writers",
  "Статьи на сайте ПРОБА ПЕРА": "Articles on PROBA PERA",
  "Нобелевская премия по литературе": "Nobel Prize in Literature",
  Биография: "Biography",
  "Главные произведения": "Major works",
  "Годы жизни": "Years lived",
  "Информация уточняется": "Details are being verified",
  "О писателе": "About the writer",
  Произведения: "Works",
  "Нет данных": "No data",
  "Статьи ПРОБА ПЕРА": "PROBA PERA articles",
  "Есть статья": "Article available",
  Готовится: "In preparation",
  "XIX век": "19th century",
  "XXI век": "21st century",
  "АВТОРЫ": "WRITERS",
  "АУДИТОРИИ": "AUDIENCES",
  "Активные фильтры": "Active filters",
  "Аудитория": "Audience",
  "Без связанной статьи": "No linked article",
  "В архиве нет книг по выбранным условиям": "No books in the archive match the selected filters",
  "В библиотеке": "In library",
  "Взрослые": "Adults",
  "Во всём журнале": "Across the journal",
  "Все авторы": "All writers",
  "Главный материал": "Featured article",
  "Далее": "Next",
  "Дети": "Children",
  "Для всех возрастов": "All ages",
  "Для детей": "For children",
  "До 1800 года": "Before 1800",
  "Есть связь со статьёй": "Linked to an article",
  "ЖАНРЫ": "GENRES",
  "Жанр": "Genre",
  "Жанры": "Genres",
  "Загруженная обложка": "Uploaded cover",
  "Закрыть фильтры": "Close filters",
  "Выберите книгу": "Choose a book",
  "Выбрать случайное произведение из всего архива":
    "Choose a random work from the entire archive",
  "Избранное": "Favourites",
  "Индекс связей пока недоступен": "Related-content index unavailable",
  "Используется редакционный индекс связей": "Using the editorial related-content index",
  "Используются только проверенные профили аудитории": "Only verified audience profiles are used",
  "КАТАЛОГ": "CATALOGUE",
  "КНИГИ": "BOOKS",
  "Книги из личной полки": "Books from your personal shelf",
  "МАТЕРИАЛЫ ЖУРНАЛА": "JOURNAL ARTICLES",
  "МОИ ПОЛКИ": "MY SHELVES",
  "Моя умная полка": "My smart shelf",
  "На этой полке пока нет книг": "There are no books on this shelf yet",
  "Назад": "Back",
  "Не удалось сохранить умную полку": "Could not save the smart shelf",
  "Недавно проверенные": "Recently reviewed",
  "Недоступно: проверенные профили аудитории отсутствуют": "Unavailable: no verified audience profiles",
  "Открыть книгу": "Open book",
  "Нажмите на корешок - книга выйдет вперёд, а справа откроются описание и сведения.":
    "Select a spine to bring the book forward and open its description and details.",
  "Перелистнуть страницу": "Turn page",
  "Открыть полку автора": "Open writer shelf",
  "ПЕРИОДЫ": "PERIODS",
  "ПОЛКА": "SHELF",
  "Период": "Period",
  "Период не подтверждён": "Period not verified",
  "По автору": "By writer",
  "По названию": "By title",
  "Подростки": "Teenagers",
  "Подсказки библиотеки": "Library suggestions",
  "Подсказки единого каталога": "Unified catalogue suggestions",
  "Полка пуста": "The shelf is empty",
  "Предыдущая книга": "Previous book",
  "Предыдущие 13 произведений": "Previous 13 works",
  "РЕДАКЦИОННЫЕ ПОЛКИ": "EDITORIAL SHELVES",
  "Расширенные фильтры": "Advanced filters",
  "Расширенные фильтры книжного архива": "Advanced book archive filters",
  "Редакционная релевантность": "Editorial relevance",
  "Редакционный порядок": "Editorial order",
  "Редакционный статус": "Editorial status",
  "Результаты поиска по библиотеке": "Library search results",
  "Результаты поиска по всему журналу": "Journal-wide search results",
  "Рецензия": "Review",
  "С обложкой": "With a cover",
  "СТРАНЫ": "COUNTRIES",
  "Сбросить": "Clear",
  "Сбросить фильтры": "Clear filters",
  "Свой точный отбор": "Your custom selection",
  "Связь со статьями": "Article links",
  "Следующая книга": "Next book",
  "Следующие 13 произведений": "Next 13 works",
  "Случайное произведение": "Random work",
  "Случайный выбор": "Random pick",
  "Сначала ранние": "Oldest first",
  "Сначала с обложкой": "Covers first",
  "Собираем виртуальную полку…": "Building the virtual shelf…",
  "Сортировка": "Sort",
  "Сохранить как умную полку": "Save as a smart shelf",
  "Текущая полка": "Current shelf",
  "Тип обложки": "Cover type",
  "Типографическая обложка": "Typographic cover",
  "Только книги из личной полки": "Only books from your personal shelf",
  "Только обложки с разрешёнными правами": "Only covers cleared for use",
  "Только подтверждённая аудитория": "Verified audience only",
  "Точный отбор": "Custom selection",
  "Трёхмерная полка недоступна. Открыт безопасный каталог.": "The 3D shelf is unavailable. The safe catalogue is open.",
  "Удалить фильтр": "Remove filter",
  "Умная полка": "Smart shelf",
  "Умная полка сохранена": "Smart shelf saved",
  "Упоминание": "Mention",
  "Фильтры применяются по правилу И между категориями и ИЛИ внутри категории. Непроверенные метаданные не угадываются.": "Filter categories use AND, while options within a category use OR. Unverified metadata is never inferred.",
  "Язык": "Language",
  "совпадений": "matches",
  "роман": "novel",
  "повесть": "novella",
  "рассказ": "short story",
  "поэзия": "poetry",
  "драма": "drama",
  "эссе": "essay",
  "мемуары": "memoir",
  "биография": "biography",
  "эпос": "epic",
  "сатира": "satire",
  "басня": "fable",
  "сказка": "fairy tale",
  "фольклор": "folklore",
  "научная фантастика": "science fiction",
  "фэнтези": "fantasy",
  "детектив": "detective fiction",
  "приключенческая проза": "adventure fiction",
  "историческая проза": "historical fiction",
  "философия": "philosophy",
  "детская литература": "children's literature",
  "подростковая литература": "young adult literature",
  "литературная критика": "literary criticism",
  "журналистика": "journalism",
  "русский": "Russian",
  "английский": "English",
  "французский": "French",
  "немецкий": "German",
  "испанский": "Spanish",
  "итальянский": "Italian",
  "португальский": "Portuguese",
  "арабский": "Arabic",
  "китайский": "Chinese",
  "японский": "Japanese",
  "польский": "Polish",
  "чешский": "Czech",
  "шведский": "Swedish",
  "норвежский": "Norwegian",
  "датский": "Danish",
  "нидерландский": "Dutch",
  "венгерский": "Hungarian",
  "турецкий": "Turkish",
  "бенгальский": "Bengali",
  "латинский": "Latin",
  "древнегреческий": "Ancient Greek",
  "греческий": "Greek",
  "украинский": "Ukrainian",
  "белорусский": "Belarusian",
  "армянский": "Armenian",
  "грузинский": "Georgian",
  "персидский": "Persian",
  "иврит": "Hebrew",
  "корейский": "Korean",
  "финский": "Finnish",
  "исландский": "Icelandic",
  "румынский": "Romanian",
  "сербский": "Serbian",
  "хорватский": "Croatian",
  "болгарский": "Bulgarian",
  "азербайджанский": "Azerbaijani",
  "казахский": "Kazakh",
  "узбекский": "Uzbek",
  "Читаю сейчас": "Reading now",
  "Куратор: редакция «Пробы пера» · проверенные произведения":
    "Curated by the Proba Pera editors · reviewed works",
  "Классика архива": "Archive classics",
  "Куратор: редакция «Пробы пера» · проверенная классика архива":
    "Curated by the Proba Pera editors · reviewed archive classics",
  Архив: "Archive",
  "Редакционные полки": "Editorial shelves",
  "Мои полки": "My shelves",
  "Новая полка": "New shelf",
  "Не удалось создать личную полку": "Could not create the personal shelf",
  Периоды: "Periods",
  "Только сохранённые книги": "Saved books only",
  "Поиск временно недоступен": "Search is temporarily unavailable",
  "Книги на полке сохранены без изменений.":
    "The books on this shelf remain unchanged.",
  "Повторить поиск": "Retry search",
  "Подсказки всего книжного архива": "Complete book archive suggestions",
  "Результаты поиска по всему книжному архиву":
    "Complete book archive search results",
  "Результаты поиска по текущей полке": "Current shelf search results",
  "Открыты сведения о книге": "Book details open",
  "Состояние книжной полки": "Bookshelf status",
  "Весь книжный архив": "Complete book archive",
  "Пока нет полок": "No shelves yet",
  "Подборка обновляется": "Updating selection",
  "Пока пусто": "Empty for now",
  "Настроить полку": "Customise shelf",
  Качество: "Quality",
  "Качество трёхмерной полки": "3D shelf quality",
  "Некоторые книги больше недоступны в архиве":
    "Some books are no longer available in the archive",
  "Удалить ссылку": "Remove link",
  "Редакционная ссылка недоступна": "Editorial link unavailable",
  "Свернуть сведения о книге": "Collapse book details",
  "Развернуть сведения о книге": "Expand book details",
  "Сведения о книге": "Book details",
  "Показать полностью": "Show in full",
  Свернуть: "Collapse",
  "Навигация по редакционным страницам": "Editorial page navigation",
  "Предыдущая страница": "Previous page",
  "Следующая страница": "Next page",
  "Управлять полками": "Manage shelves",
  "Добавить на полку": "Add to shelf",
  "В избранном": "In favourites",
  "В избранное": "Add to favourites",
  "Эта полка ждёт первую книгу": "This shelf is waiting for its first book",
  "Откройте весь архив, найдите произведение и добавьте его на эту полку.":
    "Open the complete archive, find a work and add it to this shelf.",
  "Попробуйте другое название, автора, страну или сбросьте фильтры.":
    "Try another title, writer or country, or clear the filters.",
  "Выбрать книгу из архива": "Choose a book from the archive",
  "Вернуться ко всему архиву": "Return to the complete archive",
  "Открыть весь архив": "Open the complete archive",
  "Первая книга": "First book",
  "Позиция на книжной полке": "Position on the bookshelf",
  "Последняя книга": "Last book",
  "Личная библиотека": "Personal library",
  "Отметьте полки, на которых должна находиться книга.":
    "Select the shelves where this book should appear.",
  "Доступные полки": "Available shelves",
  "Создайте первую личную полку для этой книги.":
    "Create your first personal shelf for this book.",
  "Умные и редакционные полки обновляются автоматически.":
    "Smart and editorial shelves update automatically.",
  "Новая личная полка": "New personal shelf",
  "Например, Русская классика": "For example, Russian classics",
  "Создать и добавить": "Create and add",
  "Введите корректное название длиной до 120 символов.":
    "Enter a valid name of up to 120 characters.",
  "Не удалось сохранить изменение. Попробуйте ещё раз.":
    "Could not save the change. Please try again.",
  "Проверьте название и настройки полки.": "Check the shelf name and settings.",
  "Закрыть настройки полки": "Close shelf settings",
  "Оформление и порядок этой полки видны только вам.":
    "Only you can see this shelf's appearance and order.",
  Название: "Name",
  Описание: "Description",
  "(необязательно)": "(optional)",
  "Знак полки": "Shelf symbol",
  "Фон полки": "Shelf background",
  "Подстраивать оформление под выбранную книгу":
    "Adapt the appearance to the selected book",
  "Интенсивность оформления": "Styling intensity",
  "Сохранение…": "Saving…",
  "Сохранить настройки": "Save settings",
  "Книги на полке": "Books on this shelf",
  "Книга недоступна в текущем архиве":
    "This book is unavailable in the current archive",
  "Автор не указан": "Writer not specified",
  Переместить: "Move",
  "в начало": "to the beginning",
  "В начало": "To beginning",
  выше: "up",
  Выше: "Up",
  ниже: "down",
  Ниже: "Down",
  "в конец": "to the end",
  "В конец": "To end",
  Убрать: "Remove",
  "с полки": "from shelf",
  "Убрать с полки": "Remove from shelf",
  "На этой полке пока нет книг.": "There are no books on this shelf yet.",
  "Состав умной полки формируется автоматически по сохранённым фильтрам.":
    "This smart shelf is populated automatically from its saved filters.",
  "Удалить полку": "Delete shelf",
  "Книги останутся в архиве.": "The books will remain in the archive.",
  Отмена: "Cancel",
  "Удаление…": "Deleting…",
  "Удалить окончательно": "Delete permanently",
  "Не удалось подключить редакционный архив. Попробуйте ещё раз.":
    "Could not connect to the editorial archive. Please try again.",
  "Редакционный архив временно недоступен":
    "The editorial archive is temporarily unavailable",
  "Литературную планету не удалось открыть": "Literary Planet could not be opened",
  "Глобус загрузится при приближении": "The globe will load as you approach",
  "Повторить загрузку": "Retry loading",
  "Книжный архив временно недоступен":
    "The book archive is temporarily unavailable",
  "Книжный архив загрузится при приближении":
    "The book archive will load as you approach",
  "Место полки уже зарезервировано, поэтому страница не сдвинется.":
    "The shelf space is already reserved, so the page will not shift.",
  "Авторский архив временно недоступен":
    "The editorial archive is temporarily unavailable",
  "Журнал загрузится при приближении": "The journal will load as you approach",
  "Место журнала зарезервировано до его открытия.":
    "The journal space is reserved until it opens.",
  "Архив не удалось подключить": "The archive could not be connected",
  "Подключаем единый поиск…": "Connecting unified search…",
  "Проверьте соединение и повторите загрузку.":
    "Check your connection and retry loading.",
  "Готовим страны, авторов, книги и публикации.":
    "Preparing countries, writers, books and publications.",
  "Писатель не найден": "Writer not found",
  "В моей библиотеке": "In my library",
  "Сохранённые книги независимо от статуса чтения":
    "Saved books regardless of reading status",
};

export type InterfaceTranslationAudit = {
  registered: number;
  missingRussian: string[];
  missingEnglish: string[];
};

export function auditInterfaceTranslations(): InterfaceTranslationAudit {
  const entries = Object.entries(englishInterfaceText);
  return {
    registered: entries.length,
    missingRussian: entries
      .filter(([russianText]) => !russianText.trim())
      .map(([russianText]) => russianText),
    missingEnglish: entries
      .filter(([, englishText]) => !englishText.trim())
      .map(([russianText]) => russianText),
  };
}

export function assertInterfaceTranslationsComplete() {
  const audit = auditInterfaceTranslations();
  if (!audit.missingRussian.length && !audit.missingEnglish.length) return audit;
  throw new Error(
    `Incomplete interface translations: ${[
      ...audit.missingRussian.map((text) => `missing Russian key: ${text}`),
      ...audit.missingEnglish.map((text) => `missing English text: ${text}`),
    ].join(", ")}`
  );
}

export function hasInterfaceTranslation(russianText: string) {
  return Object.prototype.hasOwnProperty.call(englishInterfaceText, russianText);
}

function registeredEnglishText(russianText: string) {
  if (!hasInterfaceTranslation(russianText)) return null;
  const englishText = englishInterfaceText[russianText];
  if (!englishText.trim()) {
    throw new Error(`Missing English interface translation for: ${russianText}`);
  }
  return englishText;
}

assertInterfaceTranslationsComplete();

function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === "ru" || value === "en";
}

export function resolveInitialInterfaceLanguage(
  storedLanguage: unknown,
  routeLanguage: unknown
): InterfaceLanguage {
  if (isInterfaceLanguage(routeLanguage)) return routeLanguage;
  return isInterfaceLanguage(storedLanguage) ? storedLanguage : "ru";
}

function initialLanguage(): InterfaceLanguage {
  if (typeof window === "undefined") return "ru";
  return resolveInitialInterfaceLanguage(
    window.localStorage.getItem(STORAGE_KEY),
    document.documentElement.dataset.routeLanguage
  );
}

function applyLanguage(language: InterfaceLanguage) {
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
}

type InterfaceLanguageContextValue = {
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
  t: (russianText: string) => string;
  countryName: (code: string | undefined, russianName: string) => string;
  number: (value: number) => string;
};

const InterfaceLanguageContext =
  createContext<InterfaceLanguageContextValue | null>(null);

export function InterfaceLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLocalLanguage] =
    useState<InterfaceLanguage>(initialLanguage);

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const nextLanguage = (event as CustomEvent<InterfaceLanguage>).detail;
      if (isInterfaceLanguage(nextLanguage)) setLocalLanguage(nextLanguage);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isInterfaceLanguage(event.newValue)) {
        setLocalLanguage(event.newValue);
      }
    };
    window.addEventListener(EVENT_NAME, syncLanguage);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, syncLanguage);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: InterfaceLanguage) => {
    setLocalLanguage(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    applyLanguage(nextLanguage);
    window.dispatchEvent(
      new CustomEvent<InterfaceLanguage>(EVENT_NAME, {
        detail: nextLanguage,
      })
    );
  }, []);

  const t = useCallback(
    (russianText: string) => {
      observedInterfaceSourceText.add(russianText);
      const fallback =
        language === "ru"
          ? russianText
          : registeredEnglishText(russianText) ?? russianText;
      if (russianText === "Страны с проверенными карточками") {
        const legacyOverride = getSiteCopy(
          "interface.Есть проверенные карточки",
          "",
          language
        );
        return getSiteCopy(
          `interface.${russianText}`,
          legacyOverride || fallback,
          language
        );
      }
      return getSiteCopy(
        `interface.${russianText}`,
        fallback,
        language
      );
    },
    [language]
  );

  const regionNames = useMemo(() => {
    if (typeof Intl.DisplayNames === "undefined") return null;
    return new Intl.DisplayNames([language], { type: "region" });
  }, [language]);

  const countryName = useCallback(
    (code: string | undefined, russianName: string) => {
      const normalizedCode = (code || "").trim().toUpperCase();
      const localized = /^[A-Z]{2}$/u.test(normalizedCode)
        ? regionNames?.of(normalizedCode)
        : undefined;
      return getCountrySiteCopy(
        normalizedCode,
        russianName,
        localized && localized !== normalizedCode ? localized : undefined,
        language
      );
    },
    [language, regionNames]
  );

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-GB"),
    [language]
  );

  const number = useCallback(
    (value: number) => numberFormatter.format(value),
    [numberFormatter]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, countryName, number }),
    [countryName, language, number, setLanguage, t]
  );

  return (
    <InterfaceLanguageContext.Provider value={value}>
      {children}
    </InterfaceLanguageContext.Provider>
  );
}

export function useInterfaceLanguage() {
  const value = useContext(InterfaceLanguageContext);
  if (!value) {
    throw new Error(
      "useInterfaceLanguage must be used inside InterfaceLanguageProvider"
    );
  }
  return value;
}

export function translateInterfaceText(
  russianText: string,
  language: InterfaceLanguage
) {
  observedInterfaceSourceText.add(russianText);
  const fallback =
    language === "ru"
      ? russianText
      : registeredEnglishText(russianText) ?? russianText;
  return getSiteCopy(`interface.${russianText}`, fallback, language);
}

export function selectInterfacePlural(
  count: number,
  language: InterfaceLanguage,
  forms: readonly [string, string, string]
) {
  if (language === "en") return count === 1 ? forms[0] : forms[2];
  const lastTwo = Math.abs(count) % 100;
  const last = Math.abs(count) % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}
