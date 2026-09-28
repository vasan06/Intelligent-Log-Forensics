@echo off
echo.
echo   Intelligent Log Forensic v2.0
echo   ==============================
echo.
echo   Installing backend dependencies...
cd backend
pip install -r requirements.txt --quiet
echo   Starting backend at http://localhost:5000
start "ILF Backend" python app.py
cd ..
timeout /t 2 /nobreak >nul
echo   Opening frontend...
start frontend\landing.html
echo.
echo   ILF is running!
echo   Landing  : frontend\landing.html
echo   Backend  : http://localhost:5000
echo   Login    : admin@ilf.io / ilf2026
echo   DevTools : F12 ^> Network tab for API calls
echo.
pause
