FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnetcdf-dev libhdf5-dev gcc g++ \
    && rm -rf /var/lib/apt/lists/*
COPY apps/ncview/requirements-web.txt /tmp/requirements-web.txt
RUN pip install --no-cache-dir -r /tmp/requirements-web.txt \
    && rm -f /tmp/requirements-web.txt
COPY apps/ncview/ /app/
ENV NCVIEW_ROOT_PATH=/ncview
EXPOSE 8770
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8770"]
