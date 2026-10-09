# Граница охвата R3

Наследованная карта ниже — начальный inventory R2, не исчерпывающий актуальный список endpoints. R3 повторно подтвердил main SHA, изучил дополнительные пути SOURCE_REVIEW_R3.json. Codex строит полный actual route/action/RPC inventory по текущему рабочему дереву. Все авторизованные исполнения по-прежнему NOT_RUN.

# КАРТА ОХВАТА R3 FINAL

28 переходов известного registry и 12 дополнительных групп поверхностей сопоставлены с заданиями. Это карта требований, не доказательство, что каждый файл/вариант экрана был испытан. BASELINE_R1 — наследованный разбор; DEEP — углублённое чтение указанных обработчиков/схем в R2, а не всего раздела целиком; CONTRACT_RECHECK — обязательная проверка текущего HEAD. Для всех строк авторизованное исполнение/production: NOT_RUN. Полнота текущего route tree проверяется в M00; новые маршруты не игнорируются.

Нормализованные адреса здесь указаны без basePath; проверять фактическую конфигурацию standalone origin и /admin. Наличие ссылки или маршрута не доказывает права и корректность действия.

## Переходы registry

| Раздел | Адрес | Модули | Основание охвата |
|---|---|---|---|
| Обзор | /dashboard | M02 M03 M04 M17 | BASELINE_R1 |
| Статьи | /articles | M02 M05 M06 M07 M12 | BASELINE_R1 |
| Литературная сводка / существующая повестка | /literary-news | M10 M25 M01 | BASELINE_R1 |
| Новая статья | /articles/new | M05 M20 M24 | BASELINE_R1 |
| Студия данных | /data-studio | M03 M08 M21 | BASELINE_R1 |
| Произведения и издания | /library | M08 M11 M21 | BASELINE_R1 |
| Редакционные досье | /library/dossiers | M09 M20 | BASELINE_R1_PLUS_DEEP_SQL_R2 |
| Страны и авторы | /editorial-database | M08 M06 M12 | BASELINE_R1 |
| Premium English | /translations | M07 M03 M24 | BASELINE_R1 |
| Рубрики и теги | /categories | M21 M02 M13 | DEEP_ACTION_R2 |
| Медиатека | /media | M11 M23 | BASELINE_R1_PLUS_DEEP_API_R2 |
| Страницы | /pages | M19 M20 M06 | DEEP_ACTION_EDITOR_R2 |
| Главная страница | /homepage | M16 M22 M24 | BASELINE_R1 |
| Тексты сайта | /site-copy | M24 M07 M20 | DEEP_ACTION_R2 |
| Студия сайта | /site-studio | M16 M22 M24 | BASELINE_R1 |
| Компоненты сайта | /site-studio/components | M16 M12 | BASELINE_R1_CONTRACT_RECHECK |
| Токены дизайна | /site-studio/tokens | M16 M24 | BASELINE_R1_CONTRACT_RECHECK |
| Шрифты сайта | /site-studio/fonts | M16 M23 | BASELINE_R1_PLUS_DEEP_API_R2 |
| Выпуски дизайна | /site-studio/releases | M16 M22 M04 | DEEP_ACTION_R2 |
| Баннеры | /banners | M22 M11 M04 | DEEP_ACTION_RUNTIME_R2 |
| Меню | /menus | M22 M21 M12 | DEEP_ACTION_RUNTIME_R2 |
| Комментарии | /comments | M15 M02 | BASELINE_R1 |
| Статистика | /analytics | M14 M02 | BASELINE_R1 |
| Состояние сайта | /health | M03 M17 | BASELINE_R1_PLUS_DEEP_SQL_R2 |
| Публикация | /publication | M04 M17 | BASELINE_R1_PLUS_DEEP_OUTBOX_R2 |
| SEO и адреса | /seo | M13 M21 | BASELINE_R1 |
| Настройки | /settings | M01 M15 M03 | BASELINE_R1 |
| История изменений | /history | M06 M21 M22 | BASELINE_R1 |

## Дополнительные поверхности

| Поверхность | Адрес / группа | Модули | Основание охвата |
|---|---|---|---|
| Вход, второй фактор, восстановление | /login; /mfa; /reset-password | M01 M20 | BASELINE_R1 |
| Обмен auth callback | /auth/callback (наличие и контракт сверить) | M01 M20 | CONTRACT_RECHECK |
| Редактор статьи и alias перехода | /articles/[id]; /articles/edit | M05 M20 M24 | BASELINE_R1 |
| Предпросмотр статьи | /articles/[id]/preview | M05 M01 M11 | BASELINE_R1_CONTRACT_RECHECK |
| Редактор страницы | /pages/[id] | M19 M20 M02 | DEEP_ACTION_EDITOR_R2 |
| Предпросмотр страницы | /pages/[id]/preview | M19 M01 | CONTRACT_RECHECK |
| Серверное восстановление ввода | /editor-autosave; server actions | M20 M01 M17 | DEEP_ACTION_CONTROLLER_R2 |
| Экспорт аналитики | /analytics/export | M14 M01 | BASELINE_R1_CONTRACT_RECHECK |
| Поиск медиа API | /api/media/assets | M11 M01 M12 | TREE_CONFIRMED_CONTRACT_RECHECK |
| Загрузка изображений | /api/media/upload | M23 M11 M01 | DEEP_ROUTE_HANDLER_R2 |
| Загрузка шрифтов | /api/site-fonts/upload | M23 M16 M01 | DEEP_ROUTE_HANDLER_R2 |
| Серверные помощники и фоновые границы | visual-entity actions; templates; export; translations; social; cleanup | M00 M04 M07 M08 M17 M24 M25 | MIXED_SOURCE_AND_CONTRACT_RECHECK |

## Для каждой фактической записи карты M00 заполнить

Page/endpoint/action; сущность/локаль; чтение или запись; разрешённые роли; session/MFA gate; фактический DTO/валидатор; RPC/таблица/RLS/trigger; способ контроля версии; хранение правки/автокопии; публикационный адаптер; audit; зависимые объекты; состояние ошибки/пустоты; сценарий приёмки и результат. Не пересылать секреты/полные private payload для заполнения карты.


## Дополнительно прочитано в R3

| Источник | Путь | Область чтения | Исполнение |
|---|---|---|---|
| S01 | `apps/admin/app/auth/callback/route.ts` | full | NOT_RUN |
| S02 | `apps/admin/app/(auth)/reset-password/actions.ts` | full | NOT_RUN |
| S03 | `apps/admin/app/api/media/assets/route.ts` | full | NOT_RUN |
| S04 | `apps/admin/components/EditorMediaDialog.tsx` | lines 1–290 (complete returned component) | NOT_RUN |
| S05 | `apps/admin/app/(dashboard)/articles/[id]/preview/page.tsx` | full | NOT_RUN |
| S06 | `apps/admin/app/(dashboard)/seo/actions.ts` | lines 1–310 (complete returned file) | NOT_RUN |
| S07 | `apps/admin/app/(dashboard)/translations/resume-action.ts` | full | NOT_RUN |
| S08 | `supabase/migrations/20260901_zz_translation_operations_runtime.sql` | lines 300–690 | NOT_RUN |
| S09 | `apps/admin/app/(dashboard)/publication/actions.ts` | full | NOT_RUN |
| S10 | `apps/admin/app/(dashboard)/pages/[id]/preview/page.tsx` | full | NOT_RUN |
| S11 | `apps/admin/app/(dashboard)/translations/article-actions.ts` | lines 1–290 (complete returned file) | NOT_RUN |
| S12 | `apps/admin/lib/auto-translate-published-article-premium.ts` | lines 1–265; remainder not re-read | NOT_RUN |
| S13 | `supabase/migrations/20260901_zzz_admin_mutation_guards.sql` | lines 1–305; remainder not re-read | NOT_RUN |
| S14 | `apps/admin/lib/publication.ts` | lines 1–290 (complete returned file) | NOT_RUN |
