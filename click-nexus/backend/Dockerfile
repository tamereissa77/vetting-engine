FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (needed for compiling and PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Start backend application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
