# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booky-journey-authoring.spec.mjs >> optional adult RU EN author task uses current semantic validation and preserves edits through failed or obsolete operations
- Location: tests\host\booky-journey-authoring.spec.mjs:349:1

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
  - group "Открыть локальный черновик":
    - text: Открыть локальный черновик
    - paragraph: JSON · до 512 КиБ
    - paragraph: Выберите ранее экспортированный файл JSON. Только успешная проверка заменит текущую форму. При ошибке форма и предпросмотр сохранятся.
    - text: Открыть черновик JSON
    - button "Открыть черновик JSON"
    - paragraph: Черновик открыт. Проверьте форму и запустите предпросмотр заново.
  - region "Маршрут и условия":
    - heading "Маршрут и условия" [level=2]
    - text: Черновик · RU / EN Идентификатор маршрута
    - textbox "Идентификатор маршрута": synthetic-activity
    - text: Версия
    - spinbutton "Версия": "3"
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
    - spinbutton "Примерная длительность (мин)": "10"
    - paragraph: Условия задаёт редактор. Они не назначают возраст или уровень чтения пользователям.
    - text: Название маршрута (RU)
    - textbox "Название маршрута (RU)": Маршрут с заданием
    - text: Описание маршрута (RU)
    - textbox "Описание маршрута (RU)": Черновик задания по текущему каталогу.
    - text: Название маршрута (EN)
    - textbox "Название маршрута (EN)": Activity journey
    - text: Описание маршрута (EN)
    - textbox "Описание маршрута (EN)": A task draft checked against the current catalog.
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
      - group "Необязательное задание · выбрать автора":
        - text: Необязательное задание · выбрать автора
        - paragraph: Добавьте вопрос между книгой и завершением. Выберите 2–4 автора из каталога; соответствие книге проверяется перед просмотром и экспортом.
        - checkbox "Добавить задание «Книга и автор»" [checked]
        - text: Добавить задание «Книга и автор»
        - paragraph: "Книга: Тестовая книга А"
        - text: Автор · вариант 1
        - combobox "Автор · вариант 1":
          - option "Выберите автора"
          - option "Тестовый писатель А · Тестовая страна А" [selected]
          - option "Тестовый писатель Б · Тестовая страна А · EN пока не подтверждён" [disabled]
          - option "Тестовый писатель В · Тестовая страна Б" [disabled]
          - option "Тестовый писатель Г · Тестовая страна В"
        - text: Автор · вариант 2
        - combobox "Автор · вариант 2":
          - option "Выберите автора"
          - option "Тестовый писатель А · Тестовая страна А" [disabled]
          - option "Тестовый писатель Б · Тестовая страна А · EN пока не подтверждён" [disabled]
          - option "Тестовый писатель В · Тестовая страна Б" [selected]
          - option "Тестовый писатель Г · Тестовая страна В"
        - button "Добавить вариант автора"
        - text: Вопрос задания (RU)
        - textbox "Вопрос задания (RU)": Кто автор этой книги?
        - text: Подсказка задания (RU)
        - textbox "Подсказка задания (RU)": Выберите имя автора среди предложенных вариантов.
        - group:
          - text: Подпись и короткий текст
          - paragraph: Пустое поле использует название шага.
          - text: Подпись «Задание» (RU)
          - textbox "Подпись «Задание» (RU)"
          - text: Короткий текст «Задание» (RU)
          - textbox "Короткий текст «Задание» (RU)"
        - text: Вопрос задания (EN)
        - textbox "Вопрос задания (EN)": Who wrote this book?
        - text: Подсказка задания (EN)
        - textbox "Подсказка задания (EN)": Choose the author's name from the options.
        - group: Caption and short text
      - region "5. Завершение":
        - heading "5. Завершение" [level=2]
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
    - paragraph: "Возраст: 18–65 лет · Уровень чтения: Простой · Оценка: 10 мин"
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
    - status: Шаг 4 из 5 · Задание
    - group: Шаги маршрута (5)
    - article "Текст выбранного шага":
      - heading "Маршрут с заданием" [level=3]
      - paragraph: Черновик задания по текущему каталогу.
      - paragraph: "Каноническая запись: Тестовая книга А"
      - paragraph: "Экран: Глобус"
      - heading "Кто автор этой книги?" [level=4]
      - text: Вариант текста предпросмотра
      - combobox "Вариант текста предпросмотра":
        - option "Полный текст" [selected]
        - option "Подпись"
        - option "Короткий текст"
      - paragraph: Выберите имя автора среди предложенных вариантов.
      - list "Варианты ответа":
        - listitem:
          - button "Тестовый писатель А"
        - listitem:
          - button "Тестовый писатель В"
      - button "Проверить ответ" [disabled]
      - button "Сбросить ответ"
    - navigation "Шаги предпросмотра":
      - button "Предыдущий шаг"
      - button "Следующий шаг"
  - region "Экспорт черновика":
    - status
    - paragraph: JSON содержит два языковых маршрута и десять черновиков подсказок. Проверка формы не даёт редакционного одобрения.
    - button "Скачать черновик JSON"
```

# Test source

```ts
  631 |   await expect(overviewWork).toHaveAttribute('aria-current', 'step');
  632 |   await releaseAnswer(heldStepVerdict);
  633 |   await expect(stepStatus).toContainText(/^(?:Шаг 3 из 5|Step 3 of 5)/);
  634 |   await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  635 |   await expect(page.locator('[data-booky-activity-answer-error]')).toHaveCount(0);
  636 |   await overviewActivity.tap();
  637 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  638 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  639 |   await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  640 |   await expect(answerCheckRu).toBeDisabled();
  641 |   await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  642 |   await correctAnswer.tap();
  643 |   await page.evaluate(() => { window.__answerHoldNext = true; });
  644 |   await answerCheckRu.tap();
  645 |   const heldChoiceVerdict = await answerHeldIndex();
  646 |   await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true');
  647 |   await expect(answerCheckRu).toHaveAttribute('aria-disabled', 'true');
  648 |   const pendingAnswerCalls = await page.evaluate(() => window.__activityAnswerCalls.length);
  649 |   await answerCheckRu.focus(); await answerCheckRu.press('Enter');
  650 |   expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(pendingAnswerCalls);
  651 |   await wrongAnswer.tap();
  652 |   await releaseAnswer(heldChoiceVerdict);
  653 |   await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'true');
  654 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  655 |   await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  656 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  657 |   await correctAnswer.tap();
  658 |   await page.evaluate(() => { window.__answerHoldNext = true; });
  659 |   await answerCheckRu.tap();
  660 |   const heldLocaleVerdict = await answerHeldIndex();
  661 |   await preview.getByRole('button', { name: 'English', exact: true }).tap();
  662 |   await releaseAnswer(heldLocaleVerdict);
  663 |   await expect(overview.locator('summary')).toHaveText('Journey steps (5)');
  664 |   await expect(overview.getByRole('button')).toHaveText(['1. Country', '2. Writer', '3. Work', '4. Activity', '5. Finish']);
  665 |   await expect(overviewActivity).toHaveAttribute('aria-current', 'step');
  666 |   await expect(activityStep).toHaveAttribute('lang', 'en');
  667 |   await expect(stepStatus).toContainText('Step 4 of 5 · Activity');
  668 |   await expect(activityStep).toContainText('Screen: Globe');
  669 |   await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  670 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  671 |   await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  672 |   await expect(answerCheckEn).toBeDisabled();
  673 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  674 |   await correctAnswer.tap();
  675 |   for (const [knob, message] of [
  676 |     ['__answerWrongChecksumNext', 'The check is out of date. Try again.'],
  677 |     ['__answerWrongChoiceNext', 'The check is out of date. Try again.'],
  678 |     ['__answerSessionFailureNext', 'Could not check the answer. Your choice is preserved; try again.'],
  679 |     ['__answerThrowNext', 'Could not check the answer. Your choice is preserved; try again.'],
  680 |   ]) {
  681 |     await page.evaluate(knob => { window[knob] = true; }, knob);
  682 |     await answerCheckEn.tap();
  683 |     await expect(answerError).toContainText(message);
  684 |     await expect(verdict).toHaveCount(0);
  685 |     await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  686 |     await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  687 |   }
  688 |   await answerResetEn.tap();
  689 |   await expect(answerError).toHaveCount(0); await expect(verdict).toHaveCount(0);
  690 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  691 |   await correctAnswer.tap();
  692 |   await page.evaluate(() => { window.__answerHoldNext = true; });
  693 |   await answerCheckEn.tap();
  694 |   const heldEditVerdict = await answerHeldIndex();
  695 |   await routeTitle.fill('Правки во время проверки ответа');
  696 |   await releaseAnswer(heldEditVerdict);
  697 |   await expect(routeTitle).toHaveValue('Правки во время проверки ответа');
  698 |   await expect(preview).toHaveCount(0);
  699 |   await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  700 |   expect(downloads).toHaveLength(1);
  701 |   await upload('restore-after-answer-edit.json');
  702 |   await expect(routeTitle).toHaveValue('Маршрут с заданием');
  703 |   await previewButton.tap();
  704 |   await expect(preview).toBeVisible();
  705 |   for (let index = 0; index < 3; index++) await next.tap();
  706 |   await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  707 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  708 |   const activityVariants = page.locator('[data-booky-copy-variants="activity"][data-copy-locale="ru"]');
  709 |   await expect(activityVariants).not.toHaveAttribute('open', ''); await activityVariants.locator('summary').tap();
  710 |   const activityReduced = activityVariants.getByRole('textbox', { name: 'Короткий текст «Задание» (RU)', exact: true });
  711 |   await expect(activityReduced).toHaveValue('');
  712 |   await correctAnswer.tap();
  713 |   await page.evaluate(() => { window.__answerHoldNext = true; });
  714 |   await answerCheckRu.tap();
  715 |   const heldVariantEditVerdict = await answerHeldIndex();
  716 |   await activityReduced.fill('Краткая подсказка: выберите автора.');
  717 |   await releaseAnswer(heldVariantEditVerdict);
  718 |   await expect(activityReduced).toHaveValue('Краткая подсказка: выберите автора.');
  719 |   await expect(preview).toHaveCount(0); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  720 |   await upload('restore-after-copy-variant-edit.json');
  721 |   await expect(activityReduced).toHaveValue('');
  722 |   await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap();
  723 |   await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  724 |   const profilePanel = preview.locator('[data-booky-preview-profile]');
  725 |   const profileReport = preview.locator('[data-booky-preview-profile-report]');
  726 |   const profileEnabled = profilePanel.getByRole('checkbox', { name: 'Сравнить взрослый профиль', exact: true });
  727 |   await expect(profilePanel).not.toHaveAttribute('open', ''); await profilePanel.locator('summary').tap();
  728 |   await expect(profileEnabled).not.toBeChecked(); await profileEnabled.check();
  729 |   const profileAge = profilePanel.getByLabel('Возраст для предпросмотра', { exact: true });
  730 |   const profileLevel = profilePanel.getByLabel('Уровень чтения для предпросмотра', { exact: true });
> 731 |   await expect(profileAge).toHaveValue(''); await expect(profileLevel).toHaveValue('');
      |                                                                        ^ Error: expect(locator).toHaveValue(expected) failed
  732 |   await expect(profileReport).toHaveAttribute('data-profile-status', 'invalid');
  733 |   await correctAnswer.tap(); await expect(answerCheckRu).toHaveAttribute('aria-disabled', 'true');
  734 |   const callsBeforeInvalidProfile = await page.evaluate(() => window.__activityAnswerCalls.length);
  735 |   await answerCheckRu.focus(); await answerCheckRu.press('Enter'); await expect(answerCheckRu).toBeFocused();
  736 |   expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeInvalidProfile);
  737 |   await expect(verdict).toHaveCount(0);
  738 |   await profileAge.fill('30'); await profileLevel.selectOption('plain');
  739 |   await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  740 |   await correctAnswer.tap();
  741 |   await page.evaluate(() => { window.__answerHoldNext = true; });
  742 |   await answerCheckRu.tap();
  743 |   const heldProfileVerdict = await answerHeldIndex();
  744 |   await profileAge.fill('30'); await profileLevel.selectOption('plain');
  745 |   await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true');
  746 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  747 |   const callsBeforeOutsideProfile = await page.evaluate(() => window.__activityAnswerCalls.length);
  748 |   await profileAge.fill('66');
  749 |   await expect(profileReport).toHaveAttribute('data-profile-status', 'outside');
  750 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  751 |   await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  752 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  753 |   await correctAnswer.tap(); await expect(answerCheckRu).toHaveAttribute('aria-disabled', 'true');
  754 |   await answerCheckRu.focus(); await answerCheckRu.press('Enter'); await expect(answerCheckRu).toBeFocused();
  755 |   expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeOutsideProfile);
  756 |   await releaseAnswer(heldProfileVerdict);
  757 |   await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  758 |   await expect(profileReport).toHaveAttribute('data-profile-status', 'outside');
  759 |   await profileEnabled.uncheck(); await expect(profileReport).toHaveCount(0);
  760 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  761 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  762 |   await correctAnswer.tap();
  763 |   await answerCheckRu.tap();
  764 |   await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  765 |   await upload('reopen-discards-answer-verdict.json');
  766 |   await expect(preview).toHaveCount(0);
  767 |   await previewButton.tap();
  768 |   await expect(preview).toBeVisible();
  769 |   for (let index = 0; index < 3; index++) await next.tap();
  770 |   await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  771 |   await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  772 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  773 |   await expect(profilePanel).not.toHaveAttribute('open', ''); await profilePanel.locator('summary').tap();
  774 |   await profileEnabled.check(); await profileAge.fill('30'); await profileLevel.selectOption('plain');
  775 |   await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  776 |   await profilePanel.locator('summary').tap();
  777 |   await wrongAnswer.tap();
  778 |   await answerCheckRu.tap();
  779 |   await expect(verdict).toHaveAttribute('data-verdict', 'wrong');
  780 |   await expect(verdict).toHaveAttribute('aria-live', 'polite');
  781 |   await expect(verdict).toHaveAttribute('lang', 'ru');
  782 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  783 |   const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  784 |   expect(await overflow()).toBe(false);
  785 |   for (const control of [activityOpener, firstChoice, secondChoice, previous, next, preview.getByRole('button', { name: 'English', exact: true }), activityEnabled.locator('..'), wrongAnswer, correctAnswer, answerCheckRu, answerResetRu]) {
  786 |     const bounds = await control.boundingBox(); expect(bounds).toBeTruthy(); expect(bounds.height).toBeGreaterThanOrEqual(44);
  787 |   }
  788 |   async function capture(filename, scope) {
  789 |     await activityStep.scrollIntoViewIfNeeded();
  790 |     const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
  791 |     screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  792 |   }
  793 |   await capture('booky-journey-activity-ru-320.png', 'Actual local adult activity preview after native reopen, explicit wrong writer A and current semantic evaluation, RU320; calm wrong feedback, synthetic corpus and mocked action transport.');
  794 |   await preview.getByRole('button', { name: 'English', exact: true }).tap();
  795 |   await expect(activityStep).toHaveAttribute('lang', 'en');
  796 |   await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  797 |   await expect(profileReport).toContainText('Age and reading level match the draft conditions.');
  798 |   await expect(activityStep).toContainText('Who wrote this book?');
  799 |   await expect(choices).toContainText('Synthetic writer A'); await expect(choices).toContainText('Synthetic writer C');
  800 |   await expect(verdict).toHaveCount(0); await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  801 |   await correctAnswer.focus(); await correctAnswer.press('Space');
  802 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  803 |   await answerCheckEn.focus(); await answerCheckEn.press('Enter');
  804 |   await expect(answerCheckEn).toBeFocused();
  805 |   await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  806 |   await expect(verdict).toHaveAttribute('aria-live', 'polite');
  807 |   await expect(verdict).toHaveAttribute('lang', 'en');
  808 |   await expect(verdict).toContainText('Correct.');
  809 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  810 |   for (const control of [wrongAnswer, correctAnswer, answerCheckEn, answerResetEn]) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  811 |   expect(await overflow()).toBe(false);
  812 |   await capture('booky-journey-activity-en-320.png', 'Same local adult preview in EN320 after keyboard choice/check of credited writer C; calm current correct feedback without automatic advance, publication or runtime admission.');
  813 |   const activityCopyView = preview.locator('[data-booky-preview-copy-view]');
  814 |   const callsBeforeSameCopyView = await page.evaluate(() => window.__activityAnswerCalls.length);
  815 |   await activityCopyView.selectOption('body');
  816 |   await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  817 |   await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  818 |   expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeSameCopyView);
  819 |   await activityCopyView.selectOption('caption');
  820 |   await expect(verdict).toHaveCount(0); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  821 |   await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  822 |   await expect(preview.locator('[data-booky-preview-copy]')).toHaveText('Who wrote this book?');
  823 |   await activityCopyView.selectOption('body');
  824 |   expect(screenshots).toHaveLength(2); expect(downloads).toHaveLength(1);
  825 |   expect(await page.evaluate(() => window.__draftExportBlobs.length)).toBe(1);
  826 |   expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  827 |   const validationCalls = await page.evaluate(() => window.__activityValidationCalls);
  828 |   expect(validationCalls.filter(call => call.hold)).toHaveLength(2);
  829 |   expect(validationCalls.filter(call => call.failSession)).toHaveLength(1);
  830 |   expect(validationCalls.filter(call => call.failNetwork)).toHaveLength(1);
  831 |   expect(validationCalls.filter(call => call.wrongChecksum)).toHaveLength(1);
```