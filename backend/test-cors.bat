@echo off
echo Testing backend with CORS...
echo.

curl -i -X OPTIONS http://localhost:3001/api/admin/students ^
  -H "Origin: http://localhost:3000" ^
  -H "Access-Control-Request-Method: GET" ^
  -H "Access-Control-Request-Headers: Authorization,Content-Type"

echo.
echo.
echo Testing GET request...
echo.

curl -i http://localhost:3001/health

echo.
echo Done!
