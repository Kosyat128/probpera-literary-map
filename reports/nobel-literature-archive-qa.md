# QA архива Нобелевской премии по литературе

Официальный источник: [Nobel Prize API](https://api.nobelprize.org/2.1/laureates?nobelPrizeCategory=lit&nobelPrizeYearFrom=1901&nobelPrizeYearTo=2025&limit=200), snapshot от 2026-08-09.

> Реестр проверяет структурированные поля награды; он не переписывает биографии и не выводит статус карточки из упоминания в тексте.

## Итог

- Официальных лауреатов 1901–2025: 122; лет вручения: 118.
- Локальных карточек: 125; уникальных official laureate ID: 122.
- Прежних пробелов `nobelYear`/award metadata закрыто: 77 из 77.
- Bio с упоминанием Nobel: 111; с явным годом: 108; без года: 3; неверных годов: 0.
- Официальных карточек без Nobel в bio: 14. Это допустимо: архив использует metadata.
- Production-записей, которым понадобился prose fallback: 0.
- Ложных/непривязанных bio-упоминаний: 0; непривязанных structured signals: 0.
- Блокирующих ошибок: 0.

## Дубли одной личности по странам

| Official ID | Лауреат | Локальные карточки |
| --- | --- | --- |
| 617 | Hermann Hesse | `germany:hermann_hesse`, `switzerland:hermann_hesse` |
| 747 | V. S. Naipaul | `india:v_s_naipaul`, `trinidad_and_tobago:vs_naipaul` |
| 817 | Doris Lessing | `england:doris_lessing`, `zimbabwe:doris_lessing` |

## Bio-утверждения без явного года

| Ключ | Лауреат | Подтверждённый год |
| --- | --- | --- |
| `india:rabindranath_tagore` | Рабиндранат Тагор | 1913 |
| `sweden:selma_lagerlof` | Сельма Лагерлёф | 1909 |
| `usa:sinclair_lewis` | Синклер Льюис | 1930 |

## Особые случаи

- Erik Axel Karlfeldt (604): `posthumous` — `sweden:erik_axel_karlfeldt`.
- Boris Pasternak (629): `accepted-then-forced-to-decline` — `russia:pasternak`.
- Jean-Paul Sartre (637): `declined` — `france:jean_paul_sartre`.

Четыре совместных премии представлены восемью official records с `portion=1/2`: 1904, 1917, 1966 и 1974.
