# NC View · AetherWatch regional

Product lock (v0.13): top bar **区域场**; page body = NC View feature set (open NC / sample / variables / times). `/ncview` → `/regional`. FieldFrame regional path bypassed.

## Local

```bash
# terminal 1 — Python API + static
cd apps/ncview
python3 -m venv .venv
.venv/bin/pip install -r requirements-web.txt
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8770

# terminal 2 — demo shell
pnpm dev   # or: pnpm build && pnpm start
```

Open http://127.0.0.1:8765/regional — iframe loads `/ncview/`.

## Docker

`docker compose up --build` starts `ncview` (:8770 internal) + `web` (:8765) with `NCVIEW_UPSTREAM=http://ncview:8770`.

## Do not commit

`.venv`, `uploads/`, `license_private.pem`, `.env`, generated `demo_layers.nc` / sample NC.

GSHHS → PMTiles basemap is **deferred** (not in this tip).
