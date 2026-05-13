"""
Final deployment readiness smoke test for the Synthetic Sparks FastAPI backend.

Tests (in order):
  1. GET  /api/                              — server alive
  2. POST /api/auth/automation-bypass        — auth flow works
  3. GET  /api/character/me                  — character load works
  4. POST /api/game/save                     — full state persistence works
  5. GET  /api/character/me  (post-save)     — round-trip integrity
  6. POST /api/game/checkpoint + restore     — checkpoint flow OK
  7. GET  /api/game/leaderboard              — public read endpoint OK
  8. GET  /api/static/sprites/player_adhamb.png — static asset serving OK
  9. Zero 500s
 10. Reasonable latency (<2s each)
"""

from __future__ import annotations

import sys
import time
import json
import traceback
from typing import Any, Dict, List, Tuple

import requests


BACKEND_URL = "https://emerged-academy.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"
TIMEOUT = 30
SLOW_THRESHOLD = 2.0  # seconds


def colorize(s: str, color: str) -> str:
    codes = {"green": 32, "red": 31, "yellow": 33, "cyan": 36, "bold": 1}
    return f"\033[{codes.get(color, 0)}m{s}\033[0m"


class Smoke:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.results: List[Dict[str, Any]] = []
        self.fivexx_count = 0
        self.slow_count = 0

    def _record(self, name: str, ok: bool, status: int, elapsed: float,
                detail: str = "") -> None:
        self.results.append({
            "name": name, "ok": ok, "status": status,
            "elapsed_s": round(elapsed, 3), "detail": detail,
        })
        if status >= 500:
            self.fivexx_count += 1
        if elapsed > SLOW_THRESHOLD:
            self.slow_count += 1

        marker = colorize("PASS", "green") if ok else colorize("FAIL", "red")
        slow_tag = colorize(" SLOW", "yellow") if elapsed > SLOW_THRESHOLD else ""
        print(f"  [{marker}] {name:55s} HTTP {status}  "
              f"{elapsed*1000:7.1f} ms{slow_tag}  {detail}")

    def _request(self, method: str, path: str, **kw) -> Tuple[requests.Response, float]:
        url = f"{API}{path}" if path.startswith("/") else f"{BACKEND_URL}{path}"
        kw.setdefault("timeout", TIMEOUT)
        start = time.perf_counter()
        resp = self.session.request(method, url, **kw)
        elapsed = time.perf_counter() - start
        return resp, elapsed

    def test_root(self) -> None:
        try:
            r, t = self._request("GET", "/")
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = (r.status_code == 200
                  and body.get("message") == "Synthetic Sparks API")
            detail = f"message={body.get('message')!r} version={body.get('version')!r}"
            self._record("GET /api/", ok, r.status_code, t, detail)
        except Exception as e:
            self._record("GET /api/", False, 0, 0.0, f"exception: {e}")

    def test_automation_bypass(self) -> Dict[str, Any]:
        try:
            r, t = self._request("POST", "/auth/automation-bypass")
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            has_token = bool(body.get("access_token"))
            has_id = bool(body.get("id"))
            has_cookies = bool(self.session.cookies.get("access_token"))
            ok = (r.status_code == 200 and has_token and has_id and has_cookies)
            detail = (f"email={body.get('email')} id_present={has_id} "
                      f"jwt_len={len(body.get('access_token') or '')} "
                      f"httpOnly_cookie={has_cookies} "
                      f"redirect={body.get('redirect')!r}")
            self._record("POST /api/auth/automation-bypass", ok,
                         r.status_code, t, detail)
            return body if ok else {}
        except Exception as e:
            self._record("POST /api/auth/automation-bypass", False, 0, 0.0,
                         f"exception: {e}")
            return {}

    def test_character_me(self, label: str = "GET /api/character/me") -> Dict[str, Any]:
        try:
            r, t = self._request("GET", "/character/me")
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = (r.status_code == 200 and body.get("has_character") is True
                  and isinstance(body.get("state"), dict))
            state = body.get("state") or {}
            player = (state.get("player") or {}) if isinstance(state, dict) else {}
            world = (state.get("world") or {}) if isinstance(state, dict) else {}
            detail = (f"has_character={body.get('has_character')} "
                      f"player_name={player.get('name')!r} "
                      f"map={world.get('currentMap')!r}")
            self._record(label, ok, r.status_code, t, detail)
            return body if ok else {}
        except Exception as e:
            self._record(label, False, 0, 0.0, f"exception: {e}")
            return {}

    def test_save(self, base_state: Dict[str, Any]) -> Dict[str, Any]:
        state = json.loads(json.dumps(base_state))
        marker = f"smoke-{int(time.time())}"
        state.setdefault("player", {})
        state["player"]["__smoke_marker__"] = marker
        state["player"]["gold"] = int(state["player"].get("gold", 50)) + 7
        state.setdefault("world", {})
        state["world"]["position"] = {"x": 4, "y": 5}

        try:
            r, t = self._request("POST", "/game/save", json={"state": state})
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = (r.status_code == 200 and body.get("ok") is True
                  and isinstance(body.get("state"), dict)
                  and body["state"].get("player", {}).get("__smoke_marker__") == marker)
            detail = (f"ok={body.get('ok')} "
                      f"marker_echoed="
                      f"{body.get('state', {}).get('player', {}).get('__smoke_marker__') == marker}")
            self._record("POST /api/game/save", ok, r.status_code, t, detail)
            return {"marker": marker, "state": state} if ok else {}
        except Exception as e:
            self._record("POST /api/game/save", False, 0, 0.0, f"exception: {e}")
            return {}

    def test_roundtrip(self, marker: str) -> bool:
        try:
            r, t = self._request("GET", "/character/me")
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            state = body.get("state") or {}
            persisted = (state.get("player") or {}).get("__smoke_marker__")
            ok = (r.status_code == 200 and persisted == marker)
            detail = f"persisted_marker={persisted!r} expected={marker!r}"
            self._record("GET /api/character/me (round-trip)", ok,
                         r.status_code, t, detail)
            return ok
        except Exception as e:
            self._record("GET /api/character/me (round-trip)", False, 0, 0.0,
                         f"exception: {e}")
            return False

    def test_checkpoint_flow(self, base_state: Dict[str, Any]) -> bool:
        cp_state = json.loads(json.dumps(base_state))
        cp_marker = f"checkpoint-{int(time.time())}"
        cp_state.setdefault("player", {})
        cp_state["player"]["__checkpoint_marker__"] = cp_marker
        cp_state["player"]["gold"] = 999

        try:
            r, t = self._request("POST", "/game/checkpoint",
                                 json={"state": cp_state})
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = (r.status_code == 200 and body.get("ok") is True)
            self._record("POST /api/game/checkpoint", ok, r.status_code, t,
                         f"ok={body.get('ok')}")
            if not ok:
                return False
        except Exception as e:
            self._record("POST /api/game/checkpoint", False, 0, 0.0,
                         f"exception: {e}")
            return False

        dirty = json.loads(json.dumps(cp_state))
        dirty["player"]["__checkpoint_marker__"] = "DIRTY"
        dirty["player"]["gold"] = 1
        try:
            r, t = self._request("POST", "/game/save", json={"state": dirty})
            ok = r.status_code == 200
            self._record("POST /api/game/save (dirty mutation)", ok,
                         r.status_code, t, "pre-restore mutation")
            if not ok:
                return False
        except Exception as e:
            self._record("POST /api/game/save (dirty mutation)", False, 0, 0.0,
                         f"exception: {e}")
            return False

        try:
            r, t = self._request("POST", "/game/restore-checkpoint")
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            restored = (body.get("state") or {}).get("player", {})
            ok = (r.status_code == 200
                  and restored.get("__checkpoint_marker__") == cp_marker
                  and restored.get("gold") == 999)
            detail = (f"restored_marker={restored.get('__checkpoint_marker__')!r} "
                      f"gold={restored.get('gold')}")
            self._record("POST /api/game/restore-checkpoint", ok,
                         r.status_code, t, detail)
            return ok
        except Exception as e:
            self._record("POST /api/game/restore-checkpoint", False, 0, 0.0,
                         f"exception: {e}")
            return False

    def test_leaderboard(self) -> None:
        try:
            r = requests.get(f"{API}/game/leaderboard", timeout=TIMEOUT)
            t = r.elapsed.total_seconds()
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = (r.status_code == 200 and isinstance(body.get("leaderboard"), list))
            n = len(body.get("leaderboard") or [])
            self._record("GET /api/game/leaderboard", ok, r.status_code, t,
                         f"entries={n}")
        except Exception as e:
            self._record("GET /api/game/leaderboard", False, 0, 0.0,
                         f"exception: {e}")

    def test_static_asset(self) -> None:
        path = "/api/static/sprites/player_adhamb.png"
        try:
            r = requests.get(f"{BACKEND_URL}{path}", timeout=TIMEOUT, stream=True)
            t = r.elapsed.total_seconds()
            ct = r.headers.get("Content-Type", "")
            size = int(r.headers.get("Content-Length") or 0)
            if size == 0:
                content = r.content
                size = len(content)
            ok = (r.status_code == 200 and ct.startswith("image/") and size > 1000)
            self._record(f"GET {path}", ok, r.status_code, t,
                         f"content_type={ct} size={size}")
        except Exception as e:
            self._record(f"GET {path}", False, 0, 0.0, f"exception: {e}")

    def run(self) -> int:
        print(colorize(
            "\n══════════════════════════════════════════════════════════════════\n"
            "  DEPLOYMENT READINESS SMOKE TEST — Synthetic Sparks FastAPI\n"
            f"  Backend: {BACKEND_URL}\n"
            "══════════════════════════════════════════════════════════════════",
            "cyan"))

        print(colorize("\n[1] Server alive check", "bold"))
        self.test_root()

        print(colorize("\n[2] Automation bypass auth flow", "bold"))
        auth = self.test_automation_bypass()
        if not auth:
            print(colorize("\nAUTH FAILED — aborting authenticated tests.", "red"))
            self._summary()
            return 1

        print(colorize("\n[3] Character load", "bold"))
        char_me = self.test_character_me()
        base_state = (char_me.get("state") or {}) if isinstance(char_me, dict) else {}
        if not base_state:
            print(colorize("\nNo baseline state — aborting state tests.", "red"))
            self._summary()
            return 1

        print(colorize("\n[4] Full state persistence (save)", "bold"))
        saved = self.test_save(base_state)
        marker = saved.get("marker", "")

        print(colorize("\n[5] Save round-trip integrity", "bold"))
        if marker:
            self.test_roundtrip(marker)
        else:
            self._record("GET /api/character/me (round-trip)", False, 0, 0.0,
                         "skipped — save did not return a marker")

        print(colorize("\n[6] Checkpoint save + restore flow", "bold"))
        self.test_checkpoint_flow(base_state)

        print(colorize("\n[7] Leaderboard public read", "bold"))
        self.test_leaderboard()

        print(colorize("\n[8] Static asset serving", "bold"))
        self.test_static_asset()

        return self._summary()

    def _summary(self) -> int:
        print(colorize(
            "\n══════════════════════════════════════════════════════════════════\n"
            "  SUMMARY\n"
            "══════════════════════════════════════════════════════════════════",
            "cyan"))
        passed = sum(1 for r in self.results if r["ok"])
        total = len(self.results)
        print(f"  Passed:       {passed} / {total}")
        print(f"  500-class:    {self.fivexx_count}")
        print(f"  Slow (>2s):   {self.slow_count}")
        failed = [r for r in self.results if not r["ok"]]
        if failed:
            print(colorize("\n  FAILURES:", "red"))
            for r in failed:
                print(f"    ✗ {r['name']}  HTTP {r['status']}  "
                      f"{r['elapsed_s']}s  — {r['detail']}")
        else:
            print(colorize("\n  All checks PASSED.", "green"))
        print("")
        return 0 if not failed and self.fivexx_count == 0 else 1


if __name__ == "__main__":
    try:
        rc = Smoke().run()
        sys.exit(rc)
    except Exception:
        traceback.print_exc()
        sys.exit(2)
