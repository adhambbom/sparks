# 🎮 Synthetic Sparks — Production Build Runbook

This document is the exact, copy-pasteable command sequence to produce a
**signed Android App Bundle (.aab)** for the Google Play Store, plus the
iOS `.ipa` for the App Store.

> ⚠ The actual cloud build runs on **Expo EAS servers** — you'll execute
> these commands on your local machine (or CI), not inside the Emergent
> preview container. Everything *config-side* (eas.json, app.json,
> permissions, target SDK, env matrix, debug stripping, asset compression)
> is already done.

---

## 0 · Prerequisites (one-time setup)

```bash
# Install the EAS CLI globally
npm install -g eas-cli@latest

# From the frontend directory, log in to your Expo account
cd /path/to/synthetic-sparks/frontend
eas login

# Link the project to your Expo account — this writes the projectId
# into app.json under expo.extra.eas.projectId
eas init --id <YOUR-EAS-PROJECT-ID>      # if you already have one
# OR
eas init                                  # creates a new project
```

## 1 · Android signing keystore

```bash
# EAS will offer to generate and manage your keystore. Recommended.
eas credentials
# → Select Android → production → Set up a new keystore
```

If you already have an upload-signing keystore from a previous release,
upload it via the same prompt.

## 2 · Production env vars

EAS reads the production `env` block from `eas.json` automatically:

```json
"production": {
  "env": {
    "NODE_ENV": "production",
    "ENABLE_AUTOMATION_BYPASS": "0"   // ⚠ HARD-LOCKED
  }
}
```

These are inlined into the bundle at compile time. Make sure
`EXPO_PUBLIC_BACKEND_URL` points to your production backend URL — set it
either inside `eas.json` env block or with `eas env:create`:

```bash
eas env:create --environment production --name EXPO_PUBLIC_BACKEND_URL --value https://api.syntheticsparks.app
```

## 3 · Run the production build

```bash
cd /path/to/synthetic-sparks/frontend

# Android — produces a signed .aab ready for the Play Console
eas build --platform android --profile production

# iOS — produces a signed .ipa ready for App Store Connect
eas build --platform ios --profile production
```

Each cloud build takes ~15-25 minutes. EAS will print a download link to
the resulting `.aab` / `.ipa`.

## 4 · Submit to the store

```bash
# Google Play (internal track first, then promote)
eas submit --platform android --profile production --latest

# Apple App Store
eas submit --platform ios --profile production --latest
```

The first time you submit to Google Play you'll need a service-account
JSON file (`./play-store-service-account.json`) — see
https://docs.expo.dev/submit/android/.

## 5 · OTA updates after launch

```bash
# Publish JS-only updates without re-uploading binaries
eas update --branch production --message "Patch description"
```

---

## 📋 Pre-flight checklist (already done in this repo)

| Item | Status | Where |
|---|---|---|
| `ENABLE_AUTOMATION_BYPASS=0` in production env | ✅ | `eas.json` > production.env |
| `NODE_ENV=production` in production env | ✅ | `eas.json` > production.env |
| Server-side guard returns 403 if flag is 0 | ✅ | `backend/server.py` |
| Android target SDK = 35 | ✅ | `app.json` > expo-build-properties |
| 64-bit / ARM64 enabled by default | ✅ | EAS default (no opt-out) |
| Proguard + resource shrinking on release | ✅ | `app.json` > expo-build-properties |
| Sensitive permissions explicitly blocked | ✅ | `app.json` > android.blockedPermissions |
| Adaptive icon configured | ✅ | `app.json` > android.adaptiveIcon |
| Splash screen configured | ✅ | `app.json` > plugins.expo-splash-screen |
| Edge-to-edge enabled | ✅ | `app.json` > android.edgeToEdgeEnabled |
| Bundle ID + package name set | ✅ | `app.syntheticsparks.client` |
| iOS encryption export declaration | ✅ | `app.json` > ios.infoPlist.ITSAppUsesNonExemptEncryption |
| Debug overlay tree-shaken (GRID toggle) | ✅ | gated by `__DEV__` in `conduit-maze.tsx` |
| Backdrop optimized (31% smaller) | ✅ | `backend/static/sprites/conduit_maze_bg.png` |
| `.env.production` template documented | ✅ | `backend/.env.production` |
| `.env.staging` template documented | ✅ | `backend/.env.staging` |
| Security guard verified end-to-end | ✅ | deep-testing report passed all 3 scenarios |

## 🎨 Texture compression note

Real GPU texture compression (ETC2 / ASTC / DXT) happens automatically
during the EAS Android build via the Android Gradle plugin. There's no
manual step you have to run — drop your PNGs in `/assets` or serve them
from the backend (as we do for level art), and the build pipeline picks
the right format per device.

For *manual* pre-compression of very large assets (≥ 2 MB), use
`pngquant` or `oxipng`:

```bash
pngquant --quality=70-85 --strip --skip-if-larger -o out.png in.png
```

## 🚀 First-launch ramp plan

1. Build & submit to Google Play **internal track** (50 testers limit).
2. Verify automation-bypass returns 403 on the prod URL:
   ```bash
   curl -X POST https://api.syntheticsparks.app/api/auth/automation-bypass
   # expect: HTTP/1.1 403 Forbidden
   ```
3. Smoke-test with 5-10 internal testers.
4. Promote to **closed beta** (100-2000 testers).
5. Watch crash-free sessions in Play Console for 72 hours.
6. Promote to **production** with a 10% staged rollout.
7. Scale to 100% after another 72h of healthy metrics.

## 📞 If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on EAS with "Keystore not found" | Forgot to run `eas credentials` | Set up keystore via `eas credentials` |
| App crashes on launch | Backend URL not set | `eas env:create EXPO_PUBLIC_BACKEND_URL=...` |
| Auth always fails on prod build | `ENABLE_AUTOMATION_BYPASS` flipped on prod | Verify `eas.json` and re-deploy backend |
| Play submission rejected for permissions | New permission added to `app.json` | Justify in Play Console or remove |
| OTA update not reaching users | Release channel mismatch | Match `eas update --branch` to runtime channel |

---

**Last updated:** Release prep for v1.0.0 (Conduit Maze + Tutorial)
