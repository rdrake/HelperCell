# Flask sidecar — runs alongside the JupyterLab container in the same pod.
# Secrets (SECRET_KEY, GEMINI_API_KEY) are injected via k8s env vars and
# never exposed to the jovyan user in the Jupyter container.
FROM python:3.12-slim-bookworm

RUN useradd -r -s /usr/sbin/nologin flaskuser

RUN pip install --no-cache-dir flask flask-cors google-genai

COPY . /app
WORKDIR /app

ENV FLASK_APP=app.py

USER flaskuser

EXPOSE 5000

CMD ["python", "-m", "flask", "run", "--host=127.0.0.1", "--port=5000"]
