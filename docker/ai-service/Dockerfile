# docker/ai-service/Dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd -m -u 1001 sentinel
USER sentinel
EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -fs http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
