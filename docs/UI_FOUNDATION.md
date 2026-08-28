# UI Foundation

## Цель

Этот слой задаёт единый визуальный и интерактивный контракт для ключевых controls сайта «Проба Пера», не меняя фирменную заставку, логотип, оранжево-фиолетовую палитру, журнальную концепцию, старинный глобус как основной режим или структуру главной.

## Что входит

- семантические размеры controls: `36`, `44`, `48` px;
- общие radii для tight/control/panel/round;
- spacing `4/8/12/16/20` px;
- общие focus, hover, active, disabled и loading states;
- motion-safe transitions и `prefers-reduced-motion`;
- shared primitives `Button`, `IconButton`, `ActionLink`;
- локальные SVG-иконки с `currentColor`, без внешней UI-библиотеки;
- миграция ключевых controls шапки, hero, атласа, глобуса, глобального поиска, книги месяца и community;
- автоматические проверки размеров, состояний, RU/EN и responsive geometry.

## Что намеренно не входит

- новая сетка шапки/hero;
- замена или перекомпоновка заставки;
- изменение 3D-сцены, географии, камеры, маркеров или основного режима глобуса;
- новая архитектура панели страны;
- перестройка секций и карточек главной;
- изменение Supabase, CMS, admin, SEO или routing;
- массовая миграция каждого legacy-control.

Открытые вопросы этих областей перечислены в [`reports/ui-ux-audit.md`](../reports/ui-ux-audit.md) и разнесены по отдельным этапам.

## Токены

Токены определены в `:root` файла `src/index.css`.

| Группа | Токены |
|---|---|
| Размеры | `--ui-control-sm`, `--ui-control-md`, `--ui-control-lg` |
| Радиусы | `--ui-radius-tight`, `--ui-radius-control`, `--ui-radius-panel`, `--ui-radius-round` |
| Отступы | `--ui-space-1` … `--ui-space-5` |
| Motion | `--ui-transition-fast`, `--ui-transition-base` |
| Focus | `--ui-focus-color`, `--ui-focus-ring` |
| Primary | `--ui-primary`, `--ui-primary-hover`, `--ui-primary-active` |
| Muted text | `--ui-text-muted-light`, `--ui-text-muted-dark` |

Токены переиспользуют существующую бренд-палитру. Новая цветовая система не вводится.

## Primitives

### `Button`

```tsx
<Button
  variant="primary"
  size="md"
  startIcon={<BrandSearchIcon />}
  loading={isLoading}
>
  Найти
</Button>
```

### `IconButton`

`aria-label` обязателен на уровне TypeScript.

```tsx
<IconButton
  aria-label="Закрыть поиск"
  icon={<BrandCloseIcon />}
  size="md"
  variant="secondary"
/>
```

### `ActionLink`

```tsx
<ActionLink
  href="#atlas"
  variant="primary"
  size="lg"
  endIcon={<BrandArrowIcon />}
>
  Открыть карту
</ActionLink>
```

Варианты: `primary`, `secondary`, `text`. Размеры: `sm`, `md`, `lg`. Для светлых и тёмных поверхностей используется явный surface contract.

## Состояния

- Hover меняет цвет/фон без изменения геометрии.
- Focus-visible использует общий контрастный ring; в контракт включён `summary`.
- Active/pressed визуально отличается от hover.
- Disabled сохраняет читаемость и исключает interaction.
- Loading сохраняет размеры control, скрывает label/icon только визуально и показывает spinner.
- При `prefers-reduced-motion: reduce` transitions и spinner animation отключаются.
- При `forced-colors: active` focus и границы остаются видимыми.

## Иконки

Использованные функциональные иконки лежат в `src/components/Brand*Icon.tsx`. Они имеют `viewBox="0 0 24 24"`, используют `currentColor` и не содержат текстовых символов Unicode вместо графики.

## Мигрированные controls

- шапка: поиск, reader/account, RU/EN;
- hero: primary/secondary CTA;
- атлас: поиск, фильтры и ranking controls;
- глобальный поиск: close, search и book placeholders;
- глобус: zoom out/in, auto-rotate, reset и три style controls;
- книга месяца: primary, secondary и source link;
- community: две основные CTA.

Legacy controls вне этого списка остаются совместимыми и будут мигрироваться только в своих будущих этапах.

## Responsive и accessibility contract

- Foundation controls используют `36/44/48` px; coarse-pointer правила поднимают ключевые интерактивные targets до 44 px.
- Иконки не заменяют accessible name; icon-only controls требуют `aria-label`.
- RU/EN и widths `320`, `360`, `390`, `430`, `768`, `1024`, `1366`, `1440`, `1920` входят в E2E geometry matrix.
- Проверяются document overflow, minimum control geometry, rectangular primary control, hover, focus, pressed, loading и reduced motion.

## Доказательства

- До изменений: `docs/ui-foundation-artifacts/before/`.
- После изменений: `docs/ui-foundation-artifacts/after/`.
- Исходный этап 0: `docs/ux-audit-main-329a3dc/` хранится локально как исходный пакет аудита, но не входит целиком в UI Foundation PR; нормализованный итог находится в `reports/ui-ux-audit.md`.

## Проверки

```text
npm run typecheck
npm test -- src/ui/uiFoundation.test.tsx src/components/globeAccessibility.test.ts src/components/globeStarfieldPresentation.test.ts
npx playwright test tests/e2e/ui-foundation.spec.mjs --project=desktop-chromium --workers=1
npm run build:domain
npm run performance:audit
```

`tests/e2e/ui-foundation.spec.mjs` - geometry/state contract, а не окончательный screenshot-baseline. Полный deterministic visual baseline остаётся отдельным этапом Final QA.

## Baseline и размер production artifact

Исходная сборка этапа 0 на `329a3dce`:

- 992 Vite modules;
- `113,760,576 / 114,819,072` bytes;
- main JS `581,775` bytes, gzip `132,782` bytes;
- domain audit `11,319 / 11,319`;
- SEO audit `5,262` checks, 0 warnings/errors.

Изолированное сравнение после rebase на актуальный `main` `a0005a06`:

- Vite modules: `1000` → `1011`;
- production artifact: `113,943,475` → `113,951,675 / 114,819,072` bytes (`+8,200`);
- main JS: `586,971` → `589,404` bytes (`+2,433`);
- main JS gzip: `134,652` → `135,342` bytes (`+690`);
- domain audit `11,319 / 11,319`;
- SEO audit `5,262` checks, 0 warnings/errors.

Лимит не повышался. В финальном production artifact осталось `867,397` bytes запаса.

## Review policy

UI Foundation публикуется отдельным PR. Он не объединяется с Header + Hero, Immersive Literary Planet, Globe UX Polish, Homepage Structure или Final QA и не получает автоматический merge.
