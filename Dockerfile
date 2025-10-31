FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

ENV APP_VERSION=1.0.0

EXPOSE 8080

CMD ["python", "src/app.py"]