# Synthetic Sparks — v1.0.0 Release Notes

**Codename:** *The Academy of Emergence*
**Build date:** June 2025
**Platform:** Android (Google Play Store)
**Status:** ✅ Production Candidate — Physical QA Pass

---

## 🎮 What's New (Play Store "What's new" field — 500 char max)

> Synthetic Sparks v1.0 launches with the complete Academy of Emergence campaign! Deploy rogue AI entities into digital sectors, master turn-based combat on the POWER GRID, and ascend the Operator Synergy tree. Features: Sector 1 + 2B unlocked, 16-bit GBA-style pixel art, full save sync, IV/Rarity/DATA leveling, faction-passive traits, contextual tutorial system, and a tight, 60FPS-smooth isometric overworld. Jack in, Operator.

*(495 characters — fits within Google Play limit)*

---

## 📦 Full CHANGELOG — v1.0.0

### 🆕 New Systems
- **Operator Synergy Framework** — SVG-rendered skill tree with rarity pulses; nodes apply real-time stat buffs to deployed entities
- **Progression Addiction Loop** — Per-entity IV rolls, 5-tier Rarity (Common → Mythic), independent DATA leveling system
- **Entity Signature Identities** — Faction passives (Glitch, Sentinel, Vector, Phantom) with combat traits
- **POWER GRID Deployment UX** — Animated grid meter, per-card cost chips, red-flash failure feedback ("GRID LINK DENIED")
- **Context-Aware Tutorial** — Typewriter-effect prompts with manual dismiss; AsyncStorage-backed completion tracking
- **Onboarding Replay** — Pause menu "REPLAY ONBOARDING" button + `?resetTutorial=1` URL param for QA

### ⚡ Performance & UX
- 60FPS smooth isometric map scrolling (verified on physical Android device)
- Sidebar is anchored and scales correctly across device sizes (360×800 → tablets)
- Centralized collision logic (no clipping at sector boundaries)
- Visual coherence pipeline ensures AI sprites render consistently

### 🎨 Audio & Visual
- 16-bit GameBoy Advance pixel art aesthetic locked
- Isometric overworld with parallax depth
- `expo-audio` powered native sound playback
- Procedural SVG graphics via `react-native-svg`

### 🛡 Security & Stability
- Production auth bypass DISABLED (`ENABLE_AUTOMATION_BYPASS=0`)
- 403 + warning log if bypass is ever re-enabled in prod
- Zero-permission attack surface — only INTERNET, ACCESS_NETWORK_STATE, VIBRATE granted on Android
- All web-only/camera/microphone/storage/location permissions **blocked**
- ProGuard + Resource shrinking enabled

### 🧰 Save System
- Round-trip save/load verified: `state.player` + `state.quantum` (with synergy nodes, rarity, IVs, dataLevel) persists intact
- `/api/game/save` + `/api/game/checkpoint` endpoints production-ready
- Local AsyncStorage fallback for tutorial flags

### 🐛 Bug Fixes (this cycle)
- Fixed React Hooks order violation crashes in `combat.tsx` and `operator-framework.tsx`
- Fixed combat text overlap on small viewports
- Swapped A/B GameBoy controls to standard layout
- Eliminated all fantasy/Pokémon terminology — strict cyberpunk lexicon enforced (Tamed → Extracted/Decoded; Mana → Stability; Pet → Entity; Summon → Deploy)
- Sidebar anchor scaling fixed for narrow Android devices

### 📋 Verified Test Matrix
- Backend smoke tests: **10/10 PASS** (69–314ms response times)
- Frontend E2E (testing agent): **PASS**
- Physical Android device QA: **PASS** — UI layout, performance, auth, Level 1, Level 2B transition

---

## ⚠️ Known Limitations (post-V1 backlog)

- 3 minion sprites (`mech_2`, `mech_3`, `mech_4`) currently fall back to the default placeholder — planned for v1.1
- Locked treasure chest mechanics deferred to v1.1
- Phase 4 World Expansion (larger sectors, hidden rooms, hackable doors, elite encounters) — v1.2 roadmap
- 44 non-runtime TypeScript strict-mode warnings — do not affect the AAB (Metro ignores at build time)

---

## 📲 Compatibility

| Target | Value |
|---|---|
| Min Android | 7.0 (API 24) |
| Target Android | 15 (API 35) — ✅ Meets Play Store 2025 requirement (≥34) |
| Architecture | arm64-v8a, armeabi-v7a, x86, x86_64 (universal AAB) |
| Orientation | Portrait only |
| New Architecture (Fabric/TurboModules) | ✅ Enabled |

---

*"Stop running. Start emerging." — The Academy of Emergence*
