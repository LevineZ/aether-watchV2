"""NC View core — open NetCDF + render one Panoply-style map (offline)."""

from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import struct
import sys
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.collections import LineCollection, PatchCollection
from matplotlib.patches import Polygon as MplPolygon
import numpy as np
import xarray as xr


def _app_root() -> Path:
    # PyInstaller onedir/onefile: bundled data lives under _MEIPASS
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


ROOT = _app_root()
DATA = ROOT / "data"
SAMPLE_NC = ROOT / "uv_2026011111.nc"
DEMO_LAYERS = ROOT / "demo_layers.nc"

TIME_DIM_RE = re.compile(r"^(time|times|t|date|datetime)$", re.I)
LEVEL_DIM_RE = re.compile(
    r"^(lev|level|levels|height|altitude|depth|z|plev|pressure|layer|height_above_ground|isobaricInhPa)$",
    re.I,
)
SKIP_VARS = {
    "time_bnds",
    "lon_bnds",
    "lat_bnds",
    "lat_bnd",
    "lon_bnd",
    "maskland",
    "landmask",
    "lsm",
}


def _setup_cjk_font() -> str | None:
    preferred = (
        "Hiragino Sans GB",
        "Arial Unicode MS",
        "Songti SC",
        "STHeiti",
        "PingFang SC",
        "Noto Sans CJK SC",
        "Microsoft YaHei",
        "SimHei",
    )
    available = {f.name for f in fm.fontManager.ttflist}
    for name in preferred:
        if name in available:
            plt.rcParams["font.sans-serif"] = [name, "DejaVu Sans"]
            plt.rcParams["axes.unicode_minus"] = False
            return name
    return None


CJK_FONT = _setup_cjk_font()


def _is_lon_like(name: str, da: xr.DataArray) -> bool:
    n = name.lower()
    if n in {"lon", "longitude", "xlong", "xlon", "long", "nav_lon"}:
        return True
    attrs = {a.lower(): str(v).lower() for a, v in da.attrs.items()}
    if "longitude" in attrs.get("standard_name", ""):
        return True
    units = attrs.get("units", "")
    return "degree" in units and "east" in units


def _is_lat_like(name: str, da: xr.DataArray) -> bool:
    n = name.lower()
    if n in {"lat", "latitude", "xlat", "nav_lat"}:
        return True
    attrs = {a.lower(): str(v).lower() for a, v in da.attrs.items()}
    if "latitude" in attrs.get("standard_name", ""):
        return True
    units = attrs.get("units", "")
    return "degree" in units and "north" in units


def _find_geo_axis(ds: xr.Dataset, kind: str) -> tuple[str, str] | None:
    """Find lon/lat even if stored as data_vars (WRF-style). Returns (var_name, spatial_dim)."""
    check = _is_lon_like if kind == "lon" else _is_lat_like
    # prefer coordinates, then data variables
    for pool in (list(ds.coords), list(ds.data_vars)):
        for key in pool:
            da = ds[key]
            if not check(key, da):
                continue
            if da.ndim == 1:
                return key, str(da.dims[0])
            # 2D/3D curvilinear: use last dim as x / second-last as y
            if da.ndim >= 2:
                if kind == "lon":
                    return key, str(da.dims[-1])
                return key, str(da.dims[-2] if da.ndim >= 2 else da.dims[0])
    # fallback: classic 1D dim names used as both dim and coord
    fallback = {
        "lon": ("lon", "longitude", "x"),
        "lat": ("lat", "latitude", "y"),
    }[kind]
    lower = {k.lower(): k for k in ds.dims}
    for n in fallback:
        if n in lower and n in {c.lower() for c in ds.coords}:
            return lower[n], lower[n]
    return None


def _dim_kind(name: str) -> str:
    if TIME_DIM_RE.match(name) or "time" in name.lower():
        return "time"
    if LEVEL_DIM_RE.match(name) or any(k in name.lower() for k in ("height", "level", "depth", "plev")):
        return "level"
    return "other"


def _parse_since_units(text: str | None) -> str | None:
    """Extract CF-like 'hours since ...' even if stuffed into standard_name."""
    if not text:
        return None
    t = str(text).strip()
    # normalize WRF oddity: 1970-01-01_00 → 1970-01-01 00:00:00
    t = t.replace("_", " ")
    m = re.search(
        r"((?:seconds|minutes|hours|days)\s+since\s+\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}(?::\d{2}){0,2})?)",
        t,
        flags=re.I,
    )
    if not m:
        return None
    units = m.group(1)
    # pad time if only hour given: "... since 1970-01-01 00"
    parts = units.split(" since ", 1)
    if len(parts) == 2 and re.search(r"\d{4}-\d{2}-\d{2} \d{1,2}$", parts[1]):
        units = parts[0] + " since " + parts[1] + ":00:00"
    return units


def _format_time_value(v, units: str | None = None) -> str:
    try:
        if isinstance(v, np.datetime64) or np.issubdtype(type(v), np.datetime64):
            return str(np.datetime_as_string(v, unit="m")).replace("T", " ")
    except Exception:
        pass

    if units:
        try:
            import cftime

            dt = cftime.num2date(float(v), units, calendar="standard")
            # cftime object → readable
            return f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d} {dt.hour:02d}:{dt.minute:02d}"
        except Exception:
            try:
                # pandas fallback
                import pandas as pd

                return str(pd.to_datetime(float(v), unit="h", origin="unix") if "hours since 1970" in units.lower() else v)
            except Exception:
                pass

    if isinstance(v, (float, np.floating)):
        # integer-like floats
        if float(v).is_integer():
            return str(int(v))
        return f"{float(v):.6g}"
    return str(v)


def _dim_labels(ds: xr.Dataset, dim: str, size: int) -> list[str]:
    if dim not in ds.coords and dim not in ds.variables:
        return [str(i) for i in range(size)]

    src = ds.coords[dim] if dim in ds.coords else ds[dim]
    vals = src.values
    attrs = {a.lower(): str(v) for a, v in src.attrs.items()}
    units = (
        _parse_since_units(src.encoding.get("units"))
        or _parse_since_units(attrs.get("units"))
        or _parse_since_units(attrs.get("standard_name"))
        or _parse_since_units(attrs.get("long_name"))
    )

    labels = []
    for i in range(size):
        labels.append(_format_time_value(vals[i], units if _dim_kind(dim) == "time" else None))
    return labels


def _var_kind(name: str, long_name: str, std: str, units: str) -> str:
    blob = f"{name} {long_name} {std} {units}".lower()
    if any(k in blob for k in ("diff", "anomaly", "bias", "差值", "difference")):
        return "diff"
    if name.lower() in {
        "__direction__",
        "__wind_direction__",
        "__current_direction__",
        "direction",
        "wind_direction",
        "dir",
    } or "direction" in blob or "风向" in blob or "流向" in blob:
        return "direction"
    if name.lower() in {"u", "v", "uo", "vo", "u10", "v10"} and "speed" not in blob and "dir" not in blob:
        return "uv_component"
    if any(k in blob for k in ("speed", "风速", "流速", "wspd", "wind_speed", "current_speed")):
        return "speed"
    if any(k in blob for k in ("wind", "current", "流场")):
        return "speed"
    if any(k in blob for k in ("wave", "swh", "hs", "波高", "significant_height")):
        return "wave"
    if any(k in blob for k in ("temp", "sst", "tas", "温度", "thetao", "t2m", "t2", "air_temperature")):
        return "temp"
    return "default"


def _pick_cmap(kind: str) -> str:
    return {
        "speed": "RdBu_r",  # 与 u/v 同色带：低值偏蓝、高值偏红
        "uv_component": "RdBu_r",
        "direction": "twilight",  # cyclic 0–360°
        "wave": "YlGnBu",
        "temp": "YlOrBr",
        "diff": "RdBu_r",
        "default": "viridis",
    }.get(kind, "viridis")


def resolve_style(kind: str, style: str) -> str:
    if style in {"heatmap", "streamline"}:
        return style
    if kind in {"speed", "wind"}:
        return "streamline"
    return "heatmap"


def _ceil_scale_hi(hi: float) -> float:
    """Round color-scale max up to an integer (e.g. 4.66→5, 18.82→19)."""
    import math

    if not np.isfinite(hi):
        return 1.0
    if hi <= 0:
        return float(math.ceil(hi)) if hi < 0 else 0.0
    ceiled = float(math.ceil(hi - 1e-12))
    return ceiled if ceiled > 0 else 1.0


def _robust_clim(data: np.ndarray, kind: str) -> tuple[float, float]:
    """Color limits from the values actually drawn.

    Each file uses its own minimum and maximum. Percentiles are only a
    fallback when a few spikes would otherwise flatten the scale.
    The upper end is rounded up to an integer for a cleaner scale.
    """
    if kind == "direction":
        return 0.0, 360.0
    finite = np.asarray(data, dtype=float)
    finite = finite[np.isfinite(finite)]
    if finite.size == 0:
        return 0.0, 1.0
    lo = float(np.min(finite))
    hi = float(np.max(finite))
    if finite.size >= 50:
        p2, p98 = np.percentile(finite, [2.0, 98.0])
        bulk = float(p98) - float(p2)
        if bulk > 0 and (hi - lo) > bulk * 20:
            lo, hi = float(p2), float(p98)
    if kind in {"diff", "uv_component"}:
        lim = _ceil_scale_hi(max(abs(lo), abs(hi), 1e-6))
        return -lim, lim
    if kind in {"speed", "wave"} and lo >= 0:
        lo = 0.0
    hi = _ceil_scale_hi(hi)
    if hi <= lo:
        hi = lo + 1.0
    return lo, hi


def _color_stats(data: np.ndarray, kind: str) -> dict[str, Any]:
    """Full-range track and a 40-bin histogram for the color slider."""
    finite = np.asarray(data, dtype=float)
    finite = finite[np.isfinite(finite)]
    if kind == "direction" or finite.size == 0:
        track = (0.0, 360.0) if kind == "direction" else (0.0, 1.0)
        if finite.size == 0:
            return {"track": track, "hist": [0] * 40}
    else:
        lo = float(np.min(finite))
        hi = float(np.max(finite))
        if kind in {"diff", "uv_component"}:
            lim = _ceil_scale_hi(max(abs(lo), abs(hi), 1e-6))
            lo, hi = -lim, lim
        elif kind in {"speed", "wave"} and lo >= 0:
            lo = 0.0
            hi = _ceil_scale_hi(hi)
        else:
            hi = _ceil_scale_hi(hi)
        if hi <= lo:
            hi = lo + 1.0
        track = (lo, hi)
    counts, _edges = np.histogram(finite, bins=40, range=track)
    return {"track": track, "hist": counts.astype(int).tolist()}


def _cbar_extend(vmin: float, vmax: float, track: tuple[float, float]) -> str:
    lo, hi = track
    eps = max(hi - lo, 1e-12) * 0.005
    low = vmin > lo + eps
    high = vmax < hi - eps
    if low and high:
        return "both"
    if low:
        return "min"
    if high:
        return "max"
    return "neither"


@lru_cache(maxsize=1)
def _load_zh_labels() -> dict[str, Any]:
    path = DATA / "var_labels.zh.json"
    if not path.exists():
        return {"names": {}, "standard_names": {}, "patterns": []}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def label_zh(name: str, long_name: str = "", standard_name: str = "") -> str:
    """Chinese display name. Extend via data/var_labels.zh.json — no code change."""
    cfg = _load_zh_labels()
    names = cfg.get("names") or {}
    if name in names:
        return str(names[name])
    lower_map = {str(k).lower(): v for k, v in names.items()}
    if name.lower() in lower_map:
        return str(lower_map[name.lower()])
    stds = cfg.get("standard_names") or {}
    if standard_name and standard_name in stds:
        return str(stds[standard_name])
    for pat in cfg.get("patterns") or []:
        try:
            if re.search(str(pat.get("match", "")), name):
                return str(pat.get("label") or name)
        except re.error:
            continue
    if long_name and long_name != name:
        return long_name
    return name


def _uv_direction_deg(u: np.ndarray, v: np.ndarray, *, convention: str = "to") -> np.ndarray:
    """Direction from U/V.

    convention='to'   : atan2(U,V)*180/π → flow/current going-toward (0=N, 90=E)
    convention='from' : meteorological wind-from (= to + 180°)
    """
    toward = np.mod(np.degrees(np.atan2(u, v)), 360.0)
    if convention == "from":
        return np.mod(toward + 180.0, 360.0)
    return toward


def _uv_pair_kind(u_name: str, v_name: str, ds: xr.Dataset) -> str:
    """Classify UV pair as wind or current — never mix the two."""
    blob = " ".join(
        [
            u_name,
            v_name,
            str(ds[u_name].attrs.get("long_name", "")),
            str(ds[v_name].attrs.get("long_name", "")),
            str(ds[u_name].attrs.get("standard_name", "")),
            str(ds[v_name].attrs.get("standard_name", "")),
        ]
    ).lower()
    wind_hit = any(
        k in blob
        for k in ("u10", "v10", "wind", "eastward_wind", "northward_wind", "风速", "风向")
    )
    current_hit = any(
        k in blob
        for k in (
            "current",
            "uo",
            "vo",
            "sea_water",
            "ocean",
            "water_velocity",
            "海流",
            "洋流",
            "流速",
        )
    )
    if wind_hit and not current_hit:
        return "wind"
    if current_hit and not wind_hit:
        return "current"
    if wind_hit and current_hit:
        # e.g. odd attrs: prefer explicit U10/V10 / uo/vo names
        if u_name.lower() in {"u10", "eastward_wind"} or v_name.lower() in {"v10", "northward_wind"}:
            return "wind"
        if u_name.lower() in {"uo", "eastward_sea_water_velocity"} or v_name.lower() in {
            "vo",
            "northward_sea_water_velocity",
        }:
            return "current"
    # bare u/v with no cue: leave unset — caller should not invent a mixed product
    return ""



def _extra_dims(ds: xr.Dataset, da: xr.DataArray, lon: str | None, lat: str | None) -> list[dict[str, Any]]:
    dims = [d for d in da.dims if d not in {lon, lat}]
    dims.sort(key=lambda d: {"time": 0, "level": 1}.get(_dim_kind(d), 2))
    out = []
    for d in dims:
        kind = _dim_kind(d)
        out.append(
            {
                "name": d,
                "size": int(da.sizes[d]),
                "labels": _dim_labels(ds, d, int(da.sizes[d])),
                "kind": kind,
                "is_time": kind == "time",
                "is_level": kind == "level",
            }
        )
    return out


def _list_plottable(
    ds: xr.Dataset,
    lon_dim: str | None,
    lat_dim: str | None,
    skip_names: set[str] | None = None,
) -> list[dict[str, Any]]:
    skip_names = {s.lower() for s in (skip_names or set())}
    out: list[dict[str, Any]] = []
    for name, da in ds.data_vars.items():
        if name.lower() in SKIP_VARS or name.lower() in skip_names or name.lower().endswith("_bnds"):
            continue
        if da.ndim < 2:
            continue
        dims = list(da.dims)
        if lon_dim and lon_dim not in dims:
            continue
        if lat_dim and lat_dim not in dims:
            continue
        std = str(da.attrs.get("standard_name", ""))
        long_name = str(da.attrs.get("long_name", name))
        units = str(da.attrs.get("units", ""))
        extras = _extra_dims(ds, da, lon_dim, lat_dim)
        item = {
            "name": name,
            "dims": dims,
            "shape": list(da.shape),
            "extra_dims": extras,
            "units": units,
            "long_name": long_name,
            "standard_name": std,
            "kind": _var_kind(name, long_name, std, units),
            "derived": None,
        }
        item["label_zh"] = label_zh(name, long_name, std)
        out.append(item)
    return out


def _component_pairs(variables: list[dict[str, Any]]) -> list[tuple[str, str, str]]:
    """Named X/Y pairs. The third item is wind, current, or '' when the file must be classified."""
    by_lower = {v["name"].lower(): v["name"] for v in variables if not v.get("derived")}
    specs = (
        (("windspeedx", "u10", "eastward_wind"), ("windspeedy", "v10", "northward_wind"), "wind"),
        (("depthaveragevelx", "uo"), ("depthaveragevely", "vo"), "current"),
        (("u",), ("v",), ""),
    )
    found: list[tuple[str, str, str]] = []
    used: set[str] = set()
    for u_keys, v_keys, kind in specs:
        u_name = next((by_lower[k] for k in u_keys if k in by_lower and by_lower[k] not in used), None)
        v_name = next((by_lower[k] for k in v_keys if k in by_lower and by_lower[k] not in used), None)
        if not u_name or not v_name:
            continue
        found.append((u_name, v_name, kind))
        used.add(u_name)
        used.add(v_name)
    return found


def _add_derived_uv(
    ds: xr.Dataset,
    variables: list[dict[str, Any]],
    lon_dim: str | None,
    lat_dim: str | None,
) -> None:
    """One map product per U/V pair: speed as color, direction as arrows."""
    for u_name, v_name, hinted in _component_pairs(variables):
        pair_kind = hinted or _uv_pair_kind(u_name, v_name, ds)
        if pair_kind not in {"wind", "current"}:
            continue
        _insert_uv_product(ds, variables, lon_dim, lat_dim, u_name, v_name, pair_kind)


def _insert_uv_product(
    ds: xr.Dataset,
    variables: list[dict[str, Any]],
    lon_dim: str | None,
    lat_dim: str | None,
    u_name: str,
    v_name: str,
    pair_kind: str,
) -> None:

    names = {v["name"] for v in variables}
    u = ds[u_name]
    extras = _extra_dims(ds, u, lon_dim, lat_dim)
    units = str(u.attrs.get("units", "m/s"))

    if pair_kind == "wind":
        name = "__wind__"
        zh = "风场"
        long_name = "风场（色块=风速，流线=风向）"
        blockers = {"speed", "wind_speed", "__wind__", "__wind_speed__", "__speed__"}
        std = "wind_speed"
    else:
        name = "__current__"
        zh = "流场"
        long_name = "流场（色块=全流速，流线=流向）"
        blockers = {"speed", "current_speed", "__current__", "__current_speed__", "__speed__"}
        std = "sea_water_speed"

    if names.intersection(blockers):
        return

    variables.insert(
        0,
        {
            "name": name,
            "dims": list(u.dims),
            "shape": list(u.shape),
            "extra_dims": extras,
            "units": units,
            "long_name": long_name,
            "standard_name": std,
            "kind": "speed",
            "label_zh": zh,
            "derived": {
                "op": "hypot",
                "u": u_name,
                "v": v_name,
                "pair_kind": pair_kind,
            },
        },
    )


def _select_slice(da: xr.DataArray, indices: dict[str, int], lon_dim: str, lat_dim: str) -> xr.DataArray:
    sel = {}
    for d in da.dims:
        if d in (lon_dim, lat_dim):
            continue
        idx = int(indices.get(d, 0))
        idx = max(0, min(idx, da.sizes[d] - 1))
        sel[d] = idx
    out = da.isel(**sel) if sel else da
    if out.ndim > 2:
        while out.ndim > 2:
            d = [x for x in out.dims if x not in (lon_dim, lat_dim)][0]
            out = out.isel({d: 0})
    if lon_dim in out.dims and lat_dim in out.dims and lon_dim != lat_dim:
        out = out.transpose(lat_dim, lon_dim)
    return out


def _attach_lonlat(
    sl: xr.DataArray,
    ds: xr.Dataset,
    lon_name: str,
    lat_name: str,
    lon_dim: str,
    lat_dim: str,
) -> xr.DataArray:
    """Attach lon/lat arrays onto a 2D slice so plotting can read them as coords."""
    lon_da = ds[lon_name]
    lat_da = ds[lat_name]
    coords: dict[str, Any] = {}
    if lon_da.ndim == 1 and lon_da.dims[0] == lon_dim:
        coords[lon_name] = (lon_dim, np.asarray(lon_da.values))
    elif lon_da.ndim >= 2:
        # take a 2D plane (drop leading non-spatial dims at 0)
        arr = lon_da.values
        while arr.ndim > 2:
            arr = arr[0]
        coords[lon_name] = ((lat_dim, lon_dim), np.asarray(arr))
    if lat_da.ndim == 1 and lat_da.dims[0] == lat_dim:
        coords[lat_name] = (lat_dim, np.asarray(lat_da.values))
    elif lat_da.ndim >= 2:
        arr = lat_da.values
        while arr.ndim > 2:
            arr = arr[0]
        coords[lat_name] = ((lat_dim, lon_dim), np.asarray(arr))
    return sl.assign_coords(coords) if coords else sl


def _apply_land_mask(ds: xr.Dataset, data: np.ndarray, lat_name: str, lon_name: str) -> np.ndarray:
    mask_name = next((k for k in ds.data_vars if k.lower() in {"maskland", "landmask", "lsm"}), None)
    if not mask_name:
        return data
    mask = ds[mask_name]
    try:
        m = np.array(mask.values)
        if m.shape != data.shape and mask.ndim == 2 and m.T.shape == data.shape:
            m = m.T
        if m.shape == data.shape:
            return np.where(m != 0, np.nan, data)
    except Exception:
        pass
    return data


def _mesh_triangles(ds: xr.Dataset, n_nodes: int) -> np.ndarray | None:
    """Return 0-based triangles (ntri, 3) for an unstructured mesh, or None."""
    candidates: list[xr.DataArray] = []
    for pool in (ds.coords, ds.data_vars):
        for name, da in pool.items():
            role = str(da.attrs.get("cf_role", "")).lower()
            if role != "face_node_connectivity" and "face_node" not in name.lower():
                continue
            if da.ndim == 2:
                candidates.append(da)
    if not candidates or n_nodes < 3:
        return None

    da = candidates[0]
    arr = np.asarray(da.values, dtype=float)
    if arr.shape[0] in (3, 4) and arr.shape[1] not in (3, 4):
        arr = arr.T
    if arr.ndim != 2 or arr.shape[1] not in (3, 4):
        return None

    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return None
    start = int(da.attrs.get("start_index", 1 if float(np.min(finite)) >= 1 else 0))

    parts: list[np.ndarray] = []
    tri3 = arr[:, :3]
    ok3 = np.isfinite(tri3).all(axis=1)
    if np.any(ok3):
        parts.append(tri3[ok3])
    if arr.shape[1] == 4:
        tri_b = arr[:, [0, 2, 3]]
        ok4 = np.isfinite(arr[:, 3]) & np.isfinite(arr[:, 0]) & np.isfinite(arr[:, 2])
        if np.any(ok4):
            parts.append(tri_b[ok4])
    if not parts:
        return None

    tri = np.rint(np.vstack(parts)).astype(np.int32) - start
    inside = (tri >= 0).all(axis=1) & (tri < n_nodes).all(axis=1)
    distinct = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
    tri = tri[inside & distinct]
    if tri.size == 0:
        return None
    return tri


def _lon_lat_extent(lon: np.ndarray, lat: np.ndarray) -> tuple[float, float, float, float]:
    lon_min, lon_max = float(np.nanmin(lon)), float(np.nanmax(lon))
    lat_min, lat_max = float(np.nanmin(lat)), float(np.nanmax(lat))
    # Tiny pad only — large pad left empty strips that look like "未渲染"
    pad_x = max((lon_max - lon_min) * 0.004, 0.002)
    pad_y = max((lat_max - lat_min) * 0.004, 0.002)
    return lon_min - pad_x, lon_max + pad_x, lat_min - pad_y, lat_max + pad_y


def _ring_to_xy(ring: list) -> np.ndarray:
    return np.asarray(ring, dtype=float)[:, :2]


@lru_cache(maxsize=4)
def _load_geojson(name: str) -> dict[str, Any]:
    path = DATA / name
    if not path.exists():
        return {"type": "FeatureCollection", "features": []}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _best_layer(kind: str) -> str:
    for scale in ("50m", "110m"):
        name = f"ne_{scale}_{kind}.geojson"
        if (DATA / name).exists():
            return name
    return f"ne_110m_{kind}.geojson"


def _iter_line_segments(geom: dict[str, Any]):
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "LineString":
        yield _ring_to_xy(coords)
    elif gtype == "MultiLineString":
        for line in coords:
            yield _ring_to_xy(line)
    elif gtype == "Polygon":
        if coords:
            yield _ring_to_xy(coords[0])
    elif gtype == "MultiPolygon":
        for poly in coords:
            if poly:
                yield _ring_to_xy(poly[0])


def _iter_polygons(geom: dict[str, Any]):
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Polygon":
        if coords:
            yield _ring_to_xy(coords[0])
    elif gtype == "MultiPolygon":
        for poly in coords:
            if poly:
                yield _ring_to_xy(poly[0])


def _bbox_overlaps(xy: np.ndarray, extent: tuple[float, float, float, float]) -> bool:
    if xy.size == 0:
        return False
    x0, x1, y0, y1 = extent
    return not (xy[:, 0].max() < x0 or xy[:, 0].min() > x1 or xy[:, 1].max() < y0 or xy[:, 1].min() > y1)


@lru_cache(maxsize=64)
def _clipped_basemap(extent_key: tuple[float, float, float, float]):
    land = _load_geojson(_best_layer("land"))
    coast = _load_geojson(_best_layer("coastline"))
    land_rings, coast_lines = [], []
    for feat in land.get("features", []):
        for ring in _iter_polygons(feat.get("geometry") or {}):
            if _bbox_overlaps(ring, extent_key):
                land_rings.append(ring)
    for feat in coast.get("features", []):
        for line in _iter_line_segments(feat.get("geometry") or {}):
            if _bbox_overlaps(line, extent_key):
                coast_lines.append(line)
    return land_rings, coast_lines


# Wider than this, the built-in Natural Earth coast is enough and much faster.
FINE_COAST_MAX_SPAN = 8.0
_GSHHS_INDEX: dict[tuple, tuple] = {}


def _gshhs_path() -> Path:
    return DATA / "coast" / "GSHHS_f_L1.shp"


def _coverage_note(lon, lat, extent: tuple[float, float, float, float]) -> str:
    """Empty string when the view contains data. Otherwise where the nearest point is."""
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    x0, x1, y0, y1 = extent
    if lon.ndim == 1 and lat.ndim == 1 and lon.shape != lat.shape:
        if not (
            np.nanmax(lon) < x0 or np.nanmin(lon) > x1 or np.nanmax(lat) < y0 or np.nanmin(lat) > y1
        ):
            return ""
        # Nearest axis values, reported as a corner of the grid.
        lon_i = int(np.nanargmin(np.where(lon < x0, x0 - lon, np.where(lon > x1, lon - x1, 0.0))))
        lat_i = int(np.nanargmin(np.where(lat < y0, y0 - lat, np.where(lat > y1, lat - y1, 0.0))))
        return f"此范围没有网格点\n最近的数据约在 {float(lon[lon_i]):.2f}°E，{float(lat[lat_i]):.2f}°N"
    lon_f = lon.ravel()
    lat_f = lat.ravel()
    if lon_f.size == 0 or lon_f.size != lat_f.size:
        return ""
    finite = np.isfinite(lon_f) & np.isfinite(lat_f)
    inside = finite & (lon_f >= x0) & (lon_f <= x1) & (lat_f >= y0) & (lat_f <= y1)
    if np.any(inside):
        return ""
    if not np.any(finite):
        return "此范围没有网格点"
    dx = np.where(lon_f < x0, x0 - lon_f, np.where(lon_f > x1, lon_f - x1, 0.0))
    dy = np.where(lat_f < y0, y0 - lat_f, np.where(lat_f > y1, lat_f - y1, 0.0))
    dist = np.where(finite, dx * dx + dy * dy, np.inf)
    i = int(np.argmin(dist))
    return f"此范围没有网格点\n最近的数据约在 {float(lon_f[i]):.2f}°E，{float(lat_f[i]):.2f}°N"


def _annotate_empty(ax, note: str) -> None:
    ax.text(
        0.5,
        0.5,
        note,
        transform=ax.transAxes,
        ha="center",
        va="center",
        fontsize=11,
        color="#243f48",
        bbox={"boxstyle": "round,pad=0.55", "fc": "white", "ec": "#d3dde4", "alpha": 0.95},
        zorder=8,
    )


def _resolve_view(lon, lat, view: tuple[float, float, float, float] | None):
    if view is None:
        return _lon_lat_extent(lon, lat)
    x0, x1, y0, y1 = (float(v) for v in view)
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    if x1 <= x0:
        x1 = x0 + 1e-4
    if y1 <= y0:
        y1 = y0 + 1e-4
    return x0, x1, y0, y1


def _gshhs_index(path: Path):
    stat = path.stat()
    key = (str(path), stat.st_mtime_ns, stat.st_size)
    cached = _GSHHS_INDEX.get(key)
    if cached is not None:
        return cached
    offsets, lengths = [], []
    xmin_l, ymin_l, xmax_l, ymax_l = [], [], [], []
    with path.open("rb") as f:
        f.seek(100)
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            _rec, words = struct.unpack(">ii", hdr)
            nbytes = words * 2
            pos = f.tell()
            head = f.read(min(44, nbytes))
            if len(head) < 44:
                break
            shape_type = struct.unpack("<i", head[:4])[0]
            if shape_type == 5:
                xmin, ymin, xmax, ymax = struct.unpack("<4d", head[4:36])
                offsets.append(pos)
                lengths.append(nbytes)
                xmin_l.append(xmin)
                ymin_l.append(ymin)
                xmax_l.append(xmax)
                ymax_l.append(ymax)
            f.seek(pos + nbytes)
    pack = (
        np.asarray(offsets, dtype=np.int64),
        np.asarray(lengths, dtype=np.int64),
        np.asarray(xmin_l, dtype=np.float64),
        np.asarray(ymin_l, dtype=np.float64),
        np.asarray(xmax_l, dtype=np.float64),
        np.asarray(ymax_l, dtype=np.float64),
    )
    _GSHHS_INDEX.clear()
    _GSHHS_INDEX[key] = pack
    return pack


def _read_shp_rings(f, offset: int, nbytes: int) -> list[np.ndarray]:
    f.seek(offset)
    head = f.read(44)
    if len(head) < 44:
        return []
    shape_type = struct.unpack("<i", head[:4])[0]
    if shape_type != 5:
        return []
    nparts, npts = struct.unpack("<ii", head[36:44])
    if nparts <= 0 or npts <= 0 or nparts > 100000 or npts > 5_000_000:
        return []
    parts = struct.unpack(f"<{nparts}i", f.read(4 * nparts))
    flat = np.fromfile(f, dtype="<f8", count=npts * 2)
    if flat.size != npts * 2:
        return []
    xy = flat.reshape(-1, 2)
    rings = []
    for i, start in enumerate(parts):
        end = parts[i + 1] if i + 1 < nparts else npts
        if end - start >= 3:
            rings.append(xy[start:end])
    return rings


def _assemble_clip(xy: np.ndarray, inside: np.ndarray, ix: np.ndarray, iy: np.ndarray):
    pin = np.roll(inside, 1)
    cross = inside != pin
    n_out = int(inside.sum() + cross.sum())
    if n_out < 3:
        return None
    contrib = inside.astype(np.int32) + cross.astype(np.int32)
    starts = np.cumsum(contrib) - contrib
    out = np.empty((n_out, 2), dtype=float)
    cidx = np.flatnonzero(cross)
    out[starts[cidx], 0] = ix[cidx]
    out[starts[cidx], 1] = iy[cidx]
    iidx = np.flatnonzero(inside)
    dest = starts[iidx] + cross[iidx].astype(np.int32)
    out[dest] = xy[iidx]
    return out


def _clip_xmin(xy: np.ndarray, x0: float):
    x = xy[:, 0]
    y = xy[:, 1]
    px = np.roll(x, 1)
    py = np.roll(y, 1)
    dx = x - px
    t = np.zeros_like(x)
    np.divide(x0 - px, dx, out=t, where=np.abs(dx) > 1e-15)
    return _assemble_clip(xy, x >= x0, np.full_like(x, x0), py + t * (y - py))


def _clip_xmax(xy: np.ndarray, x1: float):
    x = xy[:, 0]
    y = xy[:, 1]
    px = np.roll(x, 1)
    py = np.roll(y, 1)
    dx = x - px
    t = np.zeros_like(x)
    np.divide(x1 - px, dx, out=t, where=np.abs(dx) > 1e-15)
    return _assemble_clip(xy, x <= x1, np.full_like(x, x1), py + t * (y - py))


def _clip_ymin(xy: np.ndarray, y0: float):
    x = xy[:, 0]
    y = xy[:, 1]
    px = np.roll(x, 1)
    py = np.roll(y, 1)
    dy = y - py
    t = np.zeros_like(y)
    np.divide(y0 - py, dy, out=t, where=np.abs(dy) > 1e-15)
    return _assemble_clip(xy, y >= y0, px + t * (x - px), np.full_like(y, y0))


def _clip_ymax(xy: np.ndarray, y1: float):
    x = xy[:, 0]
    y = xy[:, 1]
    px = np.roll(x, 1)
    py = np.roll(y, 1)
    dy = y - py
    t = np.zeros_like(y)
    np.divide(y1 - py, dy, out=t, where=np.abs(dy) > 1e-15)
    return _assemble_clip(xy, y <= y1, px + t * (x - px), np.full_like(y, y1))


def _clip_polygon(xy: np.ndarray, extent: tuple[float, float, float, float]):
    x0, x1, y0, y1 = extent
    out = _clip_xmin(xy, x0)
    if out is None:
        return None
    out = _clip_xmax(out, x1)
    if out is None:
        return None
    out = _clip_ymin(out, y0)
    if out is None:
        return None
    return _clip_ymax(out, y1)


def _fine_land_polys(extent: tuple[float, float, float, float]) -> list[np.ndarray]:
    path = _gshhs_path()
    if not path.is_file():
        return []
    offsets, lengths, xmin, ymin, xmax, ymax = _gshhs_index(path)
    x0, x1, y0, y1 = extent
    hit = ~((xmax < x0) | (xmin > x1) | (ymax < y0) | (ymin > y1))
    idxs = np.flatnonzero(hit)
    polys: list[np.ndarray] = []
    with path.open("rb") as f:
        for i in idxs:
            for ring in _read_shp_rings(f, int(offsets[i]), int(lengths[i])):
                if xmin[i] >= x0 and xmax[i] <= x1 and ymin[i] >= y0 and ymax[i] <= y1:
                    piece = ring
                else:
                    piece = _clip_polygon(ring, extent)
                if piece is None or piece.shape[0] < 3:
                    continue
                if piece.shape[0] > 80000:
                    step = int(np.ceil(piece.shape[0] / 80000))
                    piece = piece[::step]
                polys.append(np.asarray(piece, dtype=float))
    return polys


def _quiver_on_nodes(ax, lon, lat, u, v, extent) -> None:
    """Evenly spaced arrows on an unstructured mesh. streamplot needs a regular grid."""
    lon = np.asarray(lon, dtype=float).ravel()
    lat = np.asarray(lat, dtype=float).ravel()
    u = np.asarray(u, dtype=float).ravel()
    v = np.asarray(v, dtype=float).ravel()
    n = min(lon.size, lat.size, u.size, v.size)
    if n < 4:
        return
    lon, lat, u, v = lon[:n], lat[:n], u[:n], v[:n]
    x0, x1, y0, y1 = extent
    ok = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(u) & np.isfinite(v)
    ok &= (lon >= x0) & (lon <= x1) & (lat >= y0) & (lat <= y1)
    if int(np.count_nonzero(ok)) < 4:
        return
    nx, ny = 32, 24
    span_x = max(x1 - x0, 1e-6)
    span_y = max(y1 - y0, 1e-6)
    ix = np.clip(((lon - x0) / span_x * nx).astype(np.int32), 0, nx - 1)
    iy = np.clip(((lat - y0) / span_y * ny).astype(np.int32), 0, ny - 1)
    cell = iy * nx + ix
    speed = np.where(ok, np.hypot(u, v), -1.0)
    best: dict[int, int] = {}
    for i in np.argsort(speed):
        if speed[i] < 0:
            continue
        best[int(cell[i])] = int(i)
    idx = np.fromiter(best.values(), dtype=np.int64)
    ax.quiver(
        lon[idx],
        lat[idx],
        u[idx],
        v[idx],
        color="#1c2830",
        angles="xy",
        scale_units="width",
        width=0.0026,
        headwidth=3.4,
        headlength=4.4,
        headaxislength=3.6,
        pivot="mid",
        zorder=4,
    )


def _triangles_in_view(triangles: np.ndarray, lon, lat, extent) -> np.ndarray:
    x0, x1, y0, y1 = extent
    px = (x1 - x0) * 0.05
    py = (y1 - y0) * 0.05
    inside = (lon >= x0 - px) & (lon <= x1 + px) & (lat >= y0 - py) & (lat <= y1 + py)
    keep = inside[triangles].any(axis=1)
    if not np.any(keep):
        return triangles[:0]
    return triangles[keep]


def _add_geojson_basemap(ax, extent: tuple[float, float, float, float]) -> None:
    key = tuple(round(float(v), 3) for v in extent)
    land_rings, coast_lines = _clipped_basemap(key)  # type: ignore[arg-type]
    if land_rings:
        ax.add_collection(
            PatchCollection(
                [MplPolygon(r, closed=True) for r in land_rings],
                facecolor="#d0d0d0",
                edgecolor="none",
                zorder=5,
            ),
            autolim=False,
        )
    if coast_lines:
        ax.add_collection(
            LineCollection(coast_lines, colors="#111111", linewidths=0.8, zorder=6),
            autolim=False,
        )


def _apply_map_frame(ax, extent: tuple[float, float, float, float]) -> bool:
    """Draw the coast and lock the axes to this view. True when the fine shore was used."""
    ax.set_xlim(extent[0], extent[1])
    ax.set_ylim(extent[2], extent[3])
    span = max(extent[1] - extent[0], extent[3] - extent[2])
    fine = False
    if span <= FINE_COAST_MAX_SPAN and _gshhs_path().is_file():
        try:
            polys = _fine_land_polys(extent)
        except Exception:
            polys = []
        if polys:
            ax.add_collection(
                PatchCollection(
                    [MplPolygon(r, closed=True) for r in polys],
                    facecolor="#d0d0d0",
                    edgecolor="#111111",
                    linewidths=0.4,
                    zorder=5,
                ),
                autolim=False,
            )
            fine = True
    if not fine:
        _add_geojson_basemap(ax, extent)
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlim(extent[0], extent[1])
    ax.set_ylim(extent[2], extent[3])
    return fine


def _attach_aligned_colorbar(fig, ax, mesh, units: str, extend: str):
    """Colorbar shares the axes box, so its ends line up with the map."""
    from mpl_toolkits.axes_grid1 import make_axes_locatable

    divider = make_axes_locatable(ax)
    cax = divider.append_axes("right", size="3.2%", pad=0.16)
    cbar = fig.colorbar(mesh, cax=cax, extend=extend)
    cbar.ax.tick_params(labelsize=8)
    if units:
        cbar.set_label(units, fontsize=9)
    return cbar


def _plot_png(
    da: xr.DataArray,
    lon_name: str,
    lat_name: str,
    title: str,
    units: str,
    kind: str = "default",
    subtitle: str = "",
    style: str = "auto",
    u_field: np.ndarray | None = None,
    v_field: np.ndarray | None = None,
    triangles: np.ndarray | None = None,
    clim: tuple[float, float] | None = None,
    view: tuple[float, float, float, float] | None = None,
    colorbar: bool = True,
) -> tuple[bytes, dict[str, Any]]:
    data = np.array(da.values, dtype=float)
    fill = da.attrs.get("_FillValue", da.encoding.get("_FillValue"))
    if fill is not None:
        try:
            data = np.where(data == float(fill), np.nan, data)
        except Exception:
            pass
    data = np.where(np.isfinite(data), data, np.nan)

    lon = np.array(da[lon_name].values) if lon_name in da.coords else np.arange(data.shape[-1])
    lat = np.array(da[lat_name].values) if lat_name in da.coords else np.arange(data.shape[0])

    uu = None if u_field is None else np.array(u_field, dtype=float)
    vv = None if v_field is None else np.array(v_field, dtype=float)

    max_side = 720
    if data.ndim == 2 and max(data.shape) > max_side and lon.ndim == 1 and lat.ndim == 1:
        step_y = max(1, data.shape[0] // max_side)
        step_x = max(1, data.shape[1] // max_side)
        data = data[::step_y, ::step_x]
        lat = lat[::step_y]
        lon = lon[::step_x]
        if uu is not None and uu.shape[0] >= step_y and uu.shape[1] >= step_x:
            uu = uu[::step_y, ::step_x]
            vv = vv[::step_y, ::step_x]

    style = resolve_style(kind, style)
    cmap = _pick_cmap(kind)
    stats = _color_stats(data, kind)
    if clim is not None:
        vmin, vmax = float(clim[0]), float(clim[1])
        if vmax < vmin:
            vmin, vmax = vmax, vmin
        if vmax <= vmin:
            vmax = vmin + 1e-6
    else:
        vmin, vmax = _robust_clim(data, kind)
    extend = _cbar_extend(vmin, vmax, stats["track"])

    fig, ax = plt.subplots(figsize=(10.0, 6.6), dpi=140)
    fig.patch.set_facecolor("#ffffff")
    # Slightly cooler than pale yellow so low values stay distinct from "empty"
    ax.set_facecolor("#dfe7ee")
    fig.subplots_adjust(left=0.06, right=0.96, bottom=0.08, top=0.91)

    mesh = None
    fine_coast = False
    empty_hint = ""
    unstructured = (
        data.ndim == 1
        and lon.ndim == 1
        and lat.ndim == 1
        and lon.size == lat.size
        and data.size > 0
    )
    if unstructured:
        from matplotlib.tri import Triangulation

        extent = _resolve_view(lon, lat, view)
        empty_hint = _coverage_note(lon, lat, extent) if view is not None else ""
        if empty_hint:
            fine_coast = _apply_map_frame(ax, extent)
            _annotate_empty(ax, empty_hint)
        else:
            if view is not None and triangles is not None and getattr(triangles, "size", 0):
                triangles = _triangles_in_view(triangles, lon, lat, extent)
            plotted = False
            if triangles is not None and triangles.ndim == 2 and triangles.shape[1] == 3 and triangles.shape[0] > 0:
                lon_f = np.asarray(lon, dtype=float)
                lat_f = np.asarray(lat, dtype=float)
                triang = Triangulation(lon_f, lat_f, triangles)
                # flat shading: gouraud on large SCHISM meshes can drop whole
                # eastern/southern bands, leaving blank strips next to land.
                if data.size == lon_f.size:
                    face = np.nanmean(np.asarray(data, dtype=float)[triangles], axis=1)
                    mesh = ax.tripcolor(
                        triang,
                        facecolors=face,
                        shading="flat",
                        cmap=cmap,
                        vmin=vmin,
                        vmax=vmax,
                        zorder=1,
                    )
                    plotted = True
                elif data.size == triangles.shape[0]:
                    mesh = ax.tripcolor(
                        triang,
                        facecolors=np.asarray(data, dtype=float),
                        shading="flat",
                        cmap=cmap,
                        vmin=vmin,
                        vmax=vmax,
                        zorder=1,
                    )
                    plotted = True
            if not plotted:
                mesh = ax.scatter(
                    lon, lat, c=data, s=2, cmap=cmap, vmin=vmin, vmax=vmax, linewidths=0, zorder=1
                )
            if style == "streamline" and uu is not None and vv is not None:
                _quiver_on_nodes(ax, lon, lat, uu, vv, extent)
            fine_coast = _apply_map_frame(ax, extent)
            if mesh is not None:
                mesh.set_clip_path(ax.patch)
    elif lon.ndim == 1 and lat.ndim == 1:
        extent = _resolve_view(lon, lat, view)
        empty_hint = _coverage_note(lon, lat, extent) if view is not None else ""
        ax.set_xlim(extent[0], extent[1])
        ax.set_ylim(extent[2], extent[3])

        if not empty_hint:
            mesh = ax.pcolormesh(lon, lat, data, shading="auto", cmap=cmap, vmin=vmin, vmax=vmax, zorder=1)

        if not empty_hint and style == "streamline" and uu is not None and vv is not None:
            ny, nx = uu.shape
            step = max(1, min(ny, nx) // 45)
            lon_s = lon[::step]
            lat_s = lat[::step]
            u_s = np.nan_to_num(uu[::step, ::step], nan=0.0)
            v_s = np.nan_to_num(vv[::step, ::step], nan=0.0)
            try:
                ax.streamplot(
                    lon_s,
                    lat_s,
                    u_s,
                    v_s,
                    color="#1a1a1a",
                    linewidth=0.55,
                    density=1.15,
                    arrowsize=0.7,
                    zorder=4,
                )
            except Exception:
                ax.quiver(
                    lon_s[::2],
                    lat_s[::2],
                    u_s[::2, ::2],
                    v_s[::2, ::2],
                    color="#222222",
                    width=0.0025,
                    zorder=4,
                )

        fine_coast = _apply_map_frame(ax, extent)
        if empty_hint:
            _annotate_empty(ax, empty_hint)
    else:
        mesh = ax.pcolormesh(data, shading="auto", cmap=cmap, vmin=vmin, vmax=vmax)

    ax.grid(True, linestyle="--", linewidth=0.4, color="#7a7a7a", alpha=0.55, zorder=3)
    ax.set_xlabel("Longitude", fontsize=10)
    ax.set_ylabel("Latitude", fontsize=10)
    ax.tick_params(labelsize=8)

    full_title = title
    if subtitle:
        full_title = f"{title}\n{subtitle}"
    ax.set_title(full_title, fontsize=11, pad=6)

    if mesh is not None:
        if colorbar:
            _attach_aligned_colorbar(fig, ax, mesh, units, extend)
            # Divider resizes axes; re-assert limits + clip so mesh isn't truncated.
            if "extent" in locals() and extent is not None:
                ax.set_xlim(extent[0], extent[1])
                ax.set_ylim(extent[2], extent[3])
        mesh.set_clip_path(ax.patch)

    fig.canvas.draw()
    buf = io.BytesIO()
    fig.savefig(
        buf,
        format="png",
        dpi=160,
        facecolor=fig.get_facecolor(),
        bbox_inches="tight",
        pad_inches=0.12,
    )
    plt.close(fig)
    info = {
        "track": stats["track"],
        "hist": stats["hist"],
        "cmap": cmap,
        "kind": kind,
        "units": units or "",
        "applied": (float(vmin), float(vmax)),
        "fine_coast": fine_coast,
        "view_custom": view is not None,
        "empty_hint": empty_hint,
    }
    return buf.getvalue(), info


# --- public API -------------------------------------------------------------


def _path_has_non_ascii(path: Path) -> bool:
    try:
        str(path).encode("ascii")
        return False
    except UnicodeEncodeError:
        return True


def _win_safe_nc_path(path: Path) -> Path:
    """netCDF4/HDF5 on Windows often fails (Errno 22) on Unicode paths.

    Copy to %TEMP%\\ncview_nc\\ with an ASCII-only path when needed.
    """
    path = path.resolve()
    if sys.platform != "win32" or not _path_has_non_ascii(path):
        return path
    dest_dir = Path(tempfile.gettempdir()) / "ncview_nc"
    dest_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.md5(str(path).encode("utf-8")).hexdigest()[:12]
    # keep .nc suffix; name itself is ASCII
    safe_name = path.name.encode("ascii", "ignore").decode("ascii") or "data.nc"
    if not safe_name.lower().endswith(".nc"):
        safe_name = safe_name + ".nc"
    dest = dest_dir / f"{digest}_{safe_name}"
    try:
        if (not dest.exists()) or dest.stat().st_mtime < path.stat().st_mtime or dest.stat().st_size != path.stat().st_size:
            shutil.copy2(path, dest)
    except OSError:
        shutil.copy2(path, dest)
    return dest


def open_nc(path: str | Path) -> dict[str, Any]:
    """Inspect a NetCDF file. Returns meta dict used by render_plot()."""
    orig = Path(path)
    if not orig.exists():
        raise FileNotFoundError(str(orig))
    open_path = _win_safe_nc_path(orig)
    ds = xr.open_dataset(open_path)
    try:
        lon_axis = _find_geo_axis(ds, "lon")
        lat_axis = _find_geo_axis(ds, "lat")
        if not lon_axis or not lat_axis:
            raise ValueError(
                "No lon/lat coordinates found "
                "(need lon/lat variables or coords; WRF-style data_vars are supported)"
            )
        lon_name, lon_dim = lon_axis
        lat_name, lat_dim = lat_axis
        variables = _list_plottable(ds, lon_dim, lat_dim, skip_names={lon_name, lat_name})
        _add_derived_uv(ds, variables, lon_dim, lat_dim)
        if not variables:
            raise ValueError("No 2D+ variables found to plot")
        for item in variables:
            item["default_style"] = resolve_style(item.get("kind") or "default", "auto")
            item["has_level"] = any(d.get("is_level") for d in item.get("extra_dims") or [])
            item["has_time"] = any(d.get("is_time") for d in item.get("extra_dims") or [])
        uv_pair = None
        ranked = []
        for u_name, v_name, hinted in _component_pairs(variables):
            kind = hinted or _uv_pair_kind(u_name, v_name, ds)
            if kind in {"wind", "current"}:
                ranked.append((0 if kind == "wind" else 1, u_name, v_name))
        if ranked:
            ranked.sort()
            uv_pair = {"u": ranked[0][1], "v": ranked[0][2]}
        extent = None
        try:
            lon_v = np.asarray(ds[lon_name].values, dtype=float)
            lat_v = np.asarray(ds[lat_name].values, dtype=float)
            if lon_v.size and lat_v.size and np.isfinite(lon_v).any() and np.isfinite(lat_v).any():
                extent = (
                    float(np.nanmin(lon_v)),
                    float(np.nanmax(lon_v)),
                    float(np.nanmin(lat_v)),
                    float(np.nanmax(lat_v)),
                )
        except Exception:
            extent = None
    finally:
        ds.close()
    return {
        "path": str(open_path.resolve()),
        "filename": orig.name,
        "lon": lon_name,
        "lat": lat_name,
        "lon_dim": lon_dim,
        "lat_dim": lat_dim,
        "variables": variables,
        "uv_pair": uv_pair,
        "extent": extent,
    }


def render_plot(
    meta: dict[str, Any],
    variable: str,
    indices: dict[str, int] | None = None,
    style: str = "auto",
    clim: tuple[float, float] | None = None,
    view: tuple[float, float, float, float] | None = None,
    with_info: bool = False,
    colorbar: bool = True,
):
    """Render one map PNG for the selected variable / time / level."""
    indices = indices or {}
    lon_name, lat_name = meta["lon"], meta["lat"]
    lon_dim = meta.get("lon_dim") or lon_name
    lat_dim = meta.get("lat_dim") or lat_name
    var_meta = next((v for v in meta["variables"] if v["name"] == variable), None)
    if not var_meta:
        raise ValueError(f"Unknown variable: {variable}")

    ds = xr.open_dataset(meta["path"])
    try:
        derived = var_meta.get("derived")
        u_arr = v_arr = None
        uv = meta.get("uv_pair") or {}

        if derived and derived.get("op") in {"hypot", "atan2_deg"}:
            u = _select_slice(ds[derived["u"]], indices, lon_dim, lat_dim)
            v = _select_slice(ds[derived["v"]], indices, lon_dim, lat_dim)
            u = _attach_lonlat(u, ds, lon_name, lat_name, lon_dim, lat_dim)
            v = _attach_lonlat(v, ds, lon_name, lat_name, lon_dim, lat_dim)
            u_arr = _apply_land_mask(ds, np.array(u.values, dtype=float), lat_name, lon_name)
            v_arr = _apply_land_mask(ds, np.array(v.values, dtype=float), lat_name, lon_name)
            if derived["op"] == "hypot":
                field = np.hypot(u_arr, v_arr)
            else:
                field = _uv_direction_deg(
                    u_arr, v_arr, convention=str(derived.get("convention") or "to")
                )
            sl = u.copy(data=field)
            sl.attrs["long_name"] = var_meta.get("label_zh") or var_meta["long_name"]
            sl.attrs["units"] = var_meta.get("units") or ("m/s" if derived["op"] == "hypot" else "degree")
        else:
            if variable not in ds.data_vars:
                raise ValueError(f"Unknown variable: {variable}")
            da = ds[variable]
            sl = _select_slice(da, indices, lon_dim, lat_dim)
            sl = _attach_lonlat(sl, ds, lon_name, lat_name, lon_dim, lat_dim)
            data = _apply_land_mask(ds, np.array(sl.values, dtype=float), lat_name, lon_name)
            sl = sl.copy(data=data)
            if uv.get("u") and uv.get("v") and uv["u"] in ds and uv["v"] in ds:
                u_sl = _attach_lonlat(
                    _select_slice(ds[uv["u"]], indices, lon_dim, lat_dim),
                    ds,
                    lon_name,
                    lat_name,
                    lon_dim,
                    lat_dim,
                )
                v_sl = _attach_lonlat(
                    _select_slice(ds[uv["v"]], indices, lon_dim, lat_dim),
                    ds,
                    lon_name,
                    lat_name,
                    lon_dim,
                    lat_dim,
                )
                u_arr = _apply_land_mask(ds, np.array(u_sl.values, dtype=float), lat_name, lon_name)
                v_arr = _apply_land_mask(ds, np.array(v_sl.values, dtype=float), lat_name, lon_name)

        title = str(var_meta.get("label_zh") or var_meta.get("long_name") or variable)
        units = str(var_meta.get("units") or sl.attrs.get("units", ""))
        kind = var_meta.get("kind") or "default"

        parts = []
        for d in var_meta.get("extra_dims") or []:
            name = d["name"]
            idx = int(indices.get(name, 0))
            labels = d.get("labels") or []
            label = labels[idx] if idx < len(labels) else str(idx)
            if d.get("is_time"):
                parts.append(label)
            elif d.get("is_level"):
                parts.append(f"高度 {label}")
            else:
                parts.append(f"{name}={label}")
        subtitle = " · ".join(parts)

        triangles = None
        if sl.ndim == 1 and sl.dims:
            triangles = _mesh_triangles(ds, int(sl.sizes[sl.dims[0]]))

        png, info = _plot_png(
            sl,
            lon_name,
            lat_name,
            title,
            units,
            kind=kind,
            subtitle=subtitle,
            style=style,
            u_field=u_arr,
            v_field=v_arr,
            triangles=triangles,
            clim=clim,
            view=view,
            colorbar=colorbar,
        )
        if with_info:
            return {"png": png, **info}
        return png
    finally:
        ds.close()


def ensure_demo_layers() -> Path:
    if not DEMO_LAYERS.exists():
        _write_layered_demo(DEMO_LAYERS)
    return DEMO_LAYERS


def _write_layered_demo(path: Path) -> None:
    lon = np.linspace(114.5, 115.5, 81)
    lat = np.linspace(22.05, 22.85, 65)
    lon2d, lat2d = np.meshgrid(lon, lat)
    times = np.array(
        ["2026-01-11T09:00", "2026-01-11T12:00", "2026-01-11T15:00", "2026-01-11T18:00"],
        dtype="datetime64[h]",
    ).astype("datetime64[ns]")
    heights = np.array([10.0, 20.0, 50.0, 100.0], dtype="float32")

    nt, nh = len(times), len(heights)
    temp = np.empty((nt, nh, lat.size, lon.size), dtype="float32")
    u = np.empty_like(temp)
    v = np.empty_like(temp)

    for it in range(nt):
        for ih, h in enumerate(heights):
            base = 18 + 4 * np.sin(it / 3.0) - 0.04 * h
            temp[it, ih] = base + 1.5 * np.sin(np.deg2rad(lon2d * 40)) + 0.8 * (lat2d - 22.4) * 10
            ang = np.deg2rad(40 * it + h * 0.5)
            spd = 2.0 + 0.03 * h + 1.2 * np.sin(np.deg2rad(lon2d * 20 + it * 30))
            u[it, ih] = spd * np.cos(ang) + 0.4 * np.sin(np.deg2rad(lat2d * 50))
            v[it, ih] = spd * np.sin(ang) + 0.3 * np.cos(np.deg2rad(lon2d * 50))

    ds = xr.Dataset(
        {
            "temp": (
                ("time", "height", "lat", "lon"),
                temp,
                {"long_name": "气温", "units": "degC", "standard_name": "air_temperature"},
            ),
            "u": (("time", "height", "lat", "lon"), u, {"long_name": "风速u分量", "units": "m/s"}),
            "v": (("time", "height", "lat", "lon"), v, {"long_name": "风速v分量", "units": "m/s"}),
        },
        coords={
            "time": ("time", times),
            "height": ("height", heights, {"units": "m", "long_name": "height above surface"}),
            "lat": ("lat", lat.astype("float32"), {"units": "degrees_north"}),
            "lon": ("lon", lon.astype("float32"), {"units": "degrees_east"}),
        },
        attrs={"title": "Demo multi time/height for NC View"},
    )
    ds.to_netcdf(path)
    ds.close()


if __name__ == "__main__":
    # ponytail: one assert that fails if UV synthesis formulas break
    u = np.array([1.0, 0.0, -1.0, 0.0])
    v = np.array([0.0, 1.0, 0.0, -1.0])
    assert np.allclose(np.hypot(u, v), [1, 1, 1, 1])
    assert np.allclose(_uv_direction_deg(u, v, convention="to"), [90.0, 0.0, 270.0, 180.0])
    assert np.allclose(_uv_direction_deg(u, v, convention="from"), [270.0, 180.0, 90.0, 0.0])

    _load_zh_labels.cache_clear()
    wrf = open_nc(ROOT / "sample-file" / "WRFOUT_2025-06-27_01.nc")
    wrf_names = {v["name"] for v in wrf["variables"]}
    assert "__wind__" in wrf_names
    assert "__wind_direction__" not in wrf_names and "__wind_speed__" not in wrf_names
    w = next(v for v in wrf["variables"] if v["name"] == "__wind__")
    assert w["label_zh"] == "风场" and w["derived"]["op"] == "hypot"
    assert resolve_style(w["kind"], "auto") == "streamline"

    ocean = open_nc(ROOT / "uv_2026011111.nc")
    ocean_names = {v["name"] for v in ocean["variables"]}
    assert "__current__" in ocean_names
    assert "__current_direction__" not in ocean_names
    c = next(v for v in ocean["variables"] if v["name"] == "__current__")
    assert c["label_zh"] == "流场" and c["derived"]["pair_kind"] == "current"
    print("ok", w["label_zh"], c["label_zh"])
