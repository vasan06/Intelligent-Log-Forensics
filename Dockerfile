# Stage 1: Build React SPA
FROM node:22-alpine AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy built SPA from Stage 1 into Flask static folder
COPY --from=frontend /app/static/spa /app/app/static/spa

RUN rm -rf frontend

RUN mkdir -p instance/uploads instance/models instance/reports \
    && chmod 755 instance/uploads instance/models instance/reports

EXPOSE 5000

CMD ["sh", "-c", \
    "python scripts/run_migrations.py && \
     python scripts/train_initial_model.py && \
     exec gunicorn \
       --bind 0.0.0.0:5000 \
       --workers 1 \
       --threads 8 \
       --timeout 0 \
       --keep-alive 5 \
       --access-logfile - \
       --error-logfile - \
       'run:app'"]