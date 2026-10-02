# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: controlled-pwa.spec.mjs >> saved Booky size survives a full persistent browser restart offline through the real Web preference port
- Location: tests\pwa\controlled-pwa.spec.mjs:1438:1

# Error details

```
Test timeout of 180000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - main [ref=e5]:
    - generic "Литературная планета" [ref=e7]:
      - generic [ref=e8]:
        - generic:
          - generic:
            - strong: Литературная планета
        - navigation "Литературная планета" [ref=e9]:
          - button "Фильтры глобуса" [ref=e10] [cursor=pointer]
          - button "Поиск по Литературной планете" [ref=e16] [cursor=pointer]
          - button "Меню" [ref=e22] [cursor=pointer]
      - generic [ref=e26]:
        - region "Интерактивный литературный глобус" [ref=e28]:
          - region "Интерактивный литературный глобус. Стрелки вращают, плюс и минус меняют масштаб, Home возвращает исходный вид." [ref=e29]:
            - status [ref=e33]
            - group "Управление глобусом" [ref=e34]:
              - button "Увеличить масштаб глобуса. Текущий масштаб 110%" [ref=e35] [cursor=pointer]
              - button "Уменьшить масштаб глобуса. Текущий масштаб 110%" [ref=e39] [cursor=pointer]
              - button "Вернуть исходный вид глобуса" [ref=e42] [cursor=pointer]
              - status: 110%
            - button "Автовращение отключено в режиме уменьшения движения" [disabled] [ref=e48]:
              - generic [ref=e52]: Пауза
            - generic [ref=e53]:
              - generic [ref=e54]:
                - generic [ref=e55]: Облик глобуса
                - combobox "Облик глобуса — выбрать издание" [ref=e56]:
                  - option "Бехайм · 1492"
                  - option "Хондиус · 1615"
                  - option "Коронелли · 1697"
                  - option "Шерер · 1700"
                  - option "Кассини · 1790"
                  - option "Rand · 1887" [selected]
                  - option "M-101 · 1943"
                  - option "NASA · Blue Marble"
                  - option "Natural Earth · 2026"
              - group [ref=e57]:
                - 'generic "Книжулик: как менять облики глобуса" [ref=e58] [cursor=pointer]': "?"
            - status [ref=e60]
            - generic:
              - status
        - complementary "Россия" [ref=e61]:
          - button "Развернуть архив страны" [ref=e62] [cursor=pointer]:
            - generic [ref=e63]:
              - generic [ref=e65]:
                - strong [ref=e66]: Россия
                - generic [ref=e67]: 53 автора
              - generic [ref=e68]: Открыть архив
    - group [ref=e72]:
      - generic "Подробнее" [active] [ref=e73] [cursor=pointer]:
        - status [ref=e74]:
          - strong [ref=e75]: Без сети
          - generic [ref=e76]: Доступ проверен ранее
  - 'button "Показать: Книжулик" [ref=e80] [cursor=pointer]': Книжулик
```