FROM node:22-slim AS frontend-build

WORKDIR /frontend
COPY spendsmart-frontend/package.json spendsmart-frontend/package-lock.json ./
RUN npm ci
COPY spendsmart-frontend/ ./
RUN npm run build


FROM python:3.13-slim AS runtime

LABEL org.opencontainers.image.source="https://github.com/Riyabachheti/SpendSmart"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install --no-install-recommends -y tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY spendsmart-backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY spendsmart-backend/ ./
COPY --from=frontend-build /frontend/dist ./frontend-dist

EXPOSE 10000

CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed_categories && exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
