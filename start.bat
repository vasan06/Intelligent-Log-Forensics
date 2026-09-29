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
start http://localhost:5000/
echo.
echo   ILF is running!
echo   Landing  : http://localhost:5000/
echo   Backend  : http://localhost:5000
  DevTools: enable "Preserve log" to keep requests across navigations\necho.
pause
