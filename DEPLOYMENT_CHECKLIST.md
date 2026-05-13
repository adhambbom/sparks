# Sparks — Google Play Release Checklist

## ✅ Code & Backend Status (verified on this build)

- **Bundle**: 951 modules — Metro compiles clean
- **Routes**: home / combat / synergy / skills / registry all return 200
- **Backend**: 10/10 smoke tests PASS, zero 500s, response times 69–314 ms
- **Save round-trip**: state.player + state.quantum (incl. synergy nodes,
  rarity, IVs, dataLevel) all persist intact through `/api/game/save` →
  `/api/character/me`
- **Static assets**: icon.png, adaptive-icon.png, splash-icon.png,
  favicon.png all present in `/assets/images/`
- **No hardcoded localhost URLs** anywhere in `/app/frontend/src` or `/app/frontend/app`
- **All backend URLs** use `process.env.EXPO_PUBLIC_BACKEND_URL` (the EAS
  build will inject the production URL based on `.env.production`)

## 🔒 app.json — Production-ready

- `name`: Synthetic Sparks
- `version`: 1.0.0
- `android.package`: app.syntheticsparks.client
- `android.versionCode`: 1
- `android.targetSdkVersion`: 35  ← Play Store now requires ≥ 34
- `android.minSdkVersion`: 24
- ProGuard + Resource shrinking enabled in release builds
- Adaptive icon configured
- Edge-to-edge enabled
- Permissions limited to: INTERNET · ACCESS_NETWORK_STATE · VIBRATE
- Blocked: RECORD_AUDIO · STORAGE · CAMERA · LOCATION (zero-permission attack surface)

## 🛠 eas.json — Build profiles

| Profile | Output | Channel | Automation Bypass |
|---|---|---|---|
| development | APK (assembleDebug) | — | ON  |
| staging | APK (assembleRelease) | staging | ON |
| **production** | **AAB (bundleRelease)** | production | **OFF** |

The `production` profile auto-increments build numbers and disables the
auth bypass — exactly what Play submission requires.

## 🚀 Build & Submit Steps (run on your local machine)

1. **Save to GitHub** — use the Emergent "Save to GitHub" button.

2. **Clone your repo locally**, then:
   ```bash
   cd frontend
   npm install -g eas-cli
   eas login
   eas build:configure          # fills in extra.eas.projectId
   ```

3. **Deploy the FastAPI backend** to a production URL (Emergent native
   deploy works for the backend). Capture that URL.

4. **Create `.env.production` in /frontend** with the production URL:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://your-backend.app.run/
   ```

5. **Lock down the automation bypass**:
   On the production backend, set `ENABLE_AUTOMATION_BYPASS=0`.
   The code already enforces a 403 + WARNING log when the flag is off.

6. **Build the AAB**:
   ```bash
   eas build --platform android --profile production
   ```
   EAS will sign the bundle with a managed keystore (first build only),
   then return a downloadable .aab.

7. **Submit to Google Play Console**:
   - Create a developer account ($25 one-time)
   - Create a new app
   - Upload the .aab to the Internal Testing track first
   - Complete the data-safety form (the app only stores game progress; no
     personal data leaves the device beyond username + game state)
   - Submit for review

## 🧪 Pre-submission QA (do on a physical Android device)

- [ ] App launches without crash
- [ ] Tutorial NETWORK CONTACT prompt appears on first run
- [ ] D-PAD movement responsive; A button confirms; B opens menu
- [ ] Combat: STRIKE / PROTOCOL / DEPLOY / EXTRACT / ESCAPE all functional
- [ ] Deploy entity: GRID cost shown on card; deploy succeeds when affordable
- [ ] Deploy fail: GRID bar flashes red + "GRID LINK DENIED" chip
- [ ] Save: pause menu → save persists state to backend
- [ ] Synergy: enter SYNERGY GRID, JACK IN a node, return to combat — buff applies
- [ ] No layout overlap on the smallest test device (e.g. 360×800)

## 📋 Notes

- 44 non-runtime TypeScript strict-mode warnings exist but the Metro
  bundler ignores them at build time. They do not affect the AAB.
- The Emergent preview environment cannot generate the AAB itself —
  that step happens externally via EAS Build.
