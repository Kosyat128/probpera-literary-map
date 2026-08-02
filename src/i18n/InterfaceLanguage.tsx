import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type InterfaceLanguage = "ru" | "en";

const STORAGE_KEY = "probpera-interface-language";
const EVENT_NAME = "probpera:interface-language";

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
  "Открыть единый поиск": "Open site search",
  Поиск: "Search",
  Войти: "Sign in",
  "Быстрая навигация": "Quick navigation",
  Книги: "Books",
  "Журнал о литературе и искусстве слова":
    "A journal about literature and the art of language",
  "Литература —": "Literature is",
  "это целый мир.": "a world of its own.",
  "Статьи, биографии, редкие книги и первая интерактивная литературная энциклопедия стран — в одном редакционном пространстве.":
    "Essays, biographies, rare books and an interactive literary encyclopedia of the world — in one editorial space.",
  "Открыть глобус": "Explore the globe",
  "Читать журнал": "Read the journal",
  стран: "countries",
  писателей: "writers",
  произведений: "works",
  "Журнал «Проба Пера»": "Proba Pera magazine",
  "Литературный журнал · с 2025 года": "Literary journal · since 2025",
  "Интерактивная энциклопедия": "Interactive encyclopedia",
  "Литературная карта мира": "Literary map of the world",
  "Выберите страну на старинном глобусе — откроются писатели, произведения, эпохи и проверенная редакционная справка.":
    "Choose a country on the antique globe to discover its writers, works, periods and editor-reviewed literary history.",
  "Найти страну": "Find a country",
  "Россия, Франция, Япония…": "Russia, France, Japan…",
  "Результаты поиска": "Search results",
  "Избранные архивы": "Featured archives",
  "Страна не найдена в выбранной коллекции.":
    "No country was found in this collection.",
  "Фильтры глобуса": "Globe filters",
  "Все страны": "All countries",
  "Нобелевские лауреаты": "Nobel laureates",
  "10+ авторов": "10+ writers",
  "С портретами": "With portraits",
  Проверено: "Reviewed",
  "Крупнейшие архивы": "Largest archives",
  "Музейный глобус · ручная навигация": "Museum globe · manual navigation",
  "В этой коллекции пока нет стран": "There are no countries in this collection yet",
  "Открываем мировой атлас…": "Opening the world atlas…",
  "Открываем архив…": "Opening the archive…",
  "Текстовый указатель стран": "Text index of countries",
  "Навигация по «Пробе Пера»": "Explore Proba Pera",
  "Все темы и разделы сайта": "All subjects and sections",
  "От редакционных статей до мировой литературной энциклопедии.":
    "From original essays to a world literary encyclopedia.",
  "Открыть интерактивный каталог": "Open the interactive directory",
  "Проба Пера в цифрах": "Proba Pera in numbers",
  публикаций: "publications",
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
  "Редкие издания, классика и современная литература — с контекстом и без лишних спойлеров.":
    "Rare editions, classics and contemporary books — with context and without unnecessary spoilers.",
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
  "Персонажи, сюжеты и образы устной традиции — от славянского фольклора до мировых мифологий.":
    "Characters, stories and imagery from oral traditions, from Slavic folklore to world mythology.",
  "История слов, точные значения и выразительные возможности русского языка без сухой словарной подачи.":
    "Word histories, precise meanings and the expressive possibilities of Russian, presented as living language.",
  "Необычные судьбы произведений, авторские замыслы, профессии писателей и культурные открытия.":
    "The unusual lives of books, writers’ ideas and professions, and cultural discoveries.",
  "Страны, национальные традиции и писатели, благодаря которым мировая литература говорит разными голосами.":
    "Countries, national traditions and the writers who give world literature its many voices.",
  "Книги связаны с авторами, странами, эпохами и статьями журнала — с фильтрами и редакционной проверкой обложек.":
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
  "В этом материале": "In this article",
  "Закрыть": "Close",
  "Материал читается как единое эссе.":
    "This publication is structured as a continuous essay.",
  слов: "words",
  "Режим печатной книги": "Printed book mode",
  "Авторская публикация журнала «Проба Пера»":
    "An original publication by Proba Pera",
  "Оригинал публикации ↗": "Original publication ↗",
  "Материал временно не открылся.": "This publication is temporarily unavailable.",
  "Прочитать оригинал на probpera.ru": "Read the original on probpera.ru",
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
  "С обложками": "With covers",
  "Изображения с указанным источником": "Images with documented sources",
  "До 1945 года": "Before 1945",
  "Опубликовано до 1945": "Published before 1945",
  "Ранние издания и классика": "Early works and classics",
  "После 1945 года": "After 1945",
  "Опубликовано после 1945": "Published after 1945",
  "Литература второй половины XX–XXI века": "Literature from the late 20th and 21st centuries",
  "Закрыть карточку книги": "Close book details",
  "Редакционная обложка": "Editorial cover for",
  "Редакционная обложка «Пробы Пера»": "Proba Pera editorial cover",
  "Редакционная обложка произведения": "Editorial cover for",
  "Иллюстрация из статьи о произведении": "Illustration from an article about",
  "Редакционная иллюстрация из связанной статьи · не является обложкой конкретного издания":
    "Editorial image from a related article · not the cover of a specific edition",
  "Проверено редакцией": "Editorially verified",
  "Редакционная карточка": "Editorial record",
  "Архивная запись": "Archive record",
  Автор: "Writer",
  Страна: "Country",
  "Первая публикация": "First published",
  "Язык оригинала": "Original language",
  "Произведение уже связано с автором и страной. Расширенная аннотация, история публикации и библиография находятся в редакционной очереди — неподтверждённые сведения здесь не публикуются.":
    "This work is already linked to its writer and country. The extended summary, publication history and bibliography remain in editorial review; unverified information is not published here.",
  "Темы и жанры книги": "Book subjects and genres",
  "Добавить в мою библиотеку": "Add to my library",
  "Открыть автора и страну": "Open writer and country",
  "Источник сведений": "Information source",
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
  "Единый каталог": "Unified catalogue",
  "Найти в «Пробе Пера»": "Search Proba Pera",
  "Закрыть поиск": "Close search",
  "Страна, писатель, книга, статья, эпоха…":
    "Country, writer, book, article, period…",
  "Поиск одновременно проверяет страны, писателей, произведения и редакционные публикации.":
    "Search countries, writers, works and editorial publications at once.",
  "Совпадений не найдено": "No matches found",
  "Попробуйте фамилию, название произведения или другую форму слова.":
    "Try a surname, a work title or another form of the word.",
  Страны: "Countries",
  Писатели: "Writers",
  "карточка автора": "writer profile",
  "Поиск выполняется внутри сайта": "Search stays within this website",
  "Интерактивный литературный глобус": "Interactive literary globe",
  "Карта временно недоступна": "The map is temporarily unavailable",
  "Проявляем старинную карту…": "Revealing the antique map…",
  "Используйте текстовый указатель стран ниже":
    "Use the country text index below",
  "Тяните, чтобы вращать": "Drag to rotate",
  "Колесо — масштаб": "Scroll to zoom",
  "Литературный архив": "Literary archive",
  "Закрыть панель": "Close panel",
  Столица: "Capital",
  "Литературное наследие страны": "The country’s literary heritage",
  "Эпохи и направления": "Periods and movements",
  "Биография в архиве": "Biography in the archive",
  "Карточка автора": "Writer profile",
  "Литературная традиция": "Literary tradition",
  "Справочная карточка · требует расширения":
    "Reference record · expansion required",
  "Расширенная биография готовится для энциклопедии.":
    "An extended biography is being prepared for the encyclopedia.",
  "Основные произведения": "Major works",
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
  "Спасибо — ваша оценка сохранена.": "Thank you — your rating has been saved.",
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
  "Выбор энциклопедии": "Encyclopedia selection",
  "Открываем библиотеку…": "Opening the library…",
  "Начните литературное путешествие с одного из ключевых произведений национальной традиции.":
    "Begin a literary journey with a defining work from this national tradition.",
  "Каждый день энциклопедия выбирает новое произведение из единой базы стран.":
    "Each day the encyclopedia selects a new work from the unified country archive.",
  "Темы книги": "Book subjects",
  "Редакционный стандарт": "Editorial standard",
  "Материал, которому можно доверять": "Material you can trust",
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
  "Статья заканчивается, разговор — продолжается":
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
  "Литературный журнал и мировая энциклопедия":
    "Literary journal and world encyclopedia",
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
  "Авторский архив · 157 материалов": "Editorial archive · 157 publications",
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
};

function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === "ru" || value === "en";
}

function initialLanguage(): InterfaceLanguage {
  if (typeof window === "undefined") return "ru";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isInterfaceLanguage(stored) ? stored : "ru";
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
    (russianText: string) =>
      language === "en"
        ? englishInterfaceText[russianText] || russianText
        : russianText,
    [language]
  );

  const regionNames = useMemo(() => {
    if (typeof Intl.DisplayNames === "undefined") return null;
    return new Intl.DisplayNames([language], { type: "region" });
  }, [language]);

  const countryName = useCallback(
    (code: string | undefined, russianName: string) => {
      if (language === "ru") return russianName;
      const normalizedCode = (code || "").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(normalizedCode)) return russianName;
      const localized = regionNames?.of(normalizedCode);
      return localized && localized !== normalizedCode ? localized : russianName;
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
  return language === "en"
    ? englishInterfaceText[russianText] || russianText
    : russianText;
}
