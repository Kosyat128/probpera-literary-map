# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booky-journey-authoring.spec.mjs >> optional bilingual work fact preserves authored source metadata through strict local export and reopen
- Location: tests\host\booky-journey-authoring.spec.mjs:1066:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  locator('[data-booky-journey-preview]').locator('[data-booky-preview-copy-view]')
Expected: "caption"
Received: "body"
Timeout:  10000ms

Call log:
  - Expect "toHaveValue" with timeout 10000ms
  - waiting for locator('[data-booky-journey-preview]').locator('[data-booky-preview-copy-view]')
    24 × locator resolved to <select lang="en" data-booky-preview-copy-view="true">…</select>
       - unexpected value "body"

```

```yaml
- combobox "Preview text view":
  - option "Full text" [selected]
  - option "Caption"
  - option "Short text"
```

# Test source

```ts
  1430 |   await previous.tap(); await expect(factStep).toBeVisible(); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  1431 |   const orderPanel = page.locator('[data-booky-optional-order]');
  1432 |   const orderRows = orderPanel.locator('[data-optional-node-kind] > span');
  1433 |   const factEarlier = orderPanel.getByRole('button', { name: 'Переместить шаг «Факт» раньше', exact: true });
  1434 |   const activityEarlier = orderPanel.getByRole('button', { name: 'Переместить шаг «Задание» раньше', exact: true });
  1435 |   const activityLater = orderPanel.getByRole('button', { name: 'Переместить шаг «Задание» позже', exact: true });
  1436 |   await expect(orderPanel).not.toHaveAttribute('open', ''); await orderPanel.locator('summary').tap();
  1437 |   await expect(orderRows).toHaveText(['4. Факт', '5. Задание']);
  1438 |   await expect(factEarlier).toHaveAttribute('aria-disabled', 'true');
  1439 |   await expect(activityLater).toHaveAttribute('aria-disabled', 'true');
  1440 |   for (const control of [orderPanel.locator('summary'), ...await orderPanel.getByRole('button').all()]) {
  1441 |     const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  1442 |   }
  1443 |   expect(await overflow()).toBe(false);
  1444 |   await overview.locator('[data-preview-step-choice="activity"]').tap();
  1445 |   await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  1446 |   await page.evaluate(() => { window.__answerHoldNext = true; });
  1447 |   await activityStep.getByRole('button', { name: 'Проверить ответ', exact: true }).tap();
  1448 |   await expect(activityStep.locator('[data-booky-activity-answer-pending]')).toBeVisible();
  1449 |   const heldOrderVerdict = await page.evaluate(() => window.__answerHeld.index);
  1450 |   await factEarlier.focus(); await page.keyboard.press('Enter');
  1451 |   await expect(factEarlier).toBeFocused(); await expect(activityStep.locator('[data-booky-activity-answer-pending]')).toBeVisible();
  1452 |   await expect(stepStatus).toContainText('Шаг 5 из 6 · Задание');
  1453 |   await activityEarlier.focus(); await page.keyboard.press('Enter');
  1454 |   await expect(activityEarlier).toBeFocused(); await expect(activityEarlier).toHaveAttribute('aria-disabled', 'true');
  1455 |   await expect(orderRows).toHaveText(['4. Задание', '5. Факт']); await expect(preview).toHaveCount(0);
  1456 |   expect(await overflow()).toBe(false);
  1457 |   await capture('booky-journey-fact-ru-320.png', 'Actual optional-order editor in RU320 after trusted keyboard move: Activity precedes Fact, the focused Earlier control remains visible, and editing has closed the local preview. Fixed base anchors, synthetic authored content; no publication or graph acceptance.', orderPanel);
  1458 |   await expect(page.getByRole('textbox', { name: 'Текст факта (RU)', exact: true })).toHaveValue(copy.ru.body);
  1459 |   await expect(sourceField('HTTPS URL источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].url);
  1460 |   await expect(page.getByLabel('Автор · вариант 2', { exact: true })).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  1461 |   await page.evaluate(index => { if (window.__answerHeld?.index !== index) throw new Error('Unexpected held order reply'); window.__answerHeld.release(); }, heldOrderVerdict);
  1462 |   await expect.poll(() => page.evaluate(index => window.__activityAnswerCalls[index].completed, heldOrderVerdict)).toBe(true);
  1463 |   await expect(preview).toHaveCount(0); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  1464 |   expect(downloads).toHaveLength(1);
  1465 |   await previewButton.tap(); await expect(preview).toBeVisible();
  1466 |   await factReview.locator('summary').tap(); await verifyFactReview(['country','writer','work','activity','sourced-fact','checkpoint']);
  1467 |   await factReview.locator('summary').tap();
  1468 |   await overview.locator('summary').tap();
  1469 |   await expect(overview.getByRole('button')).toHaveText(['1. Страна', '2. Писатель', '3. Книга', '4. Задание', '5. Факт', '6. Завершение']);
  1470 |   await overview.locator('[data-preview-step-choice="activity"]').tap();
  1471 |   await expect(stepStatus).toContainText('Шаг 4 из 6 · Задание');
  1472 |   await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  1473 |   await activityStep.getByRole('button', { name: 'Проверить ответ', exact: true }).tap();
  1474 |   await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict', 'correct');
  1475 |   const reversedDownloadEvent = page.waitForEvent('download'); await downloadButton.tap();
  1476 |   const reversedDownload = await reversedDownloadEvent; expect(await reversedDownload.failure()).toBeNull();
  1477 |   const reversedPath = testInfo.outputPath('synthetic-activity-first-draft.json'); await reversedDownload.saveAs(reversedPath);
  1478 |   const reversedBytes = await fs.readFile(reversedPath), reversedDraft = JSON.parse(reversedBytes.toString('utf8'));
  1479 |   expect(await page.evaluate(() => window.__factExportBlobs[1].text())).toBe(reversedBytes.toString('utf8'));
  1480 |   expect(reversedDraft.authoringSource.input.optionalNodeOrder).toEqual(['activity', 'sourced-fact']);
  1481 |   expect(reversedDraft.authoringSource.input.fact).toEqual({ copy }); expect(reversedDraft.dialogues).toHaveLength(12);
  1482 |   for (const definition of reversedDraft.definitions) {
  1483 |     expect(definition.nodes.map(node => node.kind)).toEqual(['country', 'writer', 'work', 'activity', 'sourced-fact', 'checkpoint']);
  1484 |     expect(definition.nodes[4].entity).toEqual({ kind: 'work', countryId: 'country-a', writerId: 'writer-a', workId: 'work-a' });
  1485 |     for (const binding of definition.nodes[4].fact.dialogues)
  1486 |       expect(binding.contentChecksum).toBe(reversedDraft.dialogues.find(record => record.payload.locale === binding.locale && record.payload.id === binding.id).review.contentChecksum);
  1487 |   }
  1488 |   await previewButton.tap(); await overview.locator('summary').tap(); await overview.locator('[data-preview-step-choice="activity"]').tap();
  1489 |   await factReview.locator('summary').tap(); await verifyFactReview(['country','writer','work','activity','sourced-fact','checkpoint']);
  1490 |   const preservedReversedPreview = await preview.innerText();
  1491 |   const rehashedOrderTamper = await page.evaluate(original => {
  1492 |     const forged = structuredClone(original), hash = window.__copyVariantRecordHash;
  1493 |     for (const definition of forged.definitions) {
  1494 |       [definition.nodes[3], definition.nodes[4]] = [definition.nodes[4], definition.nodes[3]];
  1495 |       forged.definitionsChecksums.find(binding => binding.locale === definition.locale).checksum = hash(definition);
  1496 |     }
  1497 |     return forged;
  1498 |   }, reversedDraft);
  1499 |   expect(rehashedOrderTamper.authoringSource).toEqual(reversedDraft.authoringSource);
  1500 |   expect(rehashedOrderTamper.definitionsChecksums).not.toEqual(reversedDraft.definitionsChecksums);
  1501 |   const wrongOptionalSet = structuredClone(reversedDraft); wrongOptionalSet.authoringSource.input.optionalNodeOrder = ['activity'];
  1502 |   for (const [filename, invalid] of [['rehashed-derived-order.json', rehashedOrderTamper], ['missing-enabled-optional-step.json', wrongOptionalSet]]) {
  1503 |     await upload(filename, Buffer.from(JSON.stringify(invalid))); await expect(page.getByRole('alert')).toBeVisible();
  1504 |     expect(await preview.innerText()).toBe(preservedReversedPreview); await expect(orderRows).toHaveText(['4. Задание', '5. Факт']);
  1505 |     await expect(sourceField('ID источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].id); expect(downloads).toHaveLength(2);
  1506 |   }
  1507 |   await upload('valid-activity-first-draft.json', reversedBytes); await expect(preview).toHaveCount(0);
  1508 |   await expect(factReview).toHaveCount(0);
  1509 |   await expect(openDraft).toHaveValue(''); await expect(orderRows).toHaveText(['4. Задание', '5. Факт']);
  1510 |   await expect(factVariantField('ru', 'caption')).toHaveValue(copy.ru.caption);
  1511 |   await expect(page.getByLabel('Автор · вариант 2', { exact: true })).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  1512 |   await previewButton.tap(); await preview.getByRole('button', { name: 'English', exact: true }).tap();
  1513 |   await overview.locator('summary').tap();
  1514 |   await expect(overview.getByRole('button')).toHaveText(['1. Country', '2. Writer', '3. Work', '4. Activity', '5. Fact', '6. Finish']);
  1515 |   await overview.locator('[data-preview-step-choice="sourced-fact"]').tap(); await expect(stepStatus).toContainText('Step 5 of 6 · Fact');
  1516 |   await verifySources('en');
  1517 |   await overview.locator('[data-preview-step-choice="activity"]').tap(); await expect(stepStatus).toContainText('Step 4 of 6 · Activity');
  1518 |   await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  1519 |   await activityStep.getByRole('button', { name: 'Check answer', exact: true }).tap();
  1520 |   await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict', 'correct');
  1521 |   await expect(overview).toHaveAttribute('open', '');
  1522 |   await expect(overview.locator('[data-preview-step-choice="activity"]')).toHaveAttribute('aria-current', 'step');
  1523 |   await expect(factReview).not.toHaveAttribute('open',''); await factReview.locator('summary').tap();
  1524 |   await expect(factReview.locator('summary')).toHaveText('Draft review report (6)');
  1525 |   await verifyFactReview(['country','writer','work','activity','sourced-fact','checkpoint']);
  1526 |   const reopenedReportCalls = await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}));
  1527 |   await factReview.locator('[data-review-node="activity"] [data-review-inspect="en"]').tap();
  1528 |   await expect(activityStep.locator('[data-answer-choice-id="choice-2"]')).toHaveAttribute('aria-pressed','true');
  1529 |   await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict','correct');
> 1530 |   await expect(factCopyView).toHaveValue('caption'); await expect(factFrame).toHaveAttribute('data-preview-width','768');
       |                              ^ Error: expect(locator).toHaveValue(expected) failed
  1531 |   expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(reopenedReportCalls);
  1532 |   expect(await overflow()).toBe(false);
  1533 |   const reportFactRow = factReview.locator('[data-review-node="sourced-fact"]');
  1534 |   await reportFactRow.evaluate(node => { node.scrollIntoView({block:'start'}); window.scrollBy(0,-12); });
  1535 |   for (const control of [reportFactRow, ...await reportFactRow.locator('[data-review-sources]').all()]) {
  1536 |     const bounds = await control.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  1537 |     expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  1538 |   }
  1539 |   await capture('booky-journey-fact-en-320.png', 'Actual native-reopened six-node reverse-order report in EN320, anchored at its fifth Fact row. Independent RU two/EN one supplied citations are explicitly unreviewed; RU caption/short text are authored while EN short text uses title fallback. Same Activity inspection preserves the current verdict,768px clamped frame and caption view. No source review or approval claim.', reportFactRow);
  1540 |   await activityLater.focus(); await page.keyboard.press('Enter'); await expect(activityLater).toBeFocused();
  1541 |   await expect(activityLater).toHaveAttribute('aria-disabled', 'true');
  1542 |   await expect(orderRows).toHaveText(['4. Факт', '5. Задание']); await expect(preview).toHaveCount(0);
  1543 |   await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  1544 |   const defaultDownloadEvent = page.waitForEvent('download'); await downloadButton.tap();
  1545 |   const defaultDownload = await defaultDownloadEvent; expect(await defaultDownload.failure()).toBeNull();
  1546 |   const defaultPath = testInfo.outputPath('synthetic-default-combined-draft.json'); await defaultDownload.saveAs(defaultPath);
  1547 |   const defaultBytes = await fs.readFile(defaultPath), defaultDraft = JSON.parse(defaultBytes.toString('utf8'));
  1548 |   expect(await page.evaluate(() => window.__factExportBlobs[2].text())).toBe(defaultBytes.toString('utf8'));
  1549 |   expect(Object.hasOwn(defaultDraft.authoringSource.input, 'optionalNodeOrder')).toBe(false);
  1550 |   for (const definition of defaultDraft.definitions)
  1551 |     expect(definition.nodes.map(node => node.kind)).toEqual(['country', 'writer', 'work', 'sourced-fact', 'activity', 'checkpoint']);
  1552 |   expect(await page.evaluate(value => window.__copyVariantRecordHash(value), defaultDraft)).toBe(validationCalls[0].actualResult.draftChecksum);
  1553 |   await activityEarlier.tap(); await orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true }).tap();
  1554 |   await expect(orderRows).toHaveText(['4. Факт', '5. Задание']);
  1555 |   await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  1556 |   await activityEarlier.tap(); await factEnabled.uncheck();
  1557 |   await expect(orderRows).toHaveText(['4. Задание']);
  1558 |   await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  1559 |   await expect(page.getByLabel('Автор · вариант 2', { exact: true })).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  1560 |   await previewButton.tap(); await expect(stepStatus).toContainText('Шаг 1 из 5 · Страна');
  1561 |   await upload('restore-combined-before-removing-activity.json', reversedBytes); await combinedActivityEnabled.uncheck();
  1562 |   await expect(orderRows).toHaveText(['4. Факт']);
  1563 |   await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  1564 |   await expect(page.getByRole('textbox', { name: 'Текст факта (RU)', exact: true })).toHaveValue(copy.ru.body);
  1565 |   await expect(sourceField('HTTPS URL источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].url);
  1566 |   await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap(); await verifySources('ru');
  1567 |   const finalValidationCalls = await page.evaluate(() => window.__activityValidationCalls);
  1568 |   const finalAnswerCalls = await page.evaluate(() => window.__activityAnswerCalls);
  1569 |   expect(finalAnswerCalls).toHaveLength(4); expect(finalAnswerCalls[heldOrderVerdict].hold).toBe(true);
  1570 |   for (const call of finalAnswerCalls) {
  1571 |     expect(call.actualHelperCalled).toBe(true); expect(call.actualResult.ok).toBe(true); expect(call.actualResult.correct).toBe(true);
  1572 |   }
  1573 |   expect(finalAnswerCalls[heldOrderVerdict].actualResult.draftChecksum).toBe(validationCalls[0].actualResult.draftChecksum);
  1574 |   expect(finalAnswerCalls[2].actualResult.draftChecksum).not.toBe(validationCalls[0].actualResult.draftChecksum);
  1575 |   expect(finalAnswerCalls[2].actualResult.draftChecksum).toBe(await page.evaluate(value => window.__copyVariantRecordHash(value), reversedDraft));
  1576 |   expect(finalAnswerCalls[3].actualResult.draftChecksum).toBe(finalAnswerCalls[2].actualResult.draftChecksum);
  1577 |   for (const call of finalValidationCalls) { expect(call.actualHelperCalled).toBe(true); expect(call.actualResult.ok).toBe(true); }
  1578 |   expect(downloads).toHaveLength(3); expect(screenshots).toHaveLength(2);
  1579 |   expect(await page.evaluate(() => window.__factExportBlobs.length)).toBe(3);
  1580 |   const storageWrites = await page.evaluate(() => window.__factStorageWrites); expect(storageWrites).toEqual([]);
  1581 |   expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  1582 |   await testInfo.attach('booky-journey-fact-evidence', { contentType: 'application/json', body: JSON.stringify({
  1583 |     pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true, actualDraftParser: true,
  1584 |     syntheticCatalog: true, authoredSyntheticUnverifiedFact: true, sourceUrlsFetched: false, sourcesAttested: false,
  1585 |     optionalFactStartsCollapsedBeforeActivity: true, initialFactCopyAndSourceFieldsBlank: true, noAutomaticAccessDate: true,
  1586 |     missingFieldsPreventPreviewAndDownload: true, selectedWorkAnchorOnCollection: true,
  1587 |     bilingualDefinitions: 2, factOnlySemanticNodesPerDefinition: 5, unapprovedDialogueDrafts: 10,
  1588 |     independentRuEnSourcesPreserved: true, orderedRuEnContentBindingVerified: true, nativeBlobExportObserved: true,
  1589 |     nativeFileImportRestoresEverySourceRow: true, importedMultiSourceEditsPreserveOtherRows: true, sourceAddRemoveVerified: true,
  1590 |     malformedMissingSourceAndFullEnvelopeTamperPreserveInputAndPreview: true,
  1591 |     factPreviewShowsOnlyCurrentLocaleSourceMetadata: true, draftSourceReviewNoticeLocalized: true,
  1592 |     authoredBaseAndFactCopyVariantsExportedAndNativeImported: true, optionalVariantsStartBlankInCollapsedLocaleDetails: true,
  1593 |     independentOptionalEnReducedOmissionUsesCompiledTitleFallback: true, localizedExplicitCopyViewKeepsCurrentSemanticStep: true,
  1594 |     multilineCaptionAndShortTextPreviewPreserved: true, rehashedDerivedCopyVariantTamperCannotReplaceInputOrPreview: true,
  1595 |     localWidthChoicesPreserveCurrentLocaleAuthoredFactVariantsAndSourceLinks:true, selected768WidthFitsNarrowAvailableParent:true,
  1596 |     englishPreviewConditionsStepLabelsRecordScreenAndSequentialNavigationLocalized: true,
  1597 |     sourceLinksHaveHttpsNoopenerNoreferrer: true, narrow320LayoutHasNoHorizontalOverflow: true, minimumControlHitHeightCssPx: 44,
  1598 |     combinedFactThenActivityPreviewVerified: true, combinedDraftAnswerBoundToSameWholeHash: true,
  1599 |     factFiveNodeOverviewRuEnVerified: true, combinedSixNodeOverviewUsesActualDefinitionOrder: true,
  1600 |     reviewReportFollowsActualFiveAndBothSixNodeOrders:true, independentRuTwoEnOneCitationsReportedUnreviewed:true,
  1601 |     reportUsesExactAuthoredBaseFactVariantPresenceAndIndependentEnTitleFallback:true,
  1602 |     changedReportLocaleKeepsFactWidthAndTextViewWithoutHelperRequest:true,
  1603 |     nativeReopenBuildsFreshReportAndRejectedFullHashTamperPreservesCurrentReport:true,
  1604 |     sameReopenedReportInspectPreservesActivityChoiceVerdictWidthAndCopyView:true,
  1605 |     narrowFactReportRowAndBothUnreviewedCountsDirectlyCaptured:true,
  1606 |     trustedOverviewFactAndActivityJumpsStayLocal: true, combinedOverviewControlsMinimum44CssPx: true,
  1607 |     combinedCurrentCreditedAuthorCheckUsesActualHelper: true, mockedServerActionTransport: true,
  1608 |     optionalOrderStartsCollapsedWithFixedBaseAnchors: true, trustedKeyboardReorderPreservesFocusAndMinimum44CssPx: true,
  1609 |     unchangedBoundaryOrderKeepsPendingAnswer: true, changedOrderInvalidatesPreviewAndRejectsHeldAnswer: true, heldOrderVerdictCallIndex: heldOrderVerdict,
  1610 |     bothOptionalOrdersUseActualDefinitionOrderInRuEnPreview: true, nativeCombinedOrderExportAndImportVerified: true,
  1611 |     optionalOrderRuControlsAndEnReopenedReverseReportCaptured: true,
  1612 |     rehashedDerivedOrderAndWrongEnabledSetCannotReplaceInputOrPreview: true,
  1613 |     returningDefaultOmitsOwnOrderAndRestoresOriginalWholeDraftHash: true, changingOptionalPresenceClearsCustomOrderAndPreservesRemainingAuthoredFields: true,
  1614 |     authenticatedAdminServerTested: false, installedDeviceTested: false, answerCheckDoesNotAdvanceStep: true,
  1615 |     storageWrites, downloads, exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length },
  1616 |     combinedExports: [{ path: reversedPath, sha256: sha(reversedBytes), bytes: reversedBytes.length }, { path: defaultPath, sha256: sha(defaultBytes), bytes: defaultBytes.length }],
  1617 |     validationCalls: finalValidationCalls, answerCalls: finalAnswerCalls, sourceInputs: fixture.sourceInputs, screenshots, errors, externalRequests,
  1618 |     productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  1619 |   }, null, 2) });
  1620 | });
  1621 | 
```