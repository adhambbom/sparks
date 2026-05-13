"""
Backend regression smoke test for the Operator Synergy Framework.
"""
import sys
import json
import requests

BASE_URL = "https://emerged-academy.preview.emergentagent.com"
API = f"{BASE_URL}/api"

results = []


def record(step, ok, status, excerpt=""):
    mark = "PASS" if ok else "FAIL"
    line = f"[{mark}] {step} - HTTP {status} - {excerpt}"
    print(line)
    results.append((step, ok, status, excerpt))


def short(obj, n=240):
    try:
        s = json.dumps(obj) if not isinstance(obj, str) else obj
    except Exception:
        s = str(obj)
    return s if len(s) <= n else s[:n] + "...(truncated)"


def main():
    session = requests.Session()

    # 1) automation-bypass
    r = session.post(f"{API}/auth/automation-bypass", timeout=30)
    ok = r.status_code == 200
    body = {}
    try:
        body = r.json()
    except Exception:
        pass
    has_token = bool(body.get("access_token"))
    has_cookie = "access_token" in session.cookies.get_dict()
    record(
        "1) POST /api/auth/automation-bypass",
        ok and has_token and has_cookie,
        r.status_code,
        f"token={'yes' if has_token else 'no'} cookie={'yes' if has_cookie else 'no'} email={body.get('email')}",
    )
    if not ok:
        print("Cannot proceed without bypass; aborting.")
        return summarize()
    access_token = body.get("access_token")
    auth_headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}

    # 2) GET /api/character/me
    r = session.get(f"{API}/character/me", headers=auth_headers, timeout=30)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    has_char = body.get("has_character") is True and isinstance(body.get("state"), dict)
    record(
        "2) GET /api/character/me",
        ok and has_char,
        r.status_code,
        f"has_character={body.get('has_character')} player={body.get('state', {}).get('player', {}).get('name')}",
    )
    state = body.get("state") or {}

    # 3) POST /api/game/save with synergyNodes & synergyPoints
    player = dict(state.get("player") or {})
    player["synergyNodes"] = ["dep_cheap_1", "oc_pwr_1"]
    player["synergyPoints"] = 3
    new_state = dict(state)
    new_state["player"] = player
    if "world" not in new_state:
        new_state["world"] = {"currentMap": "conduit_maze", "position": {"x": 2, "y": 1}}
    r = session.post(
        f"{API}/game/save",
        json={"state": new_state},
        headers=auth_headers,
        timeout=30,
    )
    ok = r.status_code == 200
    body = r.json() if ok else {}
    saved_player = (body.get("state") or {}).get("player") or {}
    record(
        "3) POST /api/game/save (with synergyNodes/synergyPoints)",
        ok and saved_player.get("synergyPoints") == 3
        and saved_player.get("synergyNodes") == ["dep_cheap_1", "oc_pwr_1"],
        r.status_code,
        f"synergyNodes={saved_player.get('synergyNodes')} synergyPoints={saved_player.get('synergyPoints')}",
    )

    # 4) GET /api/character/me - persistence round-trip
    r = session.get(f"{API}/character/me", headers=auth_headers, timeout=30)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    p = (body.get("state") or {}).get("player") or {}
    persisted = (
        p.get("synergyNodes") == ["dep_cheap_1", "oc_pwr_1"]
        and p.get("synergyPoints") == 3
    )
    record(
        "4) GET /api/character/me (verify persistence)",
        ok and persisted,
        r.status_code,
        f"synergyNodes={p.get('synergyNodes')} synergyPoints={p.get('synergyPoints')}",
    )

    # 5) POST /api/game/save with legacy player (no new fields)
    legacy_player = {k: v for k, v in player.items() if k not in ("synergyNodes", "synergyPoints")}
    legacy_state = dict(new_state)
    legacy_state["player"] = legacy_player
    r = session.post(
        f"{API}/game/save",
        json={"state": legacy_state},
        headers=auth_headers,
        timeout=30,
    )
    ok = r.status_code == 200
    body = r.json() if ok else {}
    record(
        "5) POST /api/game/save (legacy, no synergy fields)",
        ok and body.get("ok") is True,
        r.status_code,
        f"ok={body.get('ok')} player_keys={len((body.get('state') or {}).get('player') or {})}",
    )

    # Restore synergy state before checkpoint
    session.post(f"{API}/game/save", json={"state": new_state}, headers=auth_headers, timeout=30)

    # 6) POST /api/game/checkpoint then GET back
    r = session.post(
        f"{API}/game/checkpoint",
        json={"state": new_state},
        headers=auth_headers,
        timeout=30,
    )
    cp_ok = r.status_code == 200
    cp_body = r.json() if cp_ok else {}
    record(
        "6a) POST /api/game/checkpoint",
        cp_ok and cp_body.get("ok") is True,
        r.status_code,
        short(cp_body),
    )

    r = session.get(f"{API}/character/me", headers=auth_headers, timeout=30)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    checkpoint = body.get("checkpoint") or {}
    cp_player = checkpoint.get("player") or {}
    record(
        "6b) GET /api/character/me - checkpoint round-trip",
        ok and cp_player.get("synergyPoints") == 3
        and cp_player.get("synergyNodes") == ["dep_cheap_1", "oc_pwr_1"],
        r.status_code,
        f"checkpoint synergyNodes={cp_player.get('synergyNodes')} synergyPoints={cp_player.get('synergyPoints')}",
    )

    # 7a) /api/
    r = requests.get(f"{API}/", timeout=30)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    record(
        "7a) GET /api/",
        ok and body.get("message") == "Synthetic Sparks API",
        r.status_code,
        short(body),
    )

    # 7b) /api/game/leaderboard
    r = requests.get(f"{API}/game/leaderboard", timeout=30)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    record(
        "7b) GET /api/game/leaderboard",
        ok and isinstance(body.get("leaderboard"), list),
        r.status_code,
        short(body),
    )

    summarize()


def summarize():
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, ok, *_ in results if ok)
    failed = [r for r in results if not r[1]]
    print(f"Passed: {passed}/{len(results)}")
    if failed:
        print("Failed steps:")
        for step, _, status, excerpt in failed:
            print(f"  - {step} (HTTP {status}): {excerpt}")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
