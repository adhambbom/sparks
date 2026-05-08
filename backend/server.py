from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

# ============================================================
# CONFIG
# ============================================================
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================
# AUTH UTILS
# ============================================================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7),
               "type": "access"}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(days=30),
               "type": "refresh"}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(key="access_token", value=access, httponly=True,
                        secure=False, samesite="lax", max_age=604800, path="/")
    response.set_cookie(key="refresh_token", value=refresh, httponly=True,
                        secure=False, samesite="lax", max_age=2592000, path="/")

# ============================================================
# MODELS
# ============================================================
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=64)
    name: Optional[str] = "Player"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    house: Optional[str] = "obsidian"

class GameStatePayload(BaseModel):
    state: Dict[str, Any]

class BuyItemRequest(BaseModel):
    item_id: str
    cost: int

class ArenaScoreRequest(BaseModel):
    waves_completed: int
    score: int

# ============================================================
# DEFAULT GAME STATE (matches frontend constants)
# ============================================================
def default_game_state(player_name: str = "Spark", house: str = "obsidian") -> dict:
    house_stats = {
        "obsidian": {"hp": 70, "mp": 30, "atk": 14, "def": 6, "spd": 14, "ability": "stealth_strike"},
        "sapphire": {"hp": 110, "mp": 25, "atk": 10, "def": 12, "spd": 7, "ability": "plasma_aegis"},
        "emerald":  {"hp": 85, "mp": 40, "atk": 11, "def": 8, "spd": 11, "ability": "vine_barrage"},
        "ruby":     {"hp": 100, "mp": 25, "atk": 16, "def": 10, "spd": 6, "ability": "ground_slam"},
    }
    s = house_stats.get(house, house_stats["obsidian"])
    return {
        "player": {
            "name": player_name,
            "house": house,
            "level": 1,
            "xp": 0,
            "xpToNext": 100,
            "hp": s["hp"], "maxHp": s["hp"],
            "mp": s["mp"], "maxMp": s["mp"],
            "atk": s["atk"], "def": s["def"], "spd": s["spd"],
            "syncLevel": 1,
            "gold": 50,
            "skillPoints": 0,
            "abilities": ["power_strike", s["ability"]],
            "equipped": {"weapon": "training_baton", "armor": "uniform"},
            "inventory": [
                {"id": "health_pack", "qty": 3},
                {"id": "energy_cell", "qty": 2},
            ],
        },
        "world": {
            "currentMap": "academy",
            "position": {"x": 10, "y": 12},
            "completedTrials": [],
            "arenaUnlocked": False,
            "arenaBestWave": 0,
        },
        "lastSaved": datetime.now(timezone.utc).isoformat(),
    }

# ============================================================
# APP SETUP
# ============================================================
app = FastAPI(title="Synthetic Sparks API")
api = APIRouter(prefix="/api")

# ============================================================
# AUTH ENDPOINTS
# ============================================================
@api.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name or "Player",
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {
        "id": user_id,
        "email": email,
        "name": req.name or "Player",
        "role": "user",
        "access_token": access,
    }

# Brute-force protection
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

async def check_lockout(email: str):
    """Raise 429 if user is locked out."""
    record = await db.login_attempts.find_one({"identifier": email})
    if not record:
        return
    locked_until = record.get("locked_until")
    # Mongo may return naive datetimes; make tz-aware as UTC for safe comparison.
    if locked_until is not None and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if locked_until and locked_until > datetime.now(timezone.utc):
        remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Locked for {remaining} minute(s).",
        )

async def record_login_failure(email: str):
    record = await db.login_attempts.find_one({"identifier": email})
    fails = (record.get("fails", 0) if record else 0) + 1
    update: Dict[str, Any] = {
        "identifier": email,
        "fails": fails,
        "last_attempt": datetime.now(timezone.utc),
    }
    if fails >= MAX_FAILED_ATTEMPTS:
        update["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        update["fails"] = 0  # reset counter; lockout held by locked_until
    await db.login_attempts.update_one(
        {"identifier": email}, {"$set": update}, upsert=True,
    )

async def clear_login_failures(email: str):
    await db.login_attempts.delete_one({"identifier": email})

@api.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower()
    await check_lockout(email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        await record_login_failure(email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_login_failures(email)
    user_id = str(user["_id"])
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {
        "id": user_id,
        "email": email,
        "name": user.get("name", "Player"),
        "role": user.get("role", "user"),
        "access_token": access,
    }

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=new_access, httponly=True,
                            secure=False, samesite="lax", max_age=604800, path="/")
        return {"access_token": new_access}
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================================
# CHARACTER & GAME STATE
# ============================================================
@api.post("/character/create")
async def create_character(req: CharacterCreate, user: dict = Depends(get_current_user)):
    house = req.house if req.house in {"obsidian", "sapphire", "emerald", "ruby"} else "obsidian"
    state = default_game_state(req.name, house)
    await db.game_saves.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "current": state,
            "checkpoint": state,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"state": state}

@api.get("/character/me")
async def get_character(user: dict = Depends(get_current_user)):
    save = await db.game_saves.find_one({"user_id": user["id"]}, {"_id": 0})
    if not save:
        return {"has_character": False, "state": None}
    return {"has_character": True, "state": save.get("current"), "checkpoint": save.get("checkpoint")}

@api.post("/game/save")
async def save_game(payload: GameStatePayload, user: dict = Depends(get_current_user)):
    state = payload.state
    state["lastSaved"] = datetime.now(timezone.utc).isoformat()
    await db.game_saves.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "current": state,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True, "state": state}

@api.get("/game/save")
async def load_game(user: dict = Depends(get_current_user)):
    save = await db.game_saves.find_one({"user_id": user["id"]}, {"_id": 0})
    if not save:
        raise HTTPException(status_code=404, detail="No save found")
    return {"state": save.get("current"), "checkpoint": save.get("checkpoint")}

@api.post("/game/checkpoint")
async def save_checkpoint(payload: GameStatePayload, user: dict = Depends(get_current_user)):
    state = payload.state
    state["lastSaved"] = datetime.now(timezone.utc).isoformat()
    await db.game_saves.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "current": state,
            "checkpoint": state,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True}

@api.post("/game/restore-checkpoint")
async def restore_checkpoint(user: dict = Depends(get_current_user)):
    save = await db.game_saves.find_one({"user_id": user["id"]}, {"_id": 0})
    if not save or not save.get("checkpoint"):
        raise HTTPException(status_code=404, detail="No checkpoint found")
    checkpoint = save["checkpoint"]
    await db.game_saves.update_one(
        {"user_id": user["id"]},
        {"$set": {"current": checkpoint, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"state": checkpoint}

@api.post("/game/arena-score")
async def submit_arena_score(req: ArenaScoreRequest, user: dict = Depends(get_current_user)):
    await db.arena_scores.insert_one({
        "user_id": user["id"],
        "name": user.get("name", "Player"),
        "waves_completed": req.waves_completed,
        "score": req.score,
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True}

@api.get("/game/leaderboard")
async def get_leaderboard():
    pipeline = [
        {"$sort": {"score": -1}},
        {"$group": {
            "_id": "$user_id",
            "name": {"$first": "$name"},
            "best_score": {"$first": "$score"},
            "best_wave": {"$first": "$waves_completed"},
        }},
        {"$sort": {"best_score": -1}},
        {"$limit": 20},
    ]
    cursor = db.arena_scores.aggregate(pipeline)
    results = []
    async for doc in cursor:
        results.append({
            "name": doc.get("name", "Player"),
            "score": doc.get("best_score", 0),
            "wave": doc.get("best_wave", 0),
        })
    return {"leaderboard": results}

@api.get("/")
async def root():
    return {"message": "Synthetic Sparks API", "version": "1.0"}

# ============================================================
# STARTUP
# ============================================================
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.game_saves.create_index("user_id", unique=True)
    await db.arena_scores.create_index([("score", -1)])
    await db.login_attempts.create_index("identifier", unique=True)
    # Seed admin
    existing_admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing_admin:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing_admin["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
        )
        logger.info(f"Admin password updated: {ADMIN_EMAIL}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# Mount router
app.include_router(api)

# Static files (sprites and other assets) served under /api/static/...
# Path is /api/static/sprites/<filename>.png  (no extra prefix needed because ingress strips it)
from fastapi.staticfiles import StaticFiles
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/api/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# CORS - allow frontend origin and mobile (no origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
)
