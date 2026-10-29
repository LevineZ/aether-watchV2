"""AetherWatch regional NC View — FastAPI wrapper around nccore.

Served behind the demo shell reverse-proxy at /ncview/* .
FieldFrame / demo packs are NOT used here (regional path bypass).
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import nccore

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
UPLOADS = ROOT / "uploads"
UPLOADS.mkdir(exist_ok=True)

# When reverse-proxied at /ncview, set NCVIEW_ROOT_PATH=/ncview (OpenAPI / docs only).
ROOT_PATH = os.environ.get("NCVIEW_ROOT_PATH", "/ncview").rstrip("/") or ""

app = FastAPI(title="AetherWatch NC View", root_path=ROOT_PATH)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
sessions: dict[str, dict[str, Any]] = {}


class PlotRequest(BaseModel):
    session_id: str
    variable: str
    indices: dict[str, int] = {}
    style: str = "auto"


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "service": "aether-ncview",
        "sample": nccore.SAMPLE_NC.name if nccore.SAMPLE_NC.exists() else None,
        "cjk_font": nccore.CJK_FONT,
    }


@app.post("/api/open")
async def open_nc(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No file name")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".nc", ".nc4", ".cdf"}:
        raise HTTPException(400, "Please upload a .nc / .nc4 file")

    sid = uuid.uuid4().hex
    path = UPLOADS / f"{sid}{suffix}"
    path.write_bytes(await file.read())
    try:
        meta = nccore.open_nc(path)
    except Exception as e:
        path.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from e

    sessions[sid] = meta
    return {
        "session_id": sid,
        "filename": meta["filename"],
        "lon": meta["lon"],
        "lat": meta["lat"],
        "variables": meta["variables"],
        "uv_pair": meta.get("uv_pair"),
    }


@app.post("/api/plot")
async def plot(req: PlotRequest):
    meta = sessions.get(req.session_id)
    if not meta:
        raise HTTPException(404, "Session expired — please open the file again")
    try:
        png = nccore.render_plot(meta, req.variable, req.indices, req.style)
    except Exception as e:
        raise HTTPException(500, f"Plot failed: {e}") from e
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "no-store"})


@app.get("/api/sample")
async def ensure_sample():
    if nccore.SAMPLE_NC.exists():
        return FileResponse(nccore.SAMPLE_NC, filename=nccore.SAMPLE_NC.name, media_type="application/x-netcdf")
    demo = nccore.ensure_demo_layers()
    return FileResponse(demo, filename=demo.name, media_type="application/x-netcdf")


@app.get("/api/sample_layers")
async def sample_layers():
    demo = nccore.ensure_demo_layers()
    return FileResponse(demo, filename=demo.name, media_type="application/x-netcdf")


# Static UI last so /api/* wins.
app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
