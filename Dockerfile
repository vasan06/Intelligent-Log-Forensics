# ---------- Frontend build stage ----------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# vite outDir is ../app/static/spa, so the bundle lands under /build/app/static/spa
RUN npm run build

# ---------- Runtime stage ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUTO_START_FRONTEND=false

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /build/app/static/spa /app/app/static/spa
RUN rm -rf frontend
RUN mkdir -p instance/uploads instance/models instance/reports

EXPOSE 5000
CMD ["sh", "-c", "python scripts/run_migrations.py && python scripts/train_initial_model.py && exec gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 8 --timeout 0 'run:app'"]
