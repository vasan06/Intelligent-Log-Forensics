FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p instance/uploads instance/models instance/reports

EXPOSE 5000
CMD ["sh", "-c", "python scripts/run_migrations.py && exec gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 8 --timeout 0 'run:app'"]
