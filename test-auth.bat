@echo off
echo ========================================
echo UniFlow Auth System - Test Script
echo ========================================
echo.

echo [1/4] Testing Backend Health...
curl -s http://localhost:3001/health
echo.
echo.

echo [2/4] Testing Signup (Creating new student)...
curl -X POST http://localhost:3001/api/auth/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"demo@uniflow.uz\",\"password\":\"demo123\",\"fullName\":\"Demo Student\",\"role\":\"STUDENT\",\"studentNo\":\"DEMO2024\"}"
echo.
echo.

echo [3/4] Testing Login...
curl -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"demo@uniflow.uz\",\"password\":\"demo123\"}"
echo.
echo.

echo [4/4] CORS Preflight Test...
curl -X OPTIONS http://localhost:3001/api/auth/login ^
  -H "Origin: http://localhost:3003" ^
  -H "Access-Control-Request-Method: POST" ^
  -H "Access-Control-Request-Headers: Content-Type" ^
  -v
echo.
echo.

echo ========================================
echo Test Complete!
echo ========================================
echo.
echo Frontend URLs:
echo - Login:  http://localhost:3003/en/login
echo - Signup: http://localhost:3003/en/signup
echo.
pause
