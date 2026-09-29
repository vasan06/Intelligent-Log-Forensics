#!/usr/bin/env bash
# start.sh — ILF startup script (Mac / Linux)
set -e
echo ""
echo "  Intelligent Log Forensic v2.0"
echo "  =============================="
echo ""
echo "  Installing backend dependencies..."
cd "$(dirname "$0")/backend"
pip install -r requirements.txt -q
echo "  Starting backend at http://localhost:5000"
python app.py &
BACKEND_PID=$!
cd ..
sleep 1.5
echo ""
echo "  Opening frontend..."
if command -v open &>/dev/null; then
  open http://localhost:5000/
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:5000/
else
  echo "  Open http://localhost:5000/ in your browser"
fi
echo ""
echo "  ILF is running!"
echo "  Landing  : http://localhost:5000/"
echo "  Backend  : http://localhost:5000"
  DevTools: enable "Preserve log" to keep requests across navigations\necho ""
echo "  Press Ctrl+C to stop..."
wait $BACKEND_PID
