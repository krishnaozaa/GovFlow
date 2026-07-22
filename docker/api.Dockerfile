FROM python:3.12.5-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/services/api GOVFLOW_DATA_DIR=/data
WORKDIR /app
COPY services/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY services/api services/api
RUN useradd --system --uid 10001 govflow && mkdir -p /data && chown govflow:govflow /data
USER govflow
EXPOSE 8000
CMD ["uvicorn", "govflow.app:app", "--host", "0.0.0.0", "--port", "8000"]
