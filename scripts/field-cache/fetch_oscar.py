#!/usr/bin/env python3
"""Fetch OSCAR v2.0 NRT → FieldFrame pack on disk (meta.json + u/v/mask.bin).

Env (no secrets committed):
  EARTHDATA_TOKEN or EARTHDATA_USERNAME + EARTHDATA_PASSWORD
  CURRENT_SOURCE=auto|oscar|demo  (demo skips upstream)
  FIELD_CACHE_DIR=.cache/fields
  FIELD_CACHE_TTL_SECONDS=21600
  OSCAR_SHORT_NAME=OSCAR_L4_OC_NRT_V2.0
  OSCAR_COLLECTION_ID=C2102958977-POCLOUD

Usage:
  fetch_oscar.py --pack global/ocean
  fetch_oscar.py --pack regional/currents
  fetch_oscar.py --status
Exit 0 on cache hit / fresh write; exit 2 if no creds (caller falls back to demo);
exit 1 on hard failure.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
import numpy as np
from netCDF4 import Dataset

USER_AGENT = "AetherWatch-lite/0.1 (field-cache; oscar; no-nullschool)"
CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"
URS_TOKEN = "https://urs.earthdata.nasa.gov/api/users/token"
URS_TOKENS = "https://urs.earthdata.nasa.gov/api/users/tokens"
PODAAC_S3_HTTPS = (
    (
        "s3://podaac-ops-cumulus-protected/",
        "https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-protected/",
    ),
    (
        "s3://podaac-ops-cumulus-public/",
        "https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-public/",
    ),
)
OSCAR_NLAT = 719
OSCAR_NLON = 1440
OSCAR_DAP_STRIDE = 4

PACK_TARGETS = {
    "global/ocean": {
        "nx": 721,
        "ny": 361,
        "bbox": [-180.0, -90.0, 180.0, 90.0],
        "kind": "ocean",
    },
    "regional/currents": {
        "nx": 141,
        "ny": 131,
        "bbox": [117.5, 22.0, 131.5, 35.0],
        "kind": "ocean",
    },
}


def env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def has_creds() -> bool:
    return bool(env("EARTHDATA_TOKEN") or (env("EARTHDATA_USERNAME") and env("EARTHDATA_PASSWORD")))


def cache_root() -> Path:
    return Path(env("FIELD_CACHE_DIR", ".cache/fields")).resolve()


def ttl_seconds() -> int:
    try:
        return max(60, int(env("FIELD_CACHE_TTL_SECONDS", "21600")))
    except ValueError:
        return 21600


def pack_dir(pack_id: str) -> Path:
    return cache_root() / pack_id


def cache_fresh(pack_id: str) -> bool:
    meta = pack_dir(pack_id) / "meta.json"
    stamp = pack_dir(pack_id) / ".fetched_at"
    if not meta.is_file() or not (pack_dir(pack_id) / "u.bin").is_file():
        return False
    try:
        age = time.time() - stamp.stat().st_mtime if stamp.is_file() else time.time() - meta.stat().st_mtime
    except OSError:
        return False
    return age <= ttl_seconds()


def s3_to_https(url: str) -> str:
    u = (url or "").strip()
    for a, b in PODAAC_S3_HTTPS:
        if u.startswith(a):
            return b + u[len(a) :]
    if u.startswith("s3://"):
        return ""
    return u


def earthdata_bearer(client: httpx.Client) -> str | None:
    token = env("EARTHDATA_TOKEN")
    if token:
        return token
    user, password = env("EARTHDATA_USERNAME"), env("EARTHDATA_PASSWORD")
    if not (user and password):
        return None
    try:
        r = client.post(URS_TOKEN, auth=(user, password))
        if r.status_code == 200:
            data = r.json() or {}
            t = data.get("access_token") or data.get("token")
            if t:
                return str(t)
        listed = client.get(URS_TOKENS, auth=(user, password))
        if listed.status_code == 200:
            rows = listed.json()
            if isinstance(rows, list) and rows:
                t = rows[0].get("access_token") or rows[0].get("token")
                if t:
                    return str(t)
    except Exception as exc:
        print(f"[oscar] token error: {exc}", file=sys.stderr)
    return None


def parse_granule(entry: dict) -> dict:
    https_nc: list[str] = []
    s3_nc: list[str] = []
    opendap: list[str] = []
    for link in entry.get("links") or []:
        if not isinstance(link, dict):
            continue
        url = str(link.get("href") or "").strip()
        title = str(link.get("title") or "")
        rel = str(link.get("rel") or "")
        if not url:
            continue
        low = url.lower()
        if "opendap.earthdata.nasa.gov" in low:
            opendap.append(url.rstrip("/"))
            continue
        is_nc = low.endswith(".nc") or "netcdf" in title.lower() or "data" in rel.lower()
        if not is_nc or low.endswith(".md5") or "s3credentials" in low:
            continue
        if url.startswith("s3://"):
            s3_nc.append(url)
        elif url.startswith("http"):
            https_nc.append(url)
    href = ""
    for c in https_nc + s3_nc:
        mapped = s3_to_https(c)
        if mapped.startswith("http"):
            href = mapped
            break
    title = str(entry.get("title") or "oscar")
    start = str(entry.get("time_start") or "")[:10].replace("-", "")
    stamp = start or title.replace("oscar_currents_nrt_", "").replace(".nc", "")
    dap = opendap[0] if opendap else ""
    cid = env("OSCAR_COLLECTION_ID", "C2102958977-POCLOUD")
    if not dap and cid and title:
        dap = f"https://opendap.earthdata.nasa.gov/collections/{cid}/granules/{title}"
    return {
        "href": href,
        "opendap": dap,
        "title": title,
        "stamp": stamp,
        "time": str(entry.get("time_start") or ""),
    }


def cmr_latest(client: httpx.Client) -> dict | None:
    short = env("OSCAR_SHORT_NAME", "OSCAR_L4_OC_NRT_V2.0")
    r = client.get(
        CMR_GRANULES,
        params={"short_name": short, "sort_key": "-start_date", "page_size": "1"},
    )
    r.raise_for_status()
    entries = ((r.json() or {}).get("feed") or {}).get("entry") or []
    if not entries:
        print(f"[oscar] cmr empty short_name={short}", file=sys.stderr)
        return None
    return parse_granule(entries[0])


def looks_like_netcdf(raw: bytes) -> bool:
    return len(raw) >= 8 and (raw.startswith(b"CDF") or raw.startswith(b"\x89HDF"))


def get_bytes(client: httpx.Client, url: str, token: str | None, label: str) -> bytes | None:
    fetch = s3_to_https(url) if url.startswith("s3://") else url
    if not fetch.startswith("http"):
        print(f"[oscar] {label} skip non-http {urlparse(url).scheme}", file=sys.stderr)
        return None
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = client.get(fetch, headers=headers)
    except Exception as exc:
        print(f"[oscar] {label}: {exc}", file=sys.stderr)
        return None
    if r.status_code == 200 and looks_like_netcdf(r.content):
        return r.content
    print(f"[oscar] {label} HTTP {r.status_code} ({len(r.content)} B) {fetch}", file=sys.stderr)
    return None


def opendap_urls(base: str) -> list[str]:
    """OpenDAP classic NetCDF. Avoid hyperslab brackets (some Earthdata edges 400)."""
    root = (base or "").rstrip("/")
    if not root.startswith("http"):
        return []
    # Structure vars: u.u / v.v (see .dds). Fetch separately then merge.
    return [
        f"{root}.nc?u.u",
        f"{root}.nc?v.v",
        f"{root}.nc?u.u,v.v",
        f"{root}.nc?u,v",
    ]


def opendap_axis_urls(base: str) -> tuple[str, str]:
    root = (base or "").rstrip("/")
    return f"{root}.ascii?lon", f"{root}.ascii?lat"


def _find_var(ds: Dataset, names: tuple[str, ...]):
    lower = {k.lower(): k for k in ds.variables}
    for n in names:
        if n.lower() in lower:
            return ds.variables[lower[n.lower()]]
    raise KeyError(f"missing vars {names}")


def decode_nc(raw: bytes) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict]:
    path = Path("/tmp") / f"oscar-{os.getpid()}.nc"
    path.write_bytes(raw)
    try:
        ds = Dataset(str(path), "r")
        try:
            # OpenDAP may return one Structure field per request (u.u or v.v).
            u = v = None
            for names in (("u", "uo", "water_u", "ucur", "ug"), ("v", "vo", "water_v", "vcur", "vg")):
                try:
                    arr = np.asarray(_find_var(ds, names).astype("f8")[:], dtype=float)
                except KeyError:
                    arr = None
                if names[0].startswith("u") or names[0] in {"uo", "water_u", "ucur", "ug"}:
                    if u is None and arr is not None:
                        u = arr
                if names[0].startswith("v") or names[0] in {"vo", "water_v", "vcur", "vg"}:
                    if v is None and arr is not None:
                        v = arr
            # Fallback: first 2D float var
            if u is None:
                for name, var in ds.variables.items():
                    if len(var.shape) >= 2 and var.dtype.kind == "f":
                        u = np.asarray(var[:], dtype=float)
                        break
            if v is None:
                # leave zeros-shaped later; caller may merge second file
                v = np.full_like(u, np.nan) if u is not None else None
            if u is None:
                raise KeyError("no UV vars in netcdf")
            try:
                lon = np.asarray(_find_var(ds, ("lon", "longitude", "x")).astype("f8")[:], dtype=float).reshape(-1)
            except KeyError:
                lon = np.linspace(0.0, 359.75, u.shape[-2] if u.ndim >= 2 else OSCAR_NLON)
            try:
                lat = np.asarray(_find_var(ds, ("lat", "latitude", "y")).astype("f8")[:], dtype=float).reshape(-1)
            except KeyError:
                lat = np.linspace(-89.75, 89.75, u.shape[-1] if u.ndim >= 2 else OSCAR_NLAT)
            while u.ndim > 2:
                u = u[0]
                v = v[0]
            # OSCAR native often (lon, lat) after squeeze
            if u.ndim == 2 and u.shape[0] == lon.size and u.shape[1] == lat.size:
                u = u.T
                v = v.T
            elif u.ndim == 2 and u.shape == (lat.size, lon.size):
                pass
            else:
                # best effort
                if u.ndim == 2 and u.shape[1] == lat.size and u.shape[0] == lon.size:
                    u = u.T
                    v = v.T
            lon = ((lon + 180.0) % 360.0) - 180.0
            order = np.argsort(lon)
            lon = lon[order]
            if u.ndim == 2 and u.shape[1] == order.size:
                u = u[:, order]
                v = v[:, order]
            if lat[0] > lat[-1]:
                lat = lat[::-1]
                u = u[::-1, :]
                v = v[::-1, :]
            meta = {"nx_src": int(u.shape[1]), "ny_src": int(u.shape[0])}
            return u, v, lon, lat, meta
        finally:
            ds.close()
    finally:
        try:
            path.unlink()
        except OSError:
            pass


def coarsen(u, v, lon, lat, step: int = OSCAR_DAP_STRIDE):
    if step <= 1 or u.ndim != 2:
        return u, v, lon, lat
    if u.shape[0] < 400 or u.shape[1] < 800:
        return u, v, lon, lat
    iy = np.arange(0, u.shape[0], step)
    ix = np.arange(0, u.shape[1], step)
    return u[np.ix_(iy, ix)], v[np.ix_(iy, ix)], lon[ix], lat[iy]


def resample_to_grid(
    u: np.ndarray,
    v: np.ndarray,
    lon: np.ndarray,
    lat: np.ndarray,
    nx: int,
    ny: int,
    bbox: list[float],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    from scipy.interpolate import RegularGridInterpolator

    west, south, east, north = bbox
    tgt_lon = np.linspace(west, east, nx)
    tgt_lat = np.linspace(south, north, ny)
    if nx == 721 and abs(west + 180) < 1e-6 and abs(east - 180) < 1e-6:
        tgt_lon = np.linspace(-180.0, 180.0, nx)
    if ny == 361 and abs(south + 90) < 1e-6 and abs(north - 90) < 1e-6:
        tgt_lat = np.linspace(-90.0, 90.0, ny)

    slon = ((lon + 180.0) % 360.0) - 180.0
    order = np.argsort(slon)
    slon = slon[order]
    su = np.asarray(u[:, order], dtype=float)
    sv = np.asarray(v[:, order], dtype=float)
    # pad for dateline wrap
    slon_p = np.concatenate([slon, slon[:1] + 360.0])
    su_p = np.concatenate([su, su[:, :1]], axis=1)
    sv_p = np.concatenate([sv, sv[:, :1]], axis=1)
    su_p = np.where(np.isfinite(su_p), su_p, np.nan)
    sv_p = np.where(np.isfinite(sv_p), sv_p, np.nan)

    fu = RegularGridInterpolator((lat, slon_p), su_p, bounds_error=False, fill_value=np.nan)
    fv = RegularGridInterpolator((lat, slon_p), sv_p, bounds_error=False, fill_value=np.nan)
    Lon, Lat = np.meshgrid(tgt_lon, tgt_lat)
    Lon_q = Lon.copy()
    Lon_q[Lon_q < slon_p[0]] += 360.0
    pts = np.column_stack([Lat.reshape(-1), Lon_q.reshape(-1)])
    uu = fu(pts).reshape(ny, nx).astype(np.float32)
    vv = fv(pts).reshape(ny, nx).astype(np.float32)
    mask = (np.isfinite(uu) & np.isfinite(vv) & (np.abs(uu) < 50) & (np.abs(vv) < 50)).astype(np.uint8)
    uu = np.where(mask == 1, uu, 0).astype(np.float32)
    vv = np.where(mask == 1, vv, 0).astype(np.float32)
    return uu.reshape(-1), vv.reshape(-1), mask.reshape(-1)


def write_pack(pack_id: str, u: np.ndarray, v: np.ndarray, mask: np.ndarray, meta_extra: dict) -> Path:
    tgt = PACK_TARGETS[pack_id]
    d = pack_dir(pack_id)
    d.mkdir(parents=True, exist_ok=True)
    u32 = np.asarray(u, dtype=np.float32)
    v32 = np.asarray(v, dtype=np.float32)
    m8 = np.asarray(mask, dtype=np.uint8)
    (d / "u.bin").write_bytes(u32.tobytes())
    (d / "v.bin").write_bytes(v32.tobytes())
    (d / "mask.bin").write_bytes(m8.tobytes())
    meta = {
        "nx": tgt["nx"],
        "ny": tgt["ny"],
        "bbox": tgt["bbox"],
        "time": meta_extra.get("time") or datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z"),
        "kind": "ocean",
        "uFile": "u.bin",
        "vFile": "v.bin",
        "scalarFile": None,
        "maskFile": "mask.bin",
        "meta": {
            "source": "live",
            "vars": ["uo", "vo"],
            "units": "m/s",
            "fill": 9999,
            "rowOrder": "south-north",
            "endian": "le",
            "dtype": "float32",
            "note": meta_extra.get("note", "OSCAR_L4_OC_NRT_V2.0"),
            "provider": meta_extra.get("provider", "oscar-v2"),
            "stamp": meta_extra.get("stamp"),
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "ttlSeconds": ttl_seconds(),
        },
    }
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    (d / ".fetched_at").write_text(str(time.time()), encoding="utf-8")
    return d



def parse_ascii_axis(text: str) -> np.ndarray:
    # OpenDAP ascii axis line
    body = text.strip().splitlines()[-1]
    if "," in body:
        parts = body.split(",")
        # drop name token
        nums = []
        for p in parts[1:] if not parts[0].replace(".", "", 1).replace("-", "", 1).isdigit() else parts:
            p = p.strip()
            if not p:
                continue
            try:
                nums.append(float(p))
            except ValueError:
                continue
        return np.asarray(nums, dtype=float)
    return np.asarray([], dtype=float)


def decode_single_uv_nc(raw: bytes, which: str) -> np.ndarray:
    path = Path("/tmp") / f"oscar-{os.getpid()}-{which}.nc"
    path.write_bytes(raw)
    try:
        ds = Dataset(str(path), "r")
        try:
            name = which if which in ds.variables else list(ds.variables)[0]
            arr = np.asarray(ds.variables[name][:], dtype=float)
            while arr.ndim > 2:
                arr = arr[0]
            # native (lon, lat) → (lat, lon)
            if arr.ndim == 2 and arr.shape[0] == OSCAR_NLON and arr.shape[1] == OSCAR_NLAT:
                arr = arr.T
            return arr
        finally:
            ds.close()
    finally:
        try:
            path.unlink()
        except OSError:
            pass


def fetch_uv_via_opendap(client: httpx.Client, dap: str, token: str | None) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict] | None:
    root = (dap or "").rstrip("/")
    if not root.startswith("http"):
        return None
    u_raw = get_bytes(client, f"{root}.nc?u.u", token, "opendap-u")
    v_raw = get_bytes(client, f"{root}.nc?v.v", token, "opendap-v")
    if not u_raw or not v_raw:
        return None
    u = decode_single_uv_nc(u_raw, "u")
    v = decode_single_uv_nc(v_raw, "v")
    lon = lat = None
    try:
        lon_r = client.get(f"{root}.ascii?lon", headers={"Authorization": f"Bearer {token}"} if token else {})
        lat_r = client.get(f"{root}.ascii?lat", headers={"Authorization": f"Bearer {token}"} if token else {})
        if lon_r.status_code == 200:
            lon = parse_ascii_axis(lon_r.text)
        if lat_r.status_code == 200:
            lat = parse_ascii_axis(lat_r.text)
    except Exception as exc:
        print(f"[oscar] axis ascii: {exc}", file=sys.stderr)
    if lon is None or lon.size == 0:
        lon = np.linspace(0.0, 359.75, u.shape[1] if u.shape[1] >= u.shape[0] else u.shape[0])
        if u.shape[1] != lon.size and u.shape[0] == lon.size:
            pass
    if lat is None or lat.size == 0:
        lat = np.linspace(-89.75, 89.75, u.shape[0])
    # ensure u is (nlat, nlon)
    if u.shape != (lat.size, lon.size):
        if u.shape == (lon.size, lat.size):
            u = u.T
            v = v.T
        elif u.shape[0] == lon.size and u.shape[1] == lat.size:
            u = u.T
            v = v.T
    lon = ((lon + 180.0) % 360.0) - 180.0
    order = np.argsort(lon)
    lon = lon[order]
    u = u[:, order]
    v = v[:, order]
    if lat[0] > lat[-1]:
        lat = lat[::-1]
        u = u[::-1, :]
        v = v[::-1, :]
    meta = {"nx_src": int(u.shape[1]), "ny_src": int(u.shape[0]), "fetch": "opendap"}
    return u, v, lon, lat, meta


def fetch_and_write(pack_id: str) -> dict:
    if pack_id not in PACK_TARGETS:
        raise SystemExit(f"unsupported pack {pack_id}")
    if env("CURRENT_SOURCE", "auto").lower() in {"demo", "off", "none"}:
        return {"ok": False, "reason": "CURRENT_SOURCE=demo", "fallback": "demo"}
    if not has_creds():
        return {"ok": False, "reason": "missing EARTHDATA_TOKEN or USERNAME/PASSWORD", "fallback": "demo"}

    if cache_fresh(pack_id):
        return {"ok": True, "cached": True, "pack": pack_id, "dir": str(pack_dir(pack_id))}

    lock = cache_root() / ".lock-oscar"
    cache_root().mkdir(parents=True, exist_ok=True)
    # simple lock
    for _ in range(60):
        try:
            fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            break
        except FileExistsError:
            if cache_fresh(pack_id):
                return {"ok": True, "cached": True, "pack": pack_id, "dir": str(pack_dir(pack_id))}
            time.sleep(1)
    else:
        return {"ok": False, "reason": "lock timeout", "fallback": "demo"}

    try:
        if cache_fresh(pack_id):
            return {"ok": True, "cached": True, "pack": pack_id, "dir": str(pack_dir(pack_id))}

        with httpx.Client(
            timeout=httpx.Timeout(120.0, connect=20.0),
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
            follow_redirects=True,
        ) as client:
            token = earthdata_bearer(client)
            if not token and not (env("EARTHDATA_USERNAME") and env("EARTHDATA_PASSWORD")):
                return {"ok": False, "reason": "no earthdata auth", "fallback": "demo"}
            granule = cmr_latest(client)
            if not granule:
                return {"ok": False, "reason": "cmr empty", "fallback": "demo"}
            print(
                f"[oscar] stamp={granule['stamp']} https={bool(granule['href'])} dap={bool(granule['opendap'])}",
                file=sys.stderr,
            )
            via = ""
            u = v = lon = lat = None
            meta = {}
            dap = granule.get("opendap") or ""
            if dap:
                got = fetch_uv_via_opendap(client, dap, token)
                if got:
                    u, v, lon, lat, meta = got
                    via = "opendap"
            if u is None and granule.get("href"):
                raw = get_bytes(client, granule["href"], token, "download")
                if raw:
                    u, v, lon, lat, meta = decode_nc(raw)
                    via = "https"
            if u is None or v is None or lon is None or lat is None:
                return {"ok": False, "reason": "empty download", "fallback": "demo"}

            u, v, lon, lat = coarsen(u, v, lon, lat)
            # treat absurd fill as nan
            u = np.where(np.abs(u) > 50, np.nan, u)
            v = np.where(np.abs(v) > 50, np.nan, v)
            tgt = PACK_TARGETS[pack_id]
            ou, ov, om = resample_to_grid(u, v, lon, lat, tgt["nx"], tgt["ny"], tgt["bbox"])
            ocean = int(om.sum())
            if ocean < 100:
                return {"ok": False, "reason": f"too few ocean cells {ocean}", "fallback": "demo"}
            write_pack(
                pack_id,
                ou,
                ov,
                om,
                {
                    "time": granule.get("time") or datetime.now(timezone.utc).isoformat(),
                    "stamp": granule.get("stamp"),
                    "note": f"OSCAR_L4_OC_NRT_V2.0 via {via}",
                    "provider": "oscar-v2",
                },
            )
            return {
                "ok": True,
                "cached": False,
                "pack": pack_id,
                "dir": str(pack_dir(pack_id)),
                "oceanCells": ocean,
                "via": via,
                "stamp": granule.get("stamp"),
            }
    finally:
        try:
            lock.unlink()
        except OSError:
            pass


def status() -> dict:
    out = {"ttlSeconds": ttl_seconds(), "cacheDir": str(cache_root()), "hasCreds": has_creds(), "packs": {}}
    for pid in PACK_TARGETS:
        d = pack_dir(pid)
        meta_p = d / "meta.json"
        fresh = cache_fresh(pid)
        info = {"fresh": fresh, "exists": meta_p.is_file()}
        if meta_p.is_file():
            try:
                info["meta"] = json.loads(meta_p.read_text(encoding="utf-8")).get("meta", {})
                info["time"] = json.loads(meta_p.read_text(encoding="utf-8")).get("time")
            except Exception:
                pass
        out["packs"][pid] = info
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", default="", help="global/ocean | regional/currents")
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()
    if args.status or not args.pack:
        print(json.dumps(status(), ensure_ascii=False, indent=2))
        return 0
    result = fetch_and_write(args.pack)
    print(json.dumps(result, ensure_ascii=False))
    if result.get("ok"):
        return 0
    if result.get("fallback") == "demo":
        return 2
    return 1


if __name__ == "__main__":
    sys.exit(main())
