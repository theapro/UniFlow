@echo off
setlocal

REM UniFlow dev launcher (Windows)
REM Starts: backend (3001), admin (Next.js), user (Next.js)

echo Starting UniFlow dev services...
echo.

REM Backend
start "UniFlow Backend" cmd /k "cd /d %~dp0backend && npm run dev"

REM Admin
start "UniFlow Admin" cmd /k "cd /d %~dp0admin && npm run dev"

REM User
start "UniFlow User" cmd /k "cd /d %~dp0user && npm run dev"

echo Done. Three terminals should be opening.
endlocal
