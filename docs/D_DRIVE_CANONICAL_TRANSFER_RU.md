# Завершение переноса рабочего репозитория на диск D:

Сценарий `scripts/complete-d-transfer-after-reboot.ps1` предназначен для одного
безопасного запуска **после перезагрузки Windows**. Он не удаляет и не изменяет
исходный репозиторий на диске C:. Целевой путь жёстко ограничен адресом
`D:\Codex\probpera-literary-map`.

## Что проверяется

- исходный `HEAD` в точности равен опубликованному `origin/main`, а `origin`
  указывает на официальный GitHub-репозиторий;
- SHA коммита, SHA дерева и число отслеживаемых путей фиксируются один раз в
  начале запуска и используются во всех последующих проверках;
- нет изменений отслеживаемых файлов, а Git-объекты проходят `git fsck`;
- временная копия является независимым клоном, проходит `git fsck`, имеет чистое
  рабочее дерево и правильный адрес внешнего репозитория;
- только после этих проверок временный соседний каталог атомарно переименовывается
  в `D:\Codex\probpera-literary-map`.

## Запуск после перезагрузки

Откройте обычный PowerShell от имени текущего пользователя и выполните:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& 'C:\Users\User\Documents\ChatGPT\Работа по сайту\probpera-final-repo\scripts\complete-d-transfer-after-reboot.ps1'
```

Если по целевому адресу остался неполный каталог от прежней попытки, первый запуск
остановится без изменений. Для безопасного завершения повторите команду с ключом:

```powershell
& 'C:\Users\User\Documents\ChatGPT\Работа по сайту\probpera-final-repo\scripts\complete-d-transfer-after-reboot.ps1' -ArchiveInvalidTarget
```

Неполный каталог не удаляется: он получает соседнее имя вида
`probpera-literary-map.previous.<UTC-время>.<PID>`. Если финальное переименование
не удастся, сценарий пытается вернуть прежний каталог на исходное место. Временная
копия при ошибке также сохраняется для диагностики; рекурсивное удаление нигде не
используется.

## Финальная ручная проверка

```powershell
git -C 'D:\Codex\probpera-literary-map' rev-parse HEAD
git -C 'D:\Codex\probpera-literary-map' rev-parse 'HEAD^{tree}'
git -C 'D:\Codex\probpera-literary-map' status --short
git -C 'D:\Codex\probpera-literary-map' remote -v
```

Ожидаются одинаковый полный SHA в D-копии и текущем `origin/main` исходника,
пустой вывод `status` и GitHub-адрес
`https://github.com/Kosyat128/probpera-literary-map.git`. После этого канонической
рабочей копией считается каталог на диске D:. Копию на C: следует оставить до
отдельно подтверждённого резервного копирования и не удалять этим сценарием.

При обычном запуске сценарий сам безопасно фиксирует текущий опубликованный
`origin/main`. Для дополнительной независимой проверки можно передать полный SHA,
SHA дерева и число путей; все три значения обязательны вместе и должны совпасть с
чистым опубликованным исходником:

```powershell
& '.\scripts\complete-d-transfer-after-reboot.ps1' `
  -ExpectedSha '<40 hex>' `
  -ExpectedTree '<40 hex>' `
  -ExpectedTrackedCount <number>
```
