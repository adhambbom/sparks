# 🚀 Synthetic Sparks — Production Build Runbook (LOCAL)

This is the **exact tested sequence** to produce a signed `.aab` for the
Google Play Store from your local machine. All the configuration work
inside the project is already done — this runbook is just the commands
you'll execute on your terminal.

---

## ✅ Pre-flight (already done in this repo)

| Item | Status |
|---|---|
| `ENABLE_AUTOMATION_BYPASS=0` locked into production env via `eas.json` | ✅ |
| `NODE_ENV=production` locked into production env via `eas.json` | ✅ |
| Server-side guard returns HTTP 403 when flag is 0 (verified end-to-end) | ✅ |
| Android `targetSdkVersion=35`, `compileSdkVersion=35`, `minSdkVersion=24` | ✅ |
| 64-bit (`arm64-v8a`) + `x86_64` architectures enabled | ✅ |
| ProGuard + resource shrinking on release builds | ✅ |
| Dangerous permissions blocked (`CAMERA`, `RECORD_AUDIO`, `LOCATION`, `STORAGE`) | ✅ |
| Icon 1024×1024 (Play Store requirement) | ✅ |
| Adaptive icon 1024×1024 + splash icon 512×512 created | ✅ |
| Favicon squared to 64×64 | ✅ |
| All `__DEV__`-gated debug overlays (GRID toggle, automation logs) tree-shaken in release | ✅ |
| Backdrop `conduit_maze_bg.png` compressed (-31%) | ✅ |
| 10 heavy backend sprites compressed (-4.5 MB total, ~70% avg) | ✅ |
| Unused `react-logo*` assets removed | ✅ |
| `expo prebuild --platform android` verified clean (no warnings/errors) | ✅ |
| `expo-build-properties` aligned to SDK-compatible version `~1.0.10` | ✅ |
| `iconExportComplete`, manifest permissions in `AndroidManifest.xml` confirmed | ✅ |

---

## 📋 Step-by-step local commands

### 0 · One-time setup

```bash
# Install the EAS CLI globally
npm install -g eas-cli@latest

# Verify versions (you should see eas-cli >= 13.0.0)
eas --version
node --version  # >= 18 recommended
```

### 1 · Log in & link the project

```bash
cd /path/to/synthetic-sparks/frontend

# Sign in with your Expo account
eas login

# Link this repo to your EAS project (creates one if you don't have it).
# Writes `expo.extra.eas.projectId` into app.json.
eas init
```

You only do steps 0-1 once per machine / project.

### 2 · Configure your production backend URL

```bash
# Set the public-facing backend URL the production app will hit.
# Replace with your real prod host.
eas env:create \
  --environment production \
  --name EXPO_PUBLIC_BACKEND_URL \
  --value "https://api.syntheticsparks.app"

# Verify it appears in the production environment list:
eas env:list --environment production
```

### 3 · Set up Android signing keystore

```bash
# Option A — Let EAS generate + manage a fresh upload-signing keystore (recommended).
eas credentials
# → Select platform: Android
# → Select build profile: production
# → Choose "Set up a new keystore" → "Generate new keystore"

# Option B — Upload an existing keystore (only if you've shipped to Play Store before
# under the same package name `app.syntheticsparks.client`):
# Same menu → "Use an existing keystore" → provide .jks / passwords / key alias.
```

### 4 · Build the production AAB

```bash
# Cloud build — takes ~15-25 minutes. Returns a downloadable .aab URL.
eas build --platform android --profile production
```

While this runs, you can monitor progress at https://expo.dev/accounts/<you>/projects/synthetic-sparks/builds.

**What this build will produce:**
- A signed `.aab` (Android App Bundle) — ready for the Play Console
- All `__DEV__` code tree-shaken (no debug overlays, no logging)
- Production-mode env baked in (`ENABLE_AUTOMATION_BYPASS=0`, `NODE_ENV=production`)
- 64-bit + 32-bit architectures bundled in one AAB (Play picks per device)
- Resources shrunk + ProGuard obfuscated

### 5 · (First time only) Set up Play Console + service account

Follow the Expo docs: https://docs.expo.dev/submit/android/

Summary:
1. Create your Play Console app under package name `app.syntheticsparks.client`.
2. Create a Google Cloud service account with **Service Account User** + **Service Account Token Creator** roles, plus **Release Manager** access in Play Console.
3. Download the JSON key → save as `play-store-service-account.json` in the `frontend/` folder.
4. ⚠ Add `play-store-service-account.json` to `.gitignore` — never commit it.

### 6 · Submit to Google Play (Internal Track)

```bash
# Pushes the latest production build straight to the Play Console
# internal test track as a draft. You promote later from the Play UI.
eas submit --platform android --profile production --latest
```

The first submit usually takes 10-30 minutes to appear in Play Console.
Pre-launch report comes ~1-2 hours after that.

### 7 · OTA hotfixes after launch

For JS/style-only fixes (no native changes), you don't have to re-upload
the AAB — push an OTA update:

```bash
eas update --branch production --message "Hotfix: <description>"
```

Users get it on next app launch. Native code changes still require a
fresh `eas build`.

---

## 🚨 If anything fails

| Symptom | Likely cause | Fix |
|---|---|---|
| `eas build` fails with "Keystore not found" | Skipped step 3 | Run `eas credentials` |
| `eas submit` fails "Service account credentials missing" | Step 5 skipped | Create + download service-account JSON |
| Build crashes on launch (Sentry: missing env var) | Backend URL not set | Re-run step 2 with correct URL |
| Auth always fails on prod build | `ENABLE_AUTOMATION_BYPASS` flipped on prod | Verify `eas.json` production env; backend has `ENABLE_AUTOMATION_BYPASS=0` |
| Play Console rejects for permissions | New permission auto-added by a plugin | Justify in Play Console **or** add to `blockedPermissions` in `app.json` |
| OTA update not reaching users | Channel mismatch | Match `eas update --branch <name>` to the runtime channel in `eas.json` |

---

## 📝 Required Play Console assets (you'll need to prepare separately)

The build pipeline doesn't generate marketing assets — Google needs:
- **Feature graphic** — 1024×500 PNG
- **Phone screenshots** — minimum 2, max 8 (16:9 or 9:16, min 320px)
- **App icon** — 512×512 (already in `assets/images/icon.png` at 1024×1024 — Play will downscale)
- **Short description** — 80 chars max
- **Full description** — 4000 chars max
- **Privacy policy URL** — hosted on your own domain

Use Play Console's tools or any image editor to make these.

---

## 🏷 Version bump for future releases

Before each new `eas build` for production:

1. Bump `version` in `app.json` (semver, e.g. `1.0.0` → `1.0.1`)
2. Bump `android.versionCode` in `app.json` by **exactly +1** every time (Play requires monotonic increase)
3. Commit + tag in git
4. Run `eas build --platform android --profile production`

---

## ✨ Smoke test after first Play install

Once the AAB lands in your internal-track tester device:

1. Launch the app — title screen renders, no crash
2. Tap CONTINUE → loads your save
3. From the academy, descend the spiral staircase → Conduit Maze loads
4. Verify: **no GRID OFF button visible** (confirms `__DEV__` tree-shaking worked)
5. Open MENU → HOW TO PLAY → all 12 pages render
6. On a separate machine: `curl -X POST https://api.syntheticsparks.app/api/auth/automation-bypass` → expect **HTTP 403** (confirms server-side lockdown)

If all six pass, you're production-ready. Promote to closed beta → open beta → 10% staged rollout → 100%.

---

**Last updated:** v1.0.0 — Conduit Maze · Tutorial · Security hardened
