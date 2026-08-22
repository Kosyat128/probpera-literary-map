# Control inventory

## Baseline CSS inventory

Срез до UI Foundation по `src/index.css`:

| Свойство / группа | Число уникальных значений или правил |
|---|---:|
| `height` | 78 |
| `min-height` | 82 |
| `border-radius` | 23 |
| `padding` | 223 |
| `box-shadow` | 130 |
| `transition` | 66 |
| `border` | 125 |
| Focus rules | 83 |
| Orange literals | 18 |

Это инвентаризация причины для узкого foundation-layer, а не утверждение, что текущий PR должен механически устранить все значения.

## Foundation contract

- Control sizes: 36 / 44 / 48 px.
- Control radius: 4 px; round только для явно круглых icon controls.
- Focus: единый оранжевый outline/ring на keyboard focus.
- States: default, hover, focus-visible, active/pressed, disabled, loading.
- Motion: transitions только для визуальных свойств; reduced motion отключает их.
- Icons: локальные SVG, 24×24 viewBox, `currentColor`.

## Migrated families

1. Header search.
2. Reader/account.
3. RU/EN language controls.
4. Hero primary and secondary actions.
5. Atlas filters.
6. Atlas ranking actions.
7. Global search close/action graphics.
8. Globe zoom out/in.
9. Globe auto-rotate.
10. Globe reset.
11. Globe style controls.
12. Book of Month primary action.
13. Book of Month secondary action.
14. Book of Month source action.
15. Community actions.

Legacy families are not implicitly considered migrated.
