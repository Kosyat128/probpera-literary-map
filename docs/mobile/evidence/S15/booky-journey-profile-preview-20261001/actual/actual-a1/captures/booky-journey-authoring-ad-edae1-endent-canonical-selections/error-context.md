# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booky-journey-authoring.spec.mjs >> adult bilingual journey editor exports only a draft and clears dependent canonical selections
- Location: tests\host\booky-journey-authoring.spec.mjs:92:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: locator('[data-booky-journey-preview]').locator('[data-booky-preview-profile]').getByLabel('Уровень чтения для предпросмотра', { exact: true })
Expected: ""
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" with timeout 10000ms
  - waiting for locator('[data-booky-journey-preview]').locator('[data-booky-preview-profile]').getByLabel('Уровень чтения для предпросмотра', { exact: true })

```

```yaml
- main:
  - region "Границы черновика":
    - strong: Локальный черновик для взрослой аудитории
    - paragraph: Экспорт сохраняет файл на вашем устройстве. Изменения не записываются в базу или историю редакции. Тексты ещё требуют проверки; публикация, детский доступ и озвучка отключены.
  - group "Открыть локальный черновик"
  - region "Маршрут и условия":
    - heading "Маршрут и условия" [level=2]
    - text: Черновик · RU / EN Идентификатор маршрута
    - textbox "Идентификатор маршрута": synthetic-journey
    - text: Версия
    - spinbutton "Версия": "2"
    - text: Возраст от
    - spinbutton "Возраст от": "18"
    - text: Возраст до
    - spinbutton "Возраст до": "65"
    - text: Уровень чтения
    - combobox "Уровень чтения":
      - option "Простой" [selected]
      - option "Развивающийся"
      - option "Свободный"
    - text: Примерная длительность (мин)
    - spinbutton "Примерная длительность (мин)": "8"
    - paragraph: Условия задаёт редактор. Они не назначают возраст или уровень чтения пользователям.
    - text: Название маршрута (RU)
    - textbox "Название маршрута (RU)": Тестовый маршрут
    - text: Описание маршрута (RU)
    - textbox "Описание маршрута (RU)": Черновик для проверки редактора.
    - text: Название маршрута (EN)
    - textbox "Название маршрута (EN)": Synthetic journey
    - text: Описание маршрута (EN)
    - textbox "Описание маршрута (EN)": A draft for testing the editor.
  - list "Путь маршрута":
    - listitem:
      - region "1. Страна":
        - heading "1. Страна" [level=2]
        - text: Канонический выбор Страна
        - combobox "Страна":
          - option "Выберите страну"
          - option "Тестовая страна А" [selected]
          - option "Тестовая страна Б"
          - option "Тестовая страна В"
        - paragraph: Synthetic country A
        - text: Название шага «Страна» (RU)
        - textbox "Название шага «Страна» (RU)": Начните со страны
        - text: Подсказка шага «Страна» (RU)
        - textbox "Подсказка шага «Страна» (RU)": Откройте выбранную страну на глобусе.
        - group: Подпись и короткий текст
        - text: Название шага «Страна» (EN)
        - textbox "Название шага «Страна» (EN)": Start with the country
        - text: Подсказка шага «Страна» (EN)
        - textbox "Подсказка шага «Страна» (EN)": Open the selected country on the globe.
        - group: Caption and short text
    - listitem:
      - region "2. Писатель":
        - heading "2. Писатель" [level=2]
        - text: Канонический выбор Писатель
        - combobox "Писатель":
          - option "Выберите писателя"
          - option "Тестовый писатель А" [selected]
          - option "Тестовый писатель Б"
        - paragraph: Synthetic writer A
        - text: Название шага «Писатель» (RU)
        - textbox "Название шага «Писатель» (RU)": Перейдите к писателю
        - text: Подсказка шага «Писатель» (RU)
        - textbox "Подсказка шага «Писатель» (RU)": Откройте выбранного писателя.
        - group: Подпись и короткий текст
        - text: Название шага «Писатель» (EN)
        - textbox "Название шага «Писатель» (EN)": Go to the writer
        - text: Подсказка шага «Писатель» (EN)
        - textbox "Подсказка шага «Писатель» (EN)": Open the selected writer.
        - group: Caption and short text
    - listitem:
      - region "3. Книга":
        - heading "3. Книга" [level=2]
        - text: Канонический выбор Книга
        - combobox "Книга":
          - option "Выберите книгу"
          - option "Тестовая книга А" [selected]
        - paragraph: Synthetic work A
        - text: Название шага «Книга» (RU)
        - textbox "Название шага «Книга» (RU)": Откройте книгу
        - text: Подсказка шага «Книга» (RU)
        - textbox "Подсказка шага «Книга» (RU)": Перейдите к выбранной книге в коллекции.
        - group: Подпись и короткий текст
        - text: Название шага «Книга» (EN)
        - textbox "Название шага «Книга» (EN)": Open the book
        - text: Подсказка шага «Книга» (EN)
        - textbox "Подсказка шага «Книга» (EN)": Go to the selected book in the collection.
        - group: Caption and short text
    - listitem:
      - group "Необязательный факт · источники"
      - group "Необязательное задание · выбрать автора"
      - region "4. Завершение":
        - heading "4. Завершение" [level=2]
        - text: Завершение
        - paragraph: Завершение связано с выбранной книгой. Новая сущность каталога не создаётся.
        - text: Название шага «Завершение» (RU)
        - textbox "Название шага «Завершение» (RU)": Подведите итог
        - text: Подсказка шага «Завершение» (RU)
        - textbox "Подсказка шага «Завершение» (RU)": Отметьте завершение этого маршрута.
        - group: Подпись и короткий текст
        - text: Название шага «Завершение» (EN)
        - textbox "Название шага «Завершение» (EN)": Finish the journey
        - text: Подсказка шага «Завершение» (EN)
        - textbox "Подсказка шага «Завершение» (EN)": Mark this journey as complete.
        - group: Caption and short text
  - region "Предпросмотр маршрута":
    - heading "Предпросмотр маршрута" [level=2]
    - text: Взрослый черновик
    - paragraph: Просмотрите тексты шагов перед экспортом. Это локальный просмотр; он не запускает маршрут в приложении.
    - button "Предпросмотр маршрута"
    - group "Язык предпросмотра":
      - button "Русский" [pressed]
      - button "English"
    - paragraph: "Возраст: 18–65 лет · Уровень чтения: Простой · Оценка: 8 мин"
    - group:
      - text: Профиль предпросмотра
      - paragraph: Сравнение использует возраст и уровень чтения, заданные для этого черновика.
      - checkbox "Сравнить взрослый профиль" [checked]
      - text: Сравнить взрослый профиль Возраст для предпросмотра
      - spinbutton "Возраст для предпросмотра"
      - text: Уровень чтения для предпросмотра
      - combobox "Уровень чтения для предпросмотра":
        - option "Выберите уровень" [selected]
        - option "Простой"
        - option "Развивающийся"
        - option "Свободный"
    - status: Укажите целый возраст от 18 до 120 лет и выберите уровень чтения.
    - status: Шаг 3 из 4 · Книга
    - group:
      - text: Шаги маршрута (4)
      - list "Выбор шага предпросмотра":
        - listitem:
          - button "1. Страна"
        - listitem:
          - button "2. Писатель"
        - listitem:
          - button "3. Книга"
        - listitem:
          - button "4. Завершение"
    - article "Текст выбранного шага":
      - heading "Тестовый маршрут" [level=3]
      - paragraph: Черновик для проверки редактора.
      - paragraph: "Каноническая запись: Тестовая книга А"
      - paragraph: "Экран: Коллекция"
      - heading "Откройте книгу" [level=4]
      - text: Вариант текста предпросмотра
      - combobox "Вариант текста предпросмотра":
        - option "Полный текст" [selected]
        - option "Подпись"
        - option "Короткий текст"
      - paragraph: Перейдите к выбранной книге в коллекции.
    - navigation "Шаги предпросмотра":
      - button "Предыдущий шаг"
      - button "Следующий шаг"
  - region "Экспорт черновика":
    - status
    - paragraph: JSON содержит два языковых маршрута и восемь черновиков подсказок. Проверка формы не даёт редакционного одобрения.
    - button "Скачать черновик JSON"
```

# Test source

```ts
  95  |   page.on('download', value => downloads.push(value.suggestedFilename()));
  96  |   await page.addInitScript(() => {
  97  |     window.__previewProfileStorageWrites = [];
  98  |     const nativeStore = Storage.prototype.setItem;
  99  |     Storage.prototype.setItem = function(key, value) { window.__previewProfileStorageWrites.push({ key, local: this === localStorage }); return nativeStore.call(this, key, value); };
  100 |   });
  101 |   await page.route('**/*', async route => {
  102 |     const url = new URL(route.request().url());
  103 |     if (url.origin !== origin) { externalRequests.push(url.origin); return route.abort(); }
  104 |     if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/editor.css"></head><body><main id="root" style="padding:16px;max-width:1280px;margin:auto"></main><script src="/editor.js"></script></body></html>' });
  105 |     if (url.pathname === '/editor.js') return route.fulfill({ contentType: 'application/javascript', body: fixture.js });
  106 |     if (url.pathname === '/editor.css') return route.fulfill({ contentType: 'text/css', body: fixture.css });
  107 |     return route.fulfill({ status: 404, body: '' });
  108 |   });
  109 |   await page.setViewportSize({ width: 320, height: 844 });
  110 |   await page.goto(origin);
  111 |   const button = page.getByRole('button', { name: 'Скачать черновик JSON', exact: true });
  112 |   await expect(button).toBeVisible();
  113 |   if (await button.isEnabled()) await button.tap();
  114 |   expect(downloads).toEqual([]);
  115 |   const previewButton = page.getByRole('button', { name: 'Предпросмотр маршрута', exact: true });
  116 |   const preview = page.locator('[data-booky-journey-preview]');
  117 |   await previewButton.tap();
  118 |   await expect(preview).toHaveCount(0);
  119 |   for (const [label, value] of [
  120 |     ['Идентификатор маршрута', 'synthetic-journey'], ['Версия', '2'], ['Возраст от', '18'], ['Возраст до', '65'],
  121 |     ['Примерная длительность (мин)', '8'], ['Название маршрута (RU)', 'Тестовый маршрут'], ['Название маршрута (EN)', 'Synthetic journey'],
  122 |     ['Описание маршрута (RU)', 'Черновик для проверки редактора.'], ['Описание маршрута (EN)', 'A draft for testing the editor.'],
  123 |   ]) await page.getByLabel(label, { exact: true }).fill(value);
  124 |   await page.getByLabel('Уровень чтения', { exact: true }).selectOption('plain');
  125 |   const country = page.getByLabel('Страна', { exact: true }), writer = page.getByLabel('Писатель', { exact: true }), work = page.getByLabel('Книга', { exact: true });
  126 |   await country.selectOption('country-a'); await writer.selectOption('writer-a'); await work.selectOption('work-a');
  127 |   await writer.selectOption('writer-b');
  128 |   await expect(work).toHaveValue('');
  129 |   await expect(work.locator('option[value="work-a"]')).toHaveCount(0);
  130 |   await work.selectOption('work-b');
  131 |   await expect(page.getByText('Английское название пока не подтверждено', { exact: false }).first()).toBeVisible();
  132 |   await previewButton.tap();
  133 |   await expect(preview.getByRole('note')).toContainText('Английское имя писателя пока не подтверждено.');
  134 |   await preview.getByRole('button', {name:'English',exact:true}).tap();
  135 |   await preview.getByRole('button', {name: /^(?:Следующий шаг|Next step)$/}).tap();
  136 |   await expect(preview.locator('[data-preview-step="writer"]')).toContainText('English title is not confirmed');
  137 |   await expect(preview.locator('[data-preview-step="writer"]')).not.toContainText('Тестовый писатель Б');
  138 |   await country.selectOption('country-b');
  139 |   await expect(preview).toHaveCount(0);
  140 |   await expect(writer).toHaveValue(''); await expect(work).toHaveValue('');
  141 |   await expect(writer.locator('option[value="writer-a"]')).toHaveCount(0);
  142 |   await country.selectOption('country-a'); await writer.selectOption('writer-a'); await work.selectOption('work-a');
  143 |   await page.evaluate(() => window.scrollTo(0, 0));
  144 |   const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  145 |   expect(await overflow()).toBe(false);
  146 |   async function capture(filename, scope) {
  147 |     const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
  148 |     screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  149 |   }
  150 |   await capture('booky-journey-editor-ru-320.png', 'Actual editor component with synthetic canonical choices; upper form at 320px.');
  151 |   await previewButton.tap();
  152 |   const previous=preview.getByRole('button',{name: /^(?:Предыдущий шаг|Previous step)$/});
  153 |   const next=preview.getByRole('button',{name: /^(?:Следующий шаг|Next step)$/});
  154 |   await expect(previous).toBeDisabled();
  155 |   const overview=preview.locator('[data-booky-journey-step-overview]');
  156 |   const overviewSummary=overview.locator('summary');
  157 |   await expect(overview).not.toHaveAttribute('open','');
  158 |   await expect(overviewSummary).toHaveText('Шаги маршрута (4)');
  159 |   await overviewSummary.tap();
  160 |   await expect(overview.getByRole('button')).toHaveText(['1. Страна','2. Писатель','3. Книга','4. Завершение']);
  161 |   await expect(overview.locator('[aria-current="step"]')).toHaveCount(1);
  162 |   await expect(overview.locator('[data-preview-step-choice="country"]')).toHaveAttribute('aria-current','step');
  163 |   const overviewWork=overview.getByRole('button',{name:'3. Книга',exact:true});
  164 |   await overviewWork.focus(); await overviewWork.press('Enter'); await expect(overviewWork).toBeFocused();
  165 |   await expect(preview.locator('[data-preview-step="work"]')).toBeVisible();
  166 |   await expect(overviewWork).toHaveAttribute('aria-current','step');
  167 |   await overview.getByRole('button',{name:'1. Страна',exact:true}).tap();
  168 |   await expect(previous).toBeDisabled();
  169 |   await expect(overview.locator('[data-preview-step-choice="country"]')).toHaveAttribute('aria-current','step');
  170 |   for(const control of [overviewSummary,...await overview.getByRole('button').all()]) {
  171 |     const bounds=await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  172 |   }
  173 |   expect(await overflow()).toBe(false);
  174 |   await expect(preview.locator('[data-preview-step="country"]')).toContainText('Откройте выбранную страну на глобусе.');
  175 |   await next.tap();
  176 |   await expect(preview.locator('[data-preview-step="writer"]')).toContainText('Откройте выбранного писателя.');
  177 |   await next.tap();
  178 |   await expect(preview.locator('[data-preview-step="work"]')).toContainText('Перейдите к выбранной книге в коллекции.');
  179 |   const previewCopyView=preview.locator('[data-booky-preview-copy-view]');
  180 |   const previewCopy=preview.locator('[data-booky-preview-copy]');
  181 |   await expect(previewCopyView).toHaveValue('body');
  182 |   await expect(previewCopyView.locator('option')).toHaveText(['Полный текст','Подпись','Короткий текст']);
  183 |   await previewCopyView.selectOption('caption'); await expect(previewCopy).toHaveText('Откройте книгу');
  184 |   await previewCopyView.selectOption('reduced'); await expect(previewCopy).toHaveText('Откройте книгу');
  185 |   await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current','step');
  186 |   await previewCopyView.selectOption('body'); await expect(previewCopy).toHaveText('Перейдите к выбранной книге в коллекции.');
  187 |   const profilePanel=preview.locator('[data-booky-preview-profile]');
  188 |   const profileReport=preview.locator('[data-booky-preview-profile-report]');
  189 |   await expect(profilePanel).not.toHaveAttribute('open',''); await profilePanel.locator('summary').tap();
  190 |   const profileEnabledRu=profilePanel.getByRole('checkbox',{name:'Сравнить взрослый профиль',exact:true});
  191 |   await expect(profileEnabledRu).not.toBeChecked(); await expect(profileReport).toHaveCount(0);
  192 |   await profileEnabledRu.check();
  193 |   const profileAgeRu=profilePanel.getByLabel('Возраст для предпросмотра',{exact:true});
  194 |   const profileLevelRu=profilePanel.getByLabel('Уровень чтения для предпросмотра',{exact:true});
> 195 |   await expect(profileAgeRu).toHaveValue(''); await expect(profileLevelRu).toHaveValue('');
      |                                                                            ^ Error: expect(locator).toHaveValue(expected) failed
  196 |   await expect(profileReport).toHaveAttribute('data-profile-status','invalid');
  197 |   await expect(profileReport).toContainText('Укажите целый возраст от 18 до 120 лет и выберите уровень чтения.');
  198 |   await profileLevelRu.selectOption('plain');
  199 |   for(const [age,status] of [['18','matches'],['65','matches'],['66','outside'],['17','invalid'],['18.5','invalid'],['','invalid'],['30','matches']]) {
  200 |     await profileAgeRu.fill(age); await expect(profileReport).toHaveAttribute('data-profile-status',status);
  201 |     await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current','step');
  202 |     await expect(previewCopyView).toHaveValue('body'); await expect(previewCopy).toHaveText('Перейдите к выбранной книге в коллекции.');
  203 |   }
  204 |   await profileLevelRu.selectOption('developing');
  205 |   await expect(profileReport).toHaveAttribute('data-profile-status','outside');
  206 |   await expect(profileReport).toContainText('Уровень чтения отличается от заданного в черновике.');
  207 |   await profileLevelRu.selectOption('plain'); await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  208 |   for(const control of [profilePanel.locator('summary'),profileEnabledRu.locator('..'),profileAgeRu,profileLevelRu])
  209 |     expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  210 |   await profileEnabledRu.uncheck(); await expect(profileReport).toHaveCount(0); await profilePanel.locator('summary').tap();
  211 |   await preview.scrollIntoViewIfNeeded();
  212 |   expect(await overflow()).toBe(false);
  213 |   await capture('booky-journey-preview-ru-320.png','Actual local authoring preview, RU work step at 320px; not production route admission.');
  214 |   await next.tap();
  215 |   await expect(next).toBeDisabled();
  216 |   await expect(preview.locator('[data-preview-step="checkpoint"]')).toContainText('Отметьте завершение этого маршрута.');
  217 |   await previous.tap();
  218 |   await preview.getByRole('button',{name:'English',exact:true}).tap();
  219 |   await expect(overview).toHaveAttribute('lang','en');
  220 |   await expect(overviewSummary).toHaveText('Journey steps (4)');
  221 |   await expect(overview.getByRole('button')).toHaveText(['1. Country','2. Writer','3. Work','4. Finish']);
  222 |   await expect(overview.locator('[aria-current="step"]')).toHaveCount(1);
  223 |   await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current','step');
  224 |   await expect(previewCopyView.locator('option')).toHaveText(['Full text','Caption','Short text']);
  225 |   await expect(preview.locator('[data-preview-step="work"]')).toHaveAttribute('lang','en');
  226 |   await expect(preview.getByRole('status')).toContainText('Step 3 of 4 · Work');
  227 |   await expect(preview).toContainText('Age: 18–65 years · Reading level: Plain · Estimate: 8 min');
  228 |   await expect(preview.locator('[data-preview-step="work"]')).toContainText('Canonical record: Synthetic work A');
  229 |   await expect(preview.locator('[data-preview-step="work"]')).toContainText('Screen: Collection');
  230 |   await expect(preview.getByRole('button',{name:'Previous step',exact:true})).toBeVisible();
  231 |   await expect(preview.getByRole('button',{name:'Next step',exact:true})).toBeVisible();
  232 |   await expect(profilePanel.locator('summary')).toHaveText('Preview profile'); await profilePanel.locator('summary').tap();
  233 |   const profileEnabledEn=profilePanel.getByRole('checkbox',{name:'Compare an adult profile',exact:true});
  234 |   await profileEnabledEn.check(); await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  235 |   await expect(profileReport).toContainText('Age and reading level match the draft conditions.');
  236 |   const profileAgeEn=profilePanel.getByLabel('Preview age',{exact:true});
  237 |   const profileLevelEn=profilePanel.getByLabel('Preview reading level',{exact:true});
  238 |   await profileAgeEn.fill('66'); await expect(profileReport).toHaveAttribute('data-profile-status','outside');
  239 |   await expect(profileReport).toContainText('This age is outside the draft range.');
  240 |   await profileAgeEn.fill('30'); await profileLevelEn.selectOption('fluent');
  241 |   await expect(profileReport).toHaveAttribute('data-profile-status','outside');
  242 |   await expect(profileReport).toContainText('The reading level differs from the draft.');
  243 |   await profileLevelEn.selectOption('plain'); await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  244 |   await profileEnabledEn.uncheck(); await expect(profileReport).toHaveCount(0); await profilePanel.locator('summary').tap();
  245 |   await expect(preview.locator('[data-preview-step="work"]')).toContainText('Synthetic work A');
  246 |   await expect(preview.locator('[data-preview-step="work"]')).toContainText('Go to the selected book in the collection.');
  247 |   await preview.scrollIntoViewIfNeeded();
  248 |   await capture('booky-journey-preview-en-320.png','Actual local authoring preview, same work step in EN at 320px.');
  249 |   for(const control of [previous,next,preview.getByRole('button',{name:'English',exact:true})])expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  250 |   await page.getByLabel('Название маршрута (RU)',{exact:true}).fill('Тестовый маршрут обновлён');
  251 |   await expect(preview).toHaveCount(0);
  252 |   expect(downloads).toEqual([]);
  253 |   const workVariants=page.locator('[data-booky-copy-variants="work"][data-copy-locale="ru"]');
  254 |   await expect(workVariants).not.toHaveAttribute('open',''); await workVariants.locator('summary').tap();
  255 |   const workCaption=workVariants.getByRole('textbox',{name:'Подпись «Книга» (RU)',exact:true});
  256 |   const workReduced=workVariants.getByRole('textbox',{name:'Короткий текст «Книга» (RU)',exact:true});
  257 |   await expect(workCaption).toHaveValue(''); await expect(workReduced).toHaveValue('');
  258 |   await workCaption.fill('Временная подпись'); await workCaption.fill('');
  259 |   await workReduced.fill('Временный короткий текст'); await workReduced.fill('');
  260 |   const downloaded = page.waitForEvent('download');
  261 |   await button.tap();
  262 |   const download = await downloaded;
  263 |   expect(await download.failure()).toBeNull();
  264 |   const exportedPath = testInfo.outputPath('synthetic-journey-draft.json');
  265 |   await download.saveAs(exportedPath);
  266 |   const bytes = await fs.readFile(exportedPath), draft = JSON.parse(bytes.toString('utf8'));
  267 |   expect(sha(bytes)).toBe('7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5');
  268 |   expect(Object.hasOwn(draft.authoringSource.input.copy.ru.nodes.work,'caption')).toBe(false);
  269 |   expect(Object.hasOwn(draft.authoringSource.input.copy.ru.nodes.work,'reduced')).toBe(false);
  270 |   expect(Object.hasOwn(draft.authoringSource.input,'previewProfile')).toBe(false);
  271 |   expect(await page.evaluate(() => window.__activityValidationCalls)).toEqual([]);
  272 |   expect(draft.definitions).toHaveLength(2); expect(draft.dialogues).toHaveLength(8);
  273 |   expect(draft.definitions.map(d => d.locale).sort()).toEqual(['en', 'ru']);
  274 |   for (const definition of draft.definitions) {
  275 |     expect(definition.audience).toBe('adult'); expect(definition.id).toBe('synthetic-journey'); expect(definition.version).toBe(2);
  276 |     expect(definition.ageRange).toEqual({ min: 18, max: 65 }); expect(definition.readingLevel).toBe('plain');
  277 |     expect(definition.nodes.map(n => n.kind)).toEqual(['country', 'writer', 'work', 'checkpoint']);
  278 |     expect(definition.nodes[2].entity).toEqual({ kind: 'work', countryId: 'country-a', writerId: 'writer-a', workId: 'work-a' });
  279 |   }
  280 |   for (const record of draft.dialogues) expect(record.review).toMatchObject({ status: 'draft', reviewer: null, reviewedAt: null });
  281 |   for (const key of ['journeyApprovals', 'dialogueApprovals', 'currentVersions', 'availability']) expect(draft[key]).toEqual([]);
  282 |   expect(draft.releaseReady).toBe(false); expect(downloads).toHaveLength(1);
  283 |   const opener=page.locator('summary').filter({hasText:'Открыть локальный черновик'});
  284 |   await expect(opener.locator('..')).not.toHaveAttribute('open','');
  285 |   await opener.tap();
  286 |   const openDraft=page.getByLabel('Открыть черновик JSON',{exact:true});
  287 |   const routeTitle=page.getByLabel('Название маршрута (RU)',{exact:true});
  288 |   const upload=(name,buffer=bytes)=>openDraft.setInputFiles({name,mimeType:'application/json',buffer});
  289 |   await routeTitle.fill('Несохранённые правки');
  290 |   await previewButton.tap();
  291 |   const tampered=structuredClone(draft);tampered.releaseReady=true;
  292 |   await upload('tampered-draft.json',Buffer.from(JSON.stringify(tampered)));
  293 |   await expect(page.getByRole('alert')).toBeVisible();
  294 |   await expect(routeTitle).toHaveValue('Несохранённые правки');
  295 |   await expect(preview).toBeVisible();
```