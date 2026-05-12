"""Backend tests for Synthetic Sparks API — security hardening of
/api/auth/automation-bypass plus regression checks.
"""
import os
import re
import sys
import time
import json
import uuid
import secrets
import subprocess
import requests

BASE = "https://emerged-academy.preview.emergentagent.com/api"
ENV_FILE = "/app/backend/.env"
LOG_OUT = "/var/log/supervisor/backend.out.log"
LOG_ERR = "/var/log/supervisor/backend.err.log"

results = []


def record(name, ok, info=""):
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name} :: {info}")
    results.append((name, ok, info))


def set_env_flag(value: str):
    """Rewrite ENABLE_AUTOMATION_BYPASS in /app/backend/.env."""
    with open(ENV_FILE, "r") as f:
        text = f.read()
    new = re.sub(r"^ENABLE_AUTOMATION_BYPASS=.*$",
                 f"ENABLE_AUTOMATION_BYPASS={value}",
                 text, flags=re.MULTILINE)
    with open(ENV_FILE, "w") as f:
        f.write(new)


def restart_backend():
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"],
                   check=False, capture_output=True)
    # Wait for backend to come up
    for _ in range(30):
        try:
            r = requests.get(f"{BASE}/", timeout=3)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


# ---------------------------------------------------------------
# SCENARIO 1 — staging mode (bypass enabled)
# ---------------------------------------------------------------
def scenario_1_staging_bypass_enabled():
    print("\n=== SCENARIO 1: staging mode (bypass enabled) ===")
    # Make sure .env is in expected state
    set_env_flag("1")
    if not restart_backend():
        record("scenario1_backend_up", False, "backend did not start")
        return
    s = requests.Session()
    r = s.post(f"{BASE}/auth/automation-bypass", timeout=10)
    body_txt = r.text
    print(f"  status={r.status_code}")
    print(f"  body={body_txt[:500]}")
    if r.status_code != 200:
        record("scenario1_status_200", False, f"got {r.status_code} body={body_txt[:200]}")
        return
    try:
        body = r.json()
    except Exception as e:
        record("scenario1_json", False, str(e))
        return
    record("scenario1_status_200", True, "200 OK")
    checks = [
        ("access_token" in body, "has access_token"),
        (body.get("email") == "playwright@nexus.test", f"email={body.get('email')}"),
        (body.get("name") == "PlaywrightRunnerNode01", f"name={body.get('name')}"),
        (body.get("redirect") == "/conduit-maze", f"redirect={body.get('redirect')}"),
    ]
    for ok, desc in checks:
        record(f"scenario1_field::{desc}", ok, desc)
    # cookies
    ck = r.cookies
    record("scenario1_cookie_access", "access_token" in ck, f"cookies={list(ck.keys())}")
    record("scenario1_cookie_refresh", "refresh_token" in ck, f"cookies={list(ck.keys())}")
    # /api/auth/me with cookie session
    r2 = s.get(f"{BASE}/auth/me", timeout=10)
    print(f"  /auth/me status={r2.status_code} body={r2.text[:300]}")
    if r2.status_code == 200:
        me = r2.json()
        record("scenario1_me_200", True, "200")
        record("scenario1_me_email",
               me.get("email") == "playwright@nexus.test",
               f"email={me.get('email')}")
        record("scenario1_me_name",
               me.get("name") == "PlaywrightRunnerNode01",
               f"name={me.get('name')}")
    else:
        record("scenario1_me_200", False, f"{r2.status_code} {r2.text[:200]}")

    # Save body for the report
    scenario_1_staging_bypass_enabled.response_body = body
    scenario_1_staging_bypass_enabled.status_code = r.status_code


# ---------------------------------------------------------------
# SCENARIO 2 — production mode (bypass disabled)
# ---------------------------------------------------------------
def scenario_2_prod_lockdown():
    print("\n=== SCENARIO 2: production mode (bypass disabled) ===")
    set_env_flag("0")
    if not restart_backend():
        record("scenario2_backend_up", False, "backend did not start")
        return
    # Capture log marker before request to find new line afterward
    marker = f"TEST-MARKER-{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{BASE}/auth/automation-bypass",
                      headers={"User-Agent": f"backend-tester/{marker}"},
                      timeout=10)
    body_txt = r.text
    print(f"  status={r.status_code}")
    print(f"  body={body_txt[:500]}")
    if r.status_code == 403:
        record("scenario2_status_403", True, "403")
    else:
        record("scenario2_status_403", False, f"got {r.status_code}")
    try:
        body = r.json()
    except Exception:
        body = {}
    detail = body.get("detail", {})
    record("scenario2_detail_error",
           isinstance(detail, dict) and detail.get("error") == "Access Denied",
           f"detail.error={detail.get('error') if isinstance(detail,dict) else detail}")
    record("scenario2_detail_message",
           isinstance(detail, dict) and detail.get("message") == "Automation bypass is strictly disabled in production environments.",
           f"detail.message={detail.get('message') if isinstance(detail,dict) else detail}")

    # Search backend logs for SECURITY ALERT line — wait a bit for log flush
    time.sleep(2)
    alert_lines = []
    for log_path in (LOG_ERR, LOG_OUT):
        try:
            with open(log_path, "r", errors="replace") as f:
                content = f.read()
            for line in content.splitlines()[-500:]:
                if "SECURITY ALERT" in line and "automation-bypass" in line:
                    alert_lines.append((log_path, line))
        except FileNotFoundError:
            continue
    if alert_lines:
        # Use the latest match
        record("scenario2_security_alert_log", True,
               f"matched={alert_lines[-1][1][:200]}")
        scenario_2_prod_lockdown.alert_line = alert_lines[-1][1]
    else:
        record("scenario2_security_alert_log", False, "no SECURITY ALERT log line found")
        scenario_2_prod_lockdown.alert_line = None
    scenario_2_prod_lockdown.response_body = body
    scenario_2_prod_lockdown.status_code = r.status_code


# ---------------------------------------------------------------
# SCENARIO 3 — restore staging
# ---------------------------------------------------------------
def scenario_3_restore():
    print("\n=== SCENARIO 3: restore staging (ENABLE_AUTOMATION_BYPASS=1) ===")
    set_env_flag("1")
    if not restart_backend():
        record("scenario3_backend_up", False, "backend did not start")
        return
    # Re-verify endpoint works
    r = requests.post(f"{BASE}/auth/automation-bypass", timeout=10)
    record("scenario3_endpoint_200_again", r.status_code == 200,
           f"status={r.status_code}")
    # Re-read .env to confirm value
    with open(ENV_FILE, "r") as f:
        env_text = f.read()
    has_flag = "ENABLE_AUTOMATION_BYPASS=1" in env_text
    record("scenario3_env_restored", has_flag,
           "ENABLE_AUTOMATION_BYPASS=1 present" if has_flag else "missing")


# ---------------------------------------------------------------
# REGRESSION CHECKS
# ---------------------------------------------------------------
def regression_static_sprite():
    print("\n=== REGRESSION: static sprite ===")
    r = requests.get(f"{BASE}/static/sprites/conduit_maze_bg.png", timeout=10)
    ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("image/")
    record("regression_static_sprite", ok,
           f"status={r.status_code} ct={r.headers.get('content-type')} size={len(r.content)}")


def regression_register():
    print("\n=== REGRESSION: register ===")
    email = f"regress+{secrets.token_hex(4)}@nexus.test"
    pwd = secrets.token_hex(8)
    r = requests.post(f"{BASE}/auth/register",
                      json={"email": email, "password": pwd, "name": "RegressTester"},
                      timeout=10)
    if r.status_code == 200:
        body = r.json()
        ok = "access_token" in body and body.get("email") == email
        record("regression_register", ok,
               f"status=200 token_present={'access_token' in body}")
    else:
        record("regression_register", False, f"status={r.status_code} body={r.text[:200]}")


def regression_leaderboard():
    print("\n=== REGRESSION: leaderboard ===")
    # The review mentioned /api/leaderboard/arena but the code defines /api/game/leaderboard
    # Try both and report findings.
    paths_tried = []
    for p in ("/leaderboard/arena", "/game/leaderboard"):
        r = requests.get(f"{BASE}{p}", timeout=10)
        paths_tried.append((p, r.status_code, r.text[:120]))
    print(f"  tried={paths_tried}")
    # The "arena" path will likely 404. Pass if /game/leaderboard returns 200.
    game_lb = next((t for t in paths_tried if t[0] == "/game/leaderboard"), None)
    ok = game_lb is not None and game_lb[1] == 200
    record("regression_leaderboard_/game/leaderboard", ok,
           f"status={game_lb[1] if game_lb else 'n/a'}")
    arena_lb = next((t for t in paths_tried if t[0] == "/leaderboard/arena"), None)
    record("regression_leaderboard_/leaderboard/arena_exists",
           arena_lb is not None and arena_lb[1] == 200,
           f"status={arena_lb[1] if arena_lb else 'n/a'} (route NOT defined in server.py)")


# ---------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------
def main():
    try:
        scenario_1_staging_bypass_enabled()
        scenario_2_prod_lockdown()
        scenario_3_restore()
        regression_static_sprite()
        regression_register()
        regression_leaderboard()
    finally:
        # Ensure env is restored to 1 no matter what
        try:
            set_env_flag("1")
            restart_backend()
        except Exception as e:
            print(f"!!! could not restore env: {e}")

    print("\n========= SUMMARY =========")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, info in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} :: {info}")
    print(f"\nTOTAL  pass={passed}  fail={failed}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
