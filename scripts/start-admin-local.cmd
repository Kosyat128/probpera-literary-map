@echo off
setlocal
cd /d "%~dp0.."

set "NODE_EXE="
where node.exe >nul 2>nul && set "NODE_EXE=node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  echo Node.js 24 ne nayden. Ustanovite Node.js LTS i zapustite fayl snova.
  pause
  exit /b 1
)

echo Redaktsionnaya panel: http://127.0.0.1:3000/admin/login
"%NODE_EXE%" "node_modules\next\dist\bin\next" dev "apps\admin" --webpack -p 3000

if errorlevel 1 (
  echo.
  echo Panel ne zapustilas. Proverte, chto port 3000 svoboden.
  pause
)
