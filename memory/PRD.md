# Synthetic Sparks: The Academy of Emergence

A full mobile RPG built with Expo + FastAPI + MongoDB.

## Overview
- **Genre**: Sci-fi RPG with cyberpunk aesthetic
- **Camera**: Top-down academy exploration
- **Combat**: FF7-style turn-based with random encounters
- **Aesthetic**: 16-bit GBA pixel art with neon highlights on dark tech backgrounds

## Tech Stack
- Frontend: React Native (Expo SDK 54), Expo Router, AsyncStorage, axios
- Backend: FastAPI, MongoDB (Motor async), JWT auth (PyJWT + bcrypt)

## Core Features (MVP shipped)

### Authentication
- Custom JWT-based email/password (httpOnly cookies + Bearer fallback for native)
- Admin user auto-seeded on startup
- Per-user save state in `game_saves` collection

### Character Progression
- "The Spark" character with 3 base stats (HP, MP, ATK/DEF/SPD)
- XP curve: `100 * 1.35^(level-1)` per level
- Level-up grants +1 skill point, +12 maxHp, +6 maxMp, +stat scaling
- Sync Level (max level reached) gates Outside Arena (Sync ≥ 5)

### Skill Tree (15 abilities, 3 branches)
- **Cyber-Strikes**: Plasma Blade, Overload, Mech Slam, Rocket Punch
- **Phase-Shifting**: Phase Step, Mind Blast, Healing Pulse, Rage Burst, Time Warp
- **Technomancy**: Hack, Reboot, Virus, Data Shield, Mind Control
- Plus base Power Strike

### Exploration
- 20×15 tile-based academy map (walls, floors, store, skill chamber, launch pad)
- Virtual joystick (bottom-left) + 360° smooth movement
- Action button A: interact (talk NPCs, enter store/skill room)
- Action button B: pause menu (rest, save, skills, inventory)
- 3 unique NPCs with dialog (Prof. Orion, Jax, Lyra)
- 8% per-tile random encounter chance

### Combat
- Turn-based; speed determines who acts first
- 4 actions: Attack, Skill, Item, Run
- Element rock-paper-scissors: physical/energy/cyber/psi with weakness 1.6× and resist 0.5×
- Status effects: burn (DOT), shield (50% mit), haste (extra turn), drain (HP siphon)
- 25 enemies sourced from custom sprite sheet, 4 difficulty tiers
- Random item drops on victory (drop chance per enemy)
- XP, gold, and loot rewards

### Store (Tech-Lab)
- 9 buyable items: 3 weapons, 3 armor, 3 consumables
- ATK/DEF stat boosts auto-recompute on equip

### Outside Arena (Horde Mode)
- Wave-based survival, escalating enemy tiers (waves 1–13+)
- 30% HP and partial MP heal between waves
- Cumulative score submitted to global leaderboard
- Best wave persists in player's save

### Save / Checkpoint / Death
- Manual save in pause menu (writes both current + checkpoint)
- Auto-save after each combat victory
- Auto-checkpoint on rest at academy
- Death → Game Over screen → Restore Checkpoint
- Save state persists across sessions

### Online Features
- Global leaderboard (top 20 by best arena score)
- Sortable, name + score + waves cleared

## Game Design Decisions

### Balance
- Damage formula: `max(1, floor((atk * abilityPower - def * 0.5) * variance * elementMod))`
- Variance: 0.85–1.15
- Skills cost MP, scale with player ATK
- Higher-tier enemies have higher HP/ATK but slower XP gain rate keeps progression honest

### Routing Map
- `/` Title screen (Login/Register or Continue/New Game/Leaderboard)
- `/login`, `/register` Auth flows
- `/character-create` Pick name & enter the world
- `/game` Main exploration HUD
- `/combat` Battle screen (params: enemyId, mode, arenaWave)
- `/skills` Branching skill tree
- `/inventory` Equip / use items
- `/store` Buy weapons/armor/consumables
- `/arena` Horde mode lobby
- `/gameover` Death + restore checkpoint
- `/leaderboard` Global top 20

## Folder Structure
```
/app
  /backend
    server.py          # FastAPI + MongoDB + JWT auth + game endpoints
    .env               # MONGO_URL, JWT_SECRET, ADMIN_*
  /frontend
    /app               # Expo Router screens
    /src
      /components      # PixelText, PixelButton, StatBar, Sprite, VirtualJoystick, ActionButton
      /contexts        # AuthContext, GameContext (full game state machine)
      /data            # gameData.ts (abilities, enemies, items, map, NPCs)
      /utils           # api.ts (axios client w/ Bearer + cookie auth)
```

## Backend API
All routes prefixed `/api`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | - | New account |
| POST | `/auth/login` | - | Login |
| POST | `/auth/logout` | ✓ | Logout |
| GET | `/auth/me` | ✓ | Current user |
| POST | `/auth/refresh` | refresh cookie | New access token |
| POST | `/character/create` | ✓ | Init game state |
| GET | `/character/me` | ✓ | Load current state + checkpoint |
| POST | `/game/save` | ✓ | Save current state |
| GET | `/game/save` | ✓ | Load state |
| POST | `/game/checkpoint` | ✓ | Save current as checkpoint |
| POST | `/game/restore-checkpoint` | ✓ | Restore checkpoint |
| POST | `/game/arena-score` | ✓ | Submit arena run |
| GET | `/game/leaderboard` | - | Top 20 |

## Demo Credentials
- Admin: `admin@example.com` / `admin123`
- Or register any new account on the title screen.

## Future Enhancement Ideas
1. Multiplayer Arena PvP (turn-based async duels)
2. NFT-style cosmetic skins (revenue stream)
3. Boss raid events with shared global health bar
4. Daily quests + login streak rewards
5. Story missions to ruined Old World cities (Sync Lv 20+)
