FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /code

# Dependências primeiro: a camada fica em cache enquanto o requirements não mudar
COPY requirements.txt .
RUN pip install -r requirements.txt

# Código da aplicação
COPY ./app ./app

# Roda como usuário comum (não-root)
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /code
USER appuser

EXPOSE 8000

# API, worker e beat usam esta mesma imagem; o comando é definido no compose.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]