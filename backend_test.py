"""Backend regression test — Entity Progression fields (IVs, rarity, DATA leveling).

Verifies that the backend's /api/game/save and /api/character/me endpoints
correctly round-trip extended CapturedMinion fields:
  - ivs: { hp, atk, def, spd }
  - rarity: 'common' | 'rare' | 'glitched' | 'ascended'
  - dataLevel, dataXp, dataXpToNext, baseLevel

Also exercises legacy compatibility (no new fields), checkpoint save/load,
and the root + leaderboard endpoints.
"""

import json
import sys
from typing import Any, Dict

import requests

BACKEND_URL = "https://emerged-academy.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

session = requests.Session()
session.headers.update({"User-Agent": "backend-tester/entity-progression"})

results = []  # list of (name, ok, detail)


def record(name: str, ok: bool, detail: str = "") -> None:
    badge = "PASS" if ok else "FAIL"
    print(f"[{badge}] {name}: {detail}")
    results.append((name, ok, detail))


def deep_get(d: Any, path: str, default=None):
    cur: Any = d
    for k in path.split("."):
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return default
    return cur


# --- Step 1: Automation bypass ---
print("\n--- Step 1: POST /api/auth/automation-bypass ---")
r = session.post(f"{API}/auth/automation-bypass")
ok = r.status_code == 200
detail = f"status={r.status_code}"
try:
    body = r.json()
    if ok:
        ok = bool(body.get("access_token")) and body.get("email") == "playwright@nexus.test"
        detail += f" email={body.get('email')} token_len={len(body.get('access_token',''))}"
except Exception as e:
    ok = False
    detail += f" parse_err={e}"
record("automation-bypass returns 200 with auth", ok, detail)

if not ok:
    print("Cannot proceed without auth.")
    sys.exit(1)

# --- Step 2: GET /api/character/me — baseline ---
print("\n--- Step 2: GET /api/character/me ---")
r = session.get(f"{API}/character/me")
ok = r.status_code == 200
detail = f"status={r.status_code}"
baseline_state = None
try:
    body = r.json()
    baseline_state = body.get("state")
    detail += f" has_character={body.get('has_character')} player={deep_get(body, 'state.player.name')}"
except Exception as e:
    detail += f" parse_err={e}"
    ok = False
record("character/me initial fetch 200", ok, detail)

# --- Step 3: POST /api/game/save with new entity-progression fields ---
print("\n--- Step 3: POST /api/game/save with extended party entry ---")

party_entry = {
    "uid": "test_x_1",
    "speciesId": "phreak_1",
    "name": "Phreak",
    "level": 3,
    "hp": 40, "maxHp": 40,
    "atk": 12, "def": 8, "spd": 10,
    "skills": ["data_leak"],
    "tier": 1,
    "capturedAt": "2026-01-01T00:00:00Z",
    "ivs": {"hp": 31, "atk": 25, "def": 18, "spd": 22},
    "rarity": "glitched",
    "dataLevel": 5,
    "dataXp": 12,
    "dataXpToNext": 113,
    "baseLevel": 3,
}

state_payload: Dict[str, Any] = baseline_state if isinstance(baseline_state, dict) else {}
state_payload.setdefault("player", {
    "name": "PlaywrightRunner", "house": "obsidian",
    "level": 1, "xp": 0, "xpToNext": 100,
    "hp": 70, "maxHp": 70, "mp": 30, "maxMp": 30,
    "atk": 14, "def": 6, "spd": 14, "gold": 50,
})
state_payload.setdefault("world", {"currentMap": "conduit_maze", "position": {"x": 2, "y": 1}})
state_payload["quantum"] = {
    "party": [party_entry],
    "extendedStorage": [
        {
            "uid": "test_x_storage_1",
            "speciesId": "glitch_ghost_2",
            "name": "Glitch",
            "level": 7,
            "hp": 55, "maxHp": 55, "atk": 18, "def": 9, "spd": 14,
            "skills": ["packet_storm"],
            "tier": 2,
            "capturedAt": "2026-01-02T00:00:00Z",
            "ivs": {"hp": 12, "atk": 31, "def": 7, "spd": 28},
            "rarity": "ascended",
            "dataLevel": 9,
            "dataXp": 88,
            "dataXpToNext": 200,
            "baseLevel": 7,
        }
    ],
}

r = session.post(f"{API}/game/save", json={"state": state_payload})
ok = r.status_code == 200
detail = f"status={r.status_code}"
echoed_party = None
try:
    body = r.json()
    detail += f" ok={body.get('ok')}"
    echoed_party = deep_get(body, "state.quantum.party")
except Exception as e:
    detail += f" parse_err={e}"
    ok = False
record("game/save extended party fields returns 200", ok, detail)

print("\n--- Step 3b: Echo body preserves new fields ---")
echo_ok = isinstance(echoed_party, list) and len(echoed_party) == 1
if echo_ok:
    e0 = echoed_party[0]
    checks = {
        "ivs.hp == 31": deep_get(e0, "ivs.hp") == 31,
        "ivs.atk == 25": deep_get(e0, "ivs.atk") == 25,
        "ivs.def == 18": deep_get(e0, "ivs.def") == 18,
        "ivs.spd == 22": deep_get(e0, "ivs.spd") == 22,
        "rarity == glitched": e0.get("rarity") == "glitched",
        "dataLevel == 5": e0.get("dataLevel") == 5,
        "dataXp == 12": e0.get("dataXp") == 12,
        "dataXpToNext == 113": e0.get("dataXpToNext") == 113,
        "baseLevel == 3": e0.get("baseLevel") == 3,
    }
    failed = [k for k, v in checks.items() if not v]
    echo_ok = not failed
    record(
        "echo preserves new fields in save response",
        echo_ok,
        "all preserved" if echo_ok else f"failed: {failed} | echoed={json.dumps(e0)[:300]}",
    )
else:
    record("echo preserves new fields in save response", False, f"echoed_party={echoed_party}")

# --- Step 4: GET /api/character/me after save (round-trip) ---
print("\n--- Step 4: GET /api/character/me after save ---")
r = session.get(f"{API}/character/me")
ok = r.status_code == 200
detail = f"status={r.status_code}"
persisted_party = None
persisted_storage = None
try:
    body = r.json()
    persisted_party = deep_get(body, "state.quantum.party")
    persisted_storage = deep_get(body, "state.quantum.extendedStorage")
    detail += f" party_len={len(persisted_party or [])} storage_len={len(persisted_storage or [])}"
except Exception as e:
    detail += f" parse_err={e}"
    ok = False
record("character/me returns 200 post-save", ok, detail)

print("\n--- Step 4b: Persisted party preserves new fields ---")
pp_ok = isinstance(persisted_party, list) and len(persisted_party) == 1
if pp_ok:
    p0 = persisted_party[0]
    checks = {
        "uid": p0.get("uid") == "test_x_1",
        "speciesId": p0.get("speciesId") == "phreak_1",
        "name": p0.get("name") == "Phreak",
        "ivs.hp == 31": deep_get(p0, "ivs.hp") == 31,
        "ivs.atk == 25": deep_get(p0, "ivs.atk") == 25,
        "ivs.def == 18": deep_get(p0, "ivs.def") == 18,
        "ivs.spd == 22": deep_get(p0, "ivs.spd") == 22,
        "rarity == glitched": p0.get("rarity") == "glitched",
        "dataLevel == 5": p0.get("dataLevel") == 5,
        "dataXp == 12": p0.get("dataXp") == 12,
        "dataXpToNext == 113": p0.get("dataXpToNext") == 113,
        "baseLevel == 3": p0.get("baseLevel") == 3,
    }
    failed = [k for k, v in checks.items() if not v]
    pp_ok = not failed
    record(
        "persisted party preserves IVs/rarity/dataLevel/dataXp/dataXpToNext/baseLevel",
        pp_ok,
        "all preserved" if pp_ok else f"failed: {failed} | entry={json.dumps(p0)[:400]}",
    )
else:
    record(
        "persisted party preserves IVs/rarity/dataLevel/dataXp/dataXpToNext/baseLevel",
        False,
        f"persisted_party={persisted_party}",
    )

print("\n--- Step 4c: Persisted extendedStorage preserves new fields ---")
ps_ok = isinstance(persisted_storage, list) and len(persisted_storage) == 1
if ps_ok:
    s0 = persisted_storage[0]
    checks = {
        "uid": s0.get("uid") == "test_x_storage_1",
        "rarity == ascended": s0.get("rarity") == "ascended",
        "ivs.atk == 31": deep_get(s0, "ivs.atk") == 31,
        "dataLevel == 9": s0.get("dataLevel") == 9,
        "dataXp == 88": s0.get("dataXp") == 88,
        "dataXpToNext == 200": s0.get("dataXpToNext") == 200,
        "baseLevel == 7": s0.get("baseLevel") == 7,
    }
    failed = [k for k, v in checks.items() if not v]
    ps_ok = not failed
    record(
        "persisted extendedStorage preserves new fields",
        ps_ok,
        "all preserved" if ps_ok else f"failed: {failed} | entry={json.dumps(s0)[:400]}",
    )
else:
    record(
        "persisted extendedStorage preserves new fields",
        False,
        f"persisted_storage={persisted_storage}",
    )

# --- Step 5: Legacy party (no new fields) — backwards compat ---
print("\n--- Step 5: POST /api/game/save with LEGACY party entry ---")

legacy_state = dict(state_payload)
legacy_state["quantum"] = {
    "party": [
        {
            "uid": "legacy_x_1",
            "speciesId": "phreak_1",
            "name": "OldPhreak",
            "level": 2,
            "hp": 38, "maxHp": 38, "atk": 11, "def": 7, "spd": 9,
            "skills": ["data_leak"],
            "tier": 1,
            "capturedAt": "2025-12-01T00:00:00Z",
        }
    ],
    "extendedStorage": [],
}

r = session.post(f"{API}/game/save", json={"state": legacy_state})
ok = r.status_code == 200
detail = f"status={r.status_code}"
try:
    body = r.json()
    detail += f" ok={body.get('ok')}"
    legacy_echoed = deep_get(body, "state.quantum.party")
    if isinstance(legacy_echoed, list) and len(legacy_echoed) == 1:
        e0 = legacy_echoed[0]
        has_new = any(k in e0 for k in ("ivs", "rarity", "dataLevel", "dataXp", "dataXpToNext", "baseLevel"))
        detail += f" legacy_entry_uid={e0.get('uid')} extra_new_fields_injected={has_new}"
except Exception as e:
    ok = False
    detail += f" parse_err={e}"
record("legacy party (no new fields) saves with 200", ok, detail)

r = session.get(f"{API}/character/me")
legacy_persist_ok = r.status_code == 200
detail = f"status={r.status_code}"
try:
    body = r.json()
    party = deep_get(body, "state.quantum.party")
    if isinstance(party, list) and len(party) == 1 and party[0].get("uid") == "legacy_x_1":
        detail += " legacy entry persisted (uid matches)"
    else:
        legacy_persist_ok = False
        detail += f" unexpected party={party}"
except Exception as e:
    legacy_persist_ok = False
    detail += f" parse_err={e}"
record("legacy party persists cleanly through /character/me", legacy_persist_ok, detail)

# --- Step 6: Checkpoint round-trip ---
print("\n--- Step 6: POST /api/game/checkpoint + GET back ---")
r = session.post(f"{API}/game/checkpoint", json={"state": state_payload})
cp_post_ok = r.status_code == 200
detail = f"status={r.status_code}"
try:
    body = r.json()
    detail += f" ok={body.get('ok')}"
except Exception as e:
    detail += f" parse_err={e}"
    cp_post_ok = False
record("game/checkpoint returns 200", cp_post_ok, detail)

r = session.get(f"{API}/character/me")
cp_load_ok = r.status_code == 200
detail = f"status={r.status_code}"
try:
    body = r.json()
    cp_party = deep_get(body, "checkpoint.quantum.party")
    if isinstance(cp_party, list) and len(cp_party) == 1:
        e0 = cp_party[0]
        checks = {
            "rarity": e0.get("rarity") == "glitched",
            "dataLevel": e0.get("dataLevel") == 5,
            "ivs.hp": deep_get(e0, "ivs.hp") == 31,
            "baseLevel": e0.get("baseLevel") == 3,
        }
        failed = [k for k, v in checks.items() if not v]
        if failed:
            cp_load_ok = False
            detail += f" failed_checks={failed} entry={json.dumps(e0)[:300]}"
        else:
            detail += " checkpoint party preserves new fields"
    else:
        cp_load_ok = False
        detail += f" cp_party={cp_party}"
except Exception as e:
    cp_load_ok = False
    detail += f" parse_err={e}"
record("checkpoint round-trip preserves new fields", cp_load_ok, detail)

# --- Step 7: Root + leaderboard ---
print("\n--- Step 7: GET /api/ + /api/game/leaderboard ---")
r = session.get(f"{API}/")
ok = r.status_code == 200
record("GET /api/ returns 200", ok, f"status={r.status_code} body={r.text[:120]}")

r = session.get(f"{API}/game/leaderboard")
ok = r.status_code == 200
detail = f"status={r.status_code}"
try:
    body = r.json()
    detail += f" leaderboard_len={len(body.get('leaderboard', []))}"
except Exception as e:
    ok = False
    detail += f" parse_err={e}"
record("GET /api/game/leaderboard returns 200", ok, detail)

# --- Summary ---
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
for name, ok, detail in results:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
print(f"\n{passed}/{total} passed")

sys.exit(0 if passed == total else 1)
