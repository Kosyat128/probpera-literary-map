# Writers database structure

Структура базы писателей:

```
src/data/writers/
├── russia/
│   ├── lev-tolstoy/
│   │   └── biography.ts
│   └── fyodor-dostoevsky/
│       └── biography.ts
├── europe/
├── asia/
├── america/
├── africa/
└── oceania/
```

Каждый писатель хранится отдельно:

- биография;
- годы жизни;
- страна;
- город;
- координаты на карте;
- произведения;
- фото;
- ссылки на статьи.

Страны используются как группы для фильтров карты.
