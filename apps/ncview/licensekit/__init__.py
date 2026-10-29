"""RomesView licensing (full edition).

Offline Ed25519-signed activation codes. Public key is embedded; private key
stays only with the vendor (tools/license_private.pem — never ship it).

Honest limit: a determined reverse-engineer can patch the binary to skip checks.
Forging activation codes without the private key is not practical.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import platform
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

# full | trial — flipped per git branch
EDITION = "full"
TRIAL_DAYS = 7
# Bump when shipping a new trial zip so prior installs get a fresh 7-day window.
# Old first_run / last_seen are discarded when this value changes.
TRIAL_EPOCH = "2026-10-29"

# Ed25519 raw public key (32 bytes). Matching private key is NOT in this repo.
_PUBLIC_KEY_HEX = "7217da878bae12892d59a5f70b88a0b45aed0aa31a009811ad247c2c8a730375"


def is_full_edition() -> bool:
    return EDITION == "full" or os.environ.get("NCVIEW_EDITION", "").lower() == "full"


def machine_id() -> str:
    raw = "|".join(
        [
            platform.system(),
            platform.node(),
            platform.machine(),
            hex(uuid.getnode()),
            os.environ.get("USERNAME") or os.environ.get("USER") or "",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20].upper()


def _state_dir() -> Path:
    if platform.system() == "Darwin":
        base = Path.home() / "Library" / "Application Support" / "NCView"
    elif platform.system() == "Windows":
        base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "NCView"
    else:
        base = Path.home() / ".local" / "share" / "NCView"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _state_path() -> Path:
    return _state_dir() / "nv_state_v1.dat"


def _xor_obfuscate(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def _load_state() -> dict[str, Any]:
    path = _state_path()
    if not path.exists():
        return {}
    try:
        blob = path.read_bytes()
        key = hashlib.sha256((machine_id() + "ncview-state").encode()).digest()
        text = _xor_obfuscate(blob, key).decode("utf-8")
        data = json.loads(text)
        if not isinstance(data, dict):
            return {}
        return data
    except Exception:
        return {}


def _save_state(data: dict[str, Any]) -> None:
    key = hashlib.sha256((machine_id() + "ncview-state").encode()).digest()
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    _state_path().write_bytes(_xor_obfuscate(raw, key))


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def _public_key() -> Ed25519PublicKey:
    return Ed25519PublicKey.from_public_bytes(bytes.fromhex(_PUBLIC_KEY_HEX))


def parse_and_verify_license(code: str) -> dict[str, Any]:
    """Return payload dict if signature valid; raise ValueError otherwise."""
    code = (code or "").strip().replace("\n", "").replace(" ", "")
    parts = code.split(".")
    if len(parts) != 3 or parts[0] != "NCV1":
        raise ValueError("激活码格式无效")
    payload = _b64url_decode(parts[1])
    sig = _b64url_decode(parts[2])
    try:
        _public_key().verify(sig, payload)
    except InvalidSignature as e:
        raise ValueError("激活码签名无效（无法伪造）") from e
    try:
        data = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError("激活码内容损坏") from e
    if not isinstance(data, dict):
        raise ValueError("激活码内容无效")
    return data


def _license_covers_machine(payload: dict[str, Any]) -> bool:
    mid = str(payload.get("mid") or "")
    if mid in {"*", "ANY", "any"}:
        return True
    return mid.upper() == machine_id()


def _license_not_expired(payload: dict[str, Any], now: datetime) -> bool:
    exp = payload.get("exp")
    if not exp:
        return False
    try:
        exp_d = date.fromisoformat(str(exp))
    except ValueError:
        return False
    return now.date() <= exp_d


def saved_license_ok() -> tuple[bool, str]:
    state = _load_state()
    code = state.get("license")
    if not code:
        return False, "未激活"
    try:
        payload = parse_and_verify_license(str(code))
    except ValueError as e:
        return False, str(e)
    now = datetime.now(timezone.utc).astimezone()
    if not _license_covers_machine(payload):
        return False, "激活码与本机不匹配"
    if not _license_not_expired(payload, now):
        return False, "激活码已过期"
    return True, f"已授权至 {payload.get('exp')}"


def activate(code: str) -> str:
    payload = parse_and_verify_license(code)
    now = datetime.now(timezone.utc).astimezone()
    if not _license_covers_machine(payload):
        raise ValueError(
            f"激活码绑定机器为 {payload.get('mid')}，本机为 {machine_id()}"
        )
    if not _license_not_expired(payload, now):
        raise ValueError("激活码已过期")
    state = _load_state()
    state["license"] = code.strip().replace("\n", "").replace(" ", "")
    state["activated_at"] = now.isoformat(timespec="seconds")
    state["last_seen"] = now.isoformat(timespec="seconds")
    _save_state(state)
    return f"激活成功，有效期至 {payload.get('exp')}"


def _parse_iso(ts: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
        return dt
    except Exception:
        return None


def trial_status() -> dict[str, Any]:
    """Return trial / license status for UI."""
    if is_full_edition():
        return {"ok": True, "mode": "full", "message": "完整版"}

    ok, msg = saved_license_ok()
    if ok:
        return {"ok": True, "mode": "licensed", "message": msg}

    now = datetime.now(timezone.utc).astimezone()
    state = _load_state()
    # New trial package (new TRIAL_EPOCH) -> restart the 7-day clock.
    if state.get("trial_epoch") != TRIAL_EPOCH:
        state["trial_epoch"] = TRIAL_EPOCH
        state.pop("first_run", None)
        state.pop("last_seen", None)
        _save_state(state)

    first = _parse_iso(str(state.get("first_run") or ""))
    last = _parse_iso(str(state.get("last_seen") or ""))

    if first is None:
        state["first_run"] = now.isoformat(timespec="seconds")
        state["last_seen"] = now.isoformat(timespec="seconds")
        state["trial_epoch"] = TRIAL_EPOCH
        _save_state(state)
        first = now
        last = now

    if last is not None and now + timedelta(minutes=5) < last:
        return {
            "ok": False,
            "mode": "tamper",
            "message": "检测到系统时间异常，试用已锁定，请使用激活码",
            "machine_id": machine_id(),
            "remain_hours": 0,
        }

    deadline = first + timedelta(days=TRIAL_DAYS)
    remain = deadline - now
    state["last_seen"] = now.isoformat(timespec="seconds")
    _save_state(state)

    if remain.total_seconds() <= 0:
        return {
            "ok": False,
            "mode": "expired",
            "message": f"试用已结束（{TRIAL_DAYS} 天）。请购买激活码。",
            "machine_id": machine_id(),
            "remain_hours": 0,
        }

    hours = max(0, int(remain.total_seconds() // 3600))
    return {
        "ok": True,
        "mode": "trial",
        "message": f"试用剩余约 {hours} 小时（共 {TRIAL_DAYS} 天）",
        "machine_id": machine_id(),
        "remain_hours": hours,
        "deadline": deadline.date().isoformat(),
    }


def ensure_access_or_raise() -> dict[str, Any]:
    st = trial_status()
    if not st.get("ok"):
        raise PermissionError(st.get("message") or "未授权")
    return st
