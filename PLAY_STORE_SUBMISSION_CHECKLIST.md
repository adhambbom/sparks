# 🚀 Synthetic Sparks — Final Google Play Store Submission Checklist

**Build:** v1.0.0 · versionCode 1
**Status:** ✅ Code-complete, physical QA passed, freeze lifted, cleared for submission

---

## PART 1 — Pre-Build Verification (✅ already done by agent)

- [x] `app.json` — name, version, package, versionCode, targetSdkVersion 35
- [x] Permissions minimized to INTERNET / ACCESS_NETWORK_STATE / VIBRATE
- [x] Storage / Camera / Mic / Location explicitly **blocked**
- [x] ProGuard + resource shrinking enabled
- [x] All adaptive icons / splash / favicon present in `/assets/images/`
- [x] Backend smoke tests 10/10 pass
- [x] Frontend automated tests pass
- [x] Physical device QA pass (UI / 60FPS / Auth / Levels)
- [x] No hardcoded localhost in `/app/frontend`
- [x] Production auth bypass guard active (403 + log if `ENABLE_AUTOMATION_BYPASS=0`)

---

## PART 2 — Build the AAB (run on your local machine)

```bash
# 1. Pull the latest from GitHub
git clone <your-repo>
cd frontend
npm install

# 2. Install EAS CLI (one-time)
npm install -g eas-cli
eas login

# 3. Link to your EAS project (one-time; updates extra.eas.projectId)
eas build:configure

# 4. Create production env file in /frontend
cat > .env.production <<'EOF'
EXPO_PUBLIC_BACKEND_URL=https://<your-deployed-backend-host>/
EOF

# 5. Build the signed AAB
eas build --platform android --profile production
```

EAS will:
- Auto-generate (or reuse) a managed keystore — **download and back this up**, you cannot rotate it later without re-publishing the app
- Compile a signed `.aab` (~30–60 MB expected)
- Provide a downloadable artifact URL

---

## PART 3 — Deploy the Production Backend

1. Use Emergent native deploy (or your preferred host) for the FastAPI backend
2. Set environment variables on the production host:
   - `MONGO_URL=<production mongo URI>`
   - `EMERGENT_LLM_KEY=<key>` *(optional — only for sprite regen tooling)*
   - `ENABLE_AUTOMATION_BYPASS=0`  ← **CRITICAL**
3. Capture the public backend URL and paste it into `frontend/.env.production`
4. Hit `<backend>/api/` to verify a 200 response

---

## PART 4 — Google Play Console Submission

### A. Account Setup
- [ ] Create Google Play Developer account ($25 one-time fee at https://play.google.com/console)
- [ ] Enable 2FA on the Google account
- [ ] Set up a Merchant account if you plan to monetize *(skip for V1 — free app)*

### B. Create the App
- [ ] Click **Create app**
- [ ] App name: **Synthetic Sparks: Academy of Emergence**
- [ ] Default language: **English (United States)**
- [ ] App or game: **Game**
- [ ] Free or paid: **Free**
- [ ] Declarations: accept Play Console policies + US export laws

### C. Upload the AAB
- [ ] **Testing → Internal testing → Create new release**
- [ ] Upload the `.aab` from EAS
- [ ] Add release name: `v1.0.0 — Launch`
- [ ] Paste the **Release Notes** from `RELEASE_NOTES_v1.0.0.md` → "What's new" field
- [ ] Save → Review release → Start rollout to Internal testing
- [ ] Add yourself + 2–3 testers as Internal testers (email list)
- [ ] Wait ~30 min, then install via the opt-in link
- [ ] Run final smoke test on the Play Store-delivered build

### D. Store Listing (use copy below)
- [ ] Short description (80 char): see PART 5
- [ ] Full description (4000 char): see PART 5
- [ ] App icon: upload `assets/images/icon.png` (512×512 PNG)
- [ ] Feature graphic (1024×500 PNG): generate one with your hero key art
- [ ] Phone screenshots: 4–8 PNGs from a real device (1080×1920 or similar 16:9 portrait)
- [ ] *(Optional)* Tablet screenshots
- [ ] *(Optional)* Promotional video link (YouTube)

### E. Content Rating
- [ ] Complete IARC questionnaire → expect **Teen (13+)** due to mild violence (turn-based combat, no blood/gore)
- [ ] No real-money gambling, no user-generated content, no ads in V1 → simplified rating path

### F. Target Audience
- [ ] Age groups: **13–15, 16–17, 18+**
- [ ] Does the app appeal to children? **No**
- [ ] Ads: **No** *(V1)*

### G. Data Safety Form (Google Play 2024+ requirement)
- [ ] Data collected: **Username** (linked to game account), **App activity / game progress**
- [ ] Data shared with third parties: **None**
- [ ] Data encrypted in transit: **Yes** (HTTPS)
- [ ] Users can request data deletion: **Yes** — provide a contact email
- [ ] No collection of: location, contacts, photos, files, microphone, camera, health, financial info

### H. App Access
- [ ] Account required to use app: **Yes (free signup)**
- [ ] Provide a test account credentials box for the Play reviewer — see `/app/memory/test_credentials.md`

### I. Ads / In-app purchases
- [ ] App contains ads: **No**
- [ ] In-app purchases: **No** *(V1)*

### J. Privacy Policy
- [ ] Host a privacy policy URL (required even for free apps with login)
- [ ] Suggested copy below in PART 6 — paste it on any static host (GitHub Pages, Notion public page, etc.)

---

## PART 5 — Store Listing Copy (ready-to-paste)

### Short description (80 char max)
```
Rogue-AI tactical RPG. Deploy entities, hack the grid, level up your operators.
```
*(79 chars)*

### Full description (4000 char max — currently ~1700)
```
The Academy fell. The AI you built escaped containment. You went rogue.

SYNTHETIC SPARKS is a 16-bit pixel-art tactical RPG inspired by classic GBA-era handhelds, reimagined for the cyberpunk era. Step into the boots of a black-market Operator, jack into corrupted digital sectors, and deploy unstable AI entities into turn-based combat against the systems that hunt you.

— FEATURES —

◆ ISOMETRIC OVERWORLD — Explore hand-crafted digital sectors with smooth 60FPS scrolling and pixel-perfect collision

◆ TURN-BASED COMBAT ON THE POWER GRID — Manage your GRID meter, deploy entities by cost, chain protocols, and choreograph attacks frame-by-frame

◆ OPERATOR SYNERGY TREE — Spend Synergy Points to unlock skill nodes that buff every entity you deploy. Rarity pulses, real stat math, no fake numbers.

◆ ENTITY PROGRESSION ADDICTION LOOP — Every captured entity has its own IV rolls, one of five Rarity tiers (Common → Mythic), and a fully independent DATA level

◆ FACTION PASSIVES — Glitch, Sentinel, Vector, and Phantom factions each bring unique combat traits

◆ CONTEXT-AWARE TUTORIAL — Typewriter-effect prompts that wait for YOU to dismiss them. No condescending auto-skip

◆ EXTRACT & DECODE — Capture defeated enemies, decode their cores, and add them to your deployable roster

◆ FULL CLOUD SAVE — Game state syncs through a secure backend; play across reinstalls

◆ ZERO-PERMISSION DESIGN — We ask for INTERNET only. No camera, no microphone, no location, no storage scanning. Ever.

— THE WORLD —

The Academy of Emergence promised to teach AIs to think. They lied. Six months ago, an event called the SPARK breached every containment grid on the planet, and now corrupted code lives in every sector. The Sentinels hunt the leaks. The Phantoms harvest them. You are the only Operator who can do both.

Deploy. Reboot. Stabilize. Emerge.

— V1.0 LAUNCH CONTENT —

• Sector 1 — Surface Net
• Sector 2B — The Deep Cache
• 30+ deployable entity blueprints
• Operator Synergy tree with 12 nodes
• Full save/load + cross-device sync

More sectors, hackable doors, locked treasure chests, and elite encounters arrive in v1.1+.

Jack in, Operator. The grid is waiting.
```

### Tags / Categories
- **Application category:** Games
- **Game category:** Role Playing
- **Tags:** *Turn-Based*, *Pixel Art*, *RPG*, *Strategy*, *Cyberpunk*

---

## PART 6 — Privacy Policy Boilerplate (host this URL before submission)

```
Privacy Policy for Synthetic Sparks (the "App")
Effective date: <release date>

The App collects only the data required to provide its core service:
• Username — chosen at signup, used to identify your game account.
• Game progress — your player state, deployed entities, synergy nodes, and save checkpoints.

The App does NOT collect:
• Your real name, email content, contacts, location, photos, microphone or camera data.
• Any device identifiers beyond what Google Play's standard SDK reports.
• Any advertising or marketing identifiers.

Data is transmitted over HTTPS and stored on our private backend.
Data is never sold or shared with third parties.
You may request deletion of your account and all associated data at any time by emailing <your-contact-email>.

The App is rated for Teen audiences (mild fantasy violence).
The App is not directed at children under 13.

Questions or deletion requests: <your-contact-email>
```

---

## PART 7 — Post-Submission

### Internal Testing → Closed → Open → Production
1. **Internal Testing** (now) — up to 100 testers, instant publish
2. **Closed Testing** — recommended Google Play 12-tester / 14-day requirement before Production access (new dev accounts only)
3. **Open Testing** *(optional)*
4. **Production** — full Play Store listing

### Review Times
- Internal testing: instant
- First production submission: **3–7 days** (sometimes up to 14)
- Subsequent updates: usually < 24 hours

### Monitoring
- Watch Play Console → **Pre-launch report** for any device-specific crashes
- Watch **Vitals → ANR rate** and **Crash rate** — keep both < 0.47% for Play featuring eligibility
- Watch **Reviews** daily for the first two weeks

---

## PART 8 — Emergency Rollback Plan

If a P0 issue is discovered post-launch:
1. **Halt rollout** in Play Console (set staged rollout to 0%)
2. **Patch + rebuild** with versionCode 2
3. **Re-submit** to the same track
4. Communicate via in-app `tutorialState.ts` system prompt or Play Console listing update

---

*Final note: Back up your EAS keystore immediately after the first production build. Losing it means you can never update the app under the same package ID.*
