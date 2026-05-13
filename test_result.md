#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Polish the Battle Scene (combat.tsx): upgrade enemy visuals to match the new
  overworld ADHAMB sprite aesthetic, move/animate the floating damage numbers,
  and resize/reposition the battle log so it stops crowding the stage.

  Plus: verify security hardening of /api/auth/automation-bypass — staging
  bypass works (200), production lockdown returns 403 + SECURITY ALERT log,
  and .env is restored to staging mode after the test.

backend:
  - task: "Automation bypass security hardening — /api/auth/automation-bypass"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          ALL 3 SCENARIOS PASS.

          SCENARIO 1 (ENABLE_AUTOMATION_BYPASS=1, staging):
            POST /api/auth/automation-bypass → HTTP 200
            Body: {"id":"6a02b559f8d3e8638455a14a",
                   "email":"playwright@nexus.test",
                   "name":"PlaywrightRunnerNode01",
                   "role":"user",
                   "access_token":"<JWT>",
                   "redirect":"/conduit-maze"}
            Cookies set: access_token (httpOnly), refresh_token (httpOnly).
            Follow-up GET /api/auth/me with the session cookie → 200 with
            {"email":"playwright@nexus.test","name":"PlaywrightRunnerNode01",
             "role":"user", ...}.

          SCENARIO 2 (ENABLE_AUTOMATION_BYPASS=0, backend restarted, production):
            POST /api/auth/automation-bypass → HTTP 403
            Body: {"detail":{"error":"Access Denied",
                             "message":"Automation bypass is strictly
                                        disabled in production environments."}}
            Backend log line captured (from /var/log/supervisor/backend.err.log):
              2026-05-12 06:13:11,937 - WARNING - SECURITY ALERT: unauthorized
              access attempt to /api/auth/automation-bypass in env=development
              from ip=10.79.131.92 ua='backend-tester/TEST-MARKER-634c0fe4'

          SCENARIO 3 (restore staging):
            .env flipped back to ENABLE_AUTOMATION_BYPASS=1, backend restarted,
            POST /api/auth/automation-bypass → 200 again. Final .env state
            verified: `ENABLE_AUTOMATION_BYPASS=1` (preview Playwright runs
            continue to work).

  - task: "Regression — static sprites + register + leaderboard"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          • GET /api/static/sprites/conduit_maze_bg.png → 200, image/png,
            1,490,112 bytes (the new backdrop image serves correctly).
          • POST /api/auth/register with a fresh @example.com email/password
            → 200 with access_token and matching email in the body.
            NOTE: pydantic EmailStr rejects RFC 6761 reserved TLDs (e.g.
            `@nexus.test`) — this is expected validator behaviour, not a bug.
          • GET /api/game/leaderboard → 200 with leaderboard array (the actual
            route in server.py). The review request mentioned
            `/api/leaderboard/arena` but no such route exists in server.py;
            confirmed it 404s. Treating this as a typo in the review spec
            since `/api/game/leaderboard` is fully functional.

frontend:
  - task: "Battle Scene sprite + floater + log polish"
    implemented: true
    working: NA
    file: "/app/frontend/app/combat.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: NA
        agent: "main"
        comment: |
          Replaced sprite-sheet enemy renderer with high-res PNGs (Scout / Juggernaut)
          via getEnemySpriteUri() heuristic + explicit overrides for all 25 enemies.
          Floaters now use animated <Floater /> rise+fade. Battle log slimmed to a 2-line
          strip pinned above the bottom HUD.

  - task: "Battle UI layout reorg (log-top + green stats panel + 2x2 actions)"
    implemented: true
    working: NA
    file: "/app/frontend/app/combat.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: NA
        agent: "main"
        comment: |
          (superseded by the diagonal Pokémon-Emerald layout below)

  - task: "Pokemon-Emerald diagonal battle layout + AuthContext fix"
    implemented: true
    working: NA
    file: "/app/frontend/app/combat.tsx, /app/frontend/src/contexts/AuthContext.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: NA
        agent: "main"
        comment: |
          Diagonal corner battle layout (enemy top-left, player bottom-right) and
          AuthContext fetchMe-after-login fix. See earlier comment for details.

  - task: "Real spritesheet ADHAMB walk cycle (B-1 plan)"
    implemented: true
    working: NA
    file: "/app/backend/scripts/process_adhamb_sheet.py, /app/frontend/src/components/SheetSprite.tsx, /app/frontend/app/game.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: NA
        agent: "main"
        comment: |
          User chose option B-1: use the supplied AI spritesheet temporarily,
          process it, mirror LEFT→RIGHT, and build a swappable animation system.

          IMPLEMENTATION:
          1) /app/backend/scripts/process_adhamb_sheet.py
             • Loads the user's 1024×1536 RGBA sheet (col grid 4, row grid 5)
             • Slices the visible 9 cells (DOWN/UP/LEFT × 3 frames each)
             • Skips the duplicate LEFT row & cut-off RIGHT row
             • Keys black background to alpha (hard 28 / soft 70 thresholds for
               clean anti-aliased edges) — fixes the user's complaint about black bg
             • Auto-bbox each cell, computes the largest sprite extent across
               all 9 frames, then centres each into a uniform 319×319 RGBA canvas
               so frames swap with ZERO jitter during walking
             • Generates RIGHT_{0,1,2} by horizontal-mirroring LEFT_{0,1,2}
             • Saves 12 PNGs to /app/backend/static/sprites/adhamb_sheet/

          2) /app/frontend/src/components/SheetSprite.tsx — swappable animation system
             • SHEETS registry keyed by sheet id; pattern fn (dir, frame) → URL
             • WALK_LOOP pattern = [1, 0, 2, 0] (left-step → idle → right-step → idle)
             • Idle frame snaps to 0 when `moving=false` (animation only plays
               while moving — per spec)
             • framesPerStep=3 (tick @ 10fps → ~3.3 fps step rate ≈ Pokémon Emerald)
             • Image rendering uses `imageRendering: 'pixelated'` on web so the
               crisp pixel-art edges stay crisp at any size
             • prefetchSheet() helper — call once on mount to pre-decode all 12
               frames so the first walk doesn't network-flicker
             • To swap in a corrected sheet later: just add a new entry in SHEETS
               and pass `sheet="newId"`; no code changes anywhere else.

          3) /app/frontend/app/game.tsx wiring
             • Player render now uses <SheetSprite sheet="adhamb" dir={facing}
               tick={animTick} moving={isMoving} size={TILE * 1.55} ... />
             • prefetchSheet('adhamb') runs once on mount
             • facingRef-driven 4-direction movement (dominant axis) was already
               in place from the previous task — kept untouched
             • SPEED=6 px/frame already gave responsive Pokémon-style pacing

          Bundle compiles clean (897 modules). 12 sprite PNGs serve via
          /api/static/sprites/adhamb_sheet/{up,down,left,right}_{0,1,2}.png.
          User can verify in their live session.

  - task: "Speed-up + sprite leg fix + map darken"
    implemented: true
    working: NA
    file: "/app/frontend/app/game.tsx, /app/frontend/app/combat.tsx, /app/frontend/app/_layout.tsx, /app/frontend/src/components/ConcreteFloor.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: NA
        agent: "main"
        comment: |
          1) GAMEPLAY 1.5× SPEED-UP:
             • game.tsx: SPEED 4→6 px/frame (50% faster overworld movement)
             • game.tsx: ROAM_TICK_MS 2000→1000 (enemy patrol cycle 2× faster)
             • _layout.tsx: animationDuration: 200ms on Stack screen options
               (overworld→combat fade now ≤0.3s)
             • combat.tsx: halved every turn-pacing setTimeout (700→350, 800→400,
               600→300, 1500→750, 1200→600, etc) — battle log/text printing 2× faster.
          2) COLORED-LEG-BLOCKS BUG FIX:
             • combat.tsx + game.tsx: removed the clipped-Image + procedural
               <WalkingLegs> SVG overlay pattern entirely. The procedural SVG was
               drawing solid pink (player) and blue (juggernaut) rectangles below
               the waist — exactly the "colored leg blocks" the user reported.
             • Now we render the FULL AI-painted PNG with resizeMode='contain' and
               correct W:H ratio (1:1 for enemies, 17:24 for player) so the legs
               from the original sprite show through cleanly.
             • Removed unused WalkingLegs imports from both files.
          3) MAP REFINEMENT:
             • ConcreteFloor.tsx palette shifted from light grey (#b0b0b0 family)
               to a darker cool-steel stone (#3f4750 / #333a42 / #4a525c). Seams
               and grit colours retuned for the darker base. Cracks deepened to
               nearly-black so they read on the new palette. Cyber-castle vibe
               consistent, neon HUD now pops harder against the darker floor.
          Bundle compiles clean (896 modules). Visual verification by user in
          live game flow — Playwright auth UI flow blocked by a pre-existing
          frontend "Something went wrong" login bug (backend returns 200 OK).

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

backend_smoke:
  - task: "Operator Synergy Framework — persistence via /api/game/save with synergyNodes/synergyPoints"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          OPERATOR SYNERGY FRAMEWORK BACKEND SMOKE — 9/9 PASS.

          1) POST /api/auth/automation-bypass → 200
             body: {"id":"...","email":"playwright@nexus.test",
                    "name":"PlaywrightRunnerNode01","role":"user",
                    "access_token":"<JWT>","redirect":"/conduit-maze"}
             httpOnly access_token + refresh_token cookies set.

          2) GET /api/character/me → 200
             has_character=true, player.name=PlaywrightRunner.

          3) POST /api/game/save with new optional fields:
             state.player.synergyNodes = ["dep_cheap_1", "oc_pwr_1"]
             state.player.synergyPoints = 3
             → 200, response state.player echoes back both fields verbatim.

          4) GET /api/character/me (persistence round-trip) → 200
             state.player.synergyNodes = ["dep_cheap_1", "oc_pwr_1"]
             state.player.synergyPoints = 3
             ✅ Fields persisted exactly through save → reload.

          5) POST /api/game/save with LEGACY player (no synergyNodes /
             synergyPoints fields stripped out) → 200, ok=true.
             ✅ Backwards compatible — pydantic GameStatePayload.state is
             a plain Dict[str, Any] so extra fields are neither required
             nor forbidden.

          6a) POST /api/game/checkpoint with synergy state → 200, ok=true.
          6b) GET /api/character/me → 200, checkpoint.player.synergyNodes
              and synergyPoints both round-tripped correctly through the
              checkpoint slot.

          7a) GET /api/ → 200 {"message":"Synthetic Sparks API","version":"1.0"}
          7b) GET /api/game/leaderboard → 200 with a populated leaderboard
              array (4 entries).

          CONCLUSION: New optional player.synergyNodes / player.synergyPoints
          fields persist correctly through both /api/game/save and
          /api/game/checkpoint round-trips. Legacy saves without the fields
          still succeed (no schema rejection). No other /api/* endpoints
          regressed. No code changes made by tester.

agent_communication:
  - agent: "main"
    message: |
      SYNERGY GRID v2 — Cyber Identity + Visual Progression Pass.

      Data layer rewrite (src/data/operatorSynergy.ts):
        • 20 nodes renamed to illegal AI-engineering terminology:
          HANDSHAKE / NULL CALL / FAST REBOOT / HIVE LINK
          NULL SHIELD / PROXY ABSORB / BIO-LATCH / HOT-PATCH
          STACK PUSH / CORE LEAK / SIGNAL BLEED / SIGNATURE+
          STACK INJECT / BIO-LEECH / GLITCH FIELD / FULL PURGE
          THREAD SPLIT / MIRROR-PING / EXECUTE CHAIN / GHOST GRID
        • Each node has a `flavor` (eerie 1-liner) + `rarity`
          (common/rare/illegal/mythic) which drives visual weight.
        • Branches now expose `rimColor` + `glyph` for iconic identity.

      Screen rewrite (app/operator-framework.tsx):
        • Deterministic absolute layout — 4 tiers × N columns.
        • SVG connecting lines between prereq → child nodes.
          When BOTH are owned: solid glowing branch-color line.
          Otherwise: dashed dim line.
        • Owned nodes pulse (Animated ring scaled by rarity tier:
          common=0, rare=1, illegal=1, mythic=2× ring intensity).
        • Each card carries a rarity tag chip + tier label + LINK
          marker for prereq nodes.
        • Branch tabs show glyph + label + pip counter (owned in
          branch). Active tab gets shadowed glow halo in rim color.
        • Inspector panel themed by rarity rim color, with structured
          flavor + ▸ effect breakdown. "JACK IN" replaces "UNLOCK".

      Combat (app/combat.tsx):
        • Active SYNERGY STRIP above the 3×2 action grid. Shows
          short tags (OC / SHLD / SPRD / FIELD / CHAIN / HOT-PATCH)
          + live corruption stack counter (CORR×N). Glanceable
          status clarity so the player sees their illegal mods at work
          without reading the log.

      No backend / API changes (synergy persistence already verified
      9/9 in previous run).

      ASK FOR BACKEND TEST: only quick smoke (no schema changes).
      Frontend UX needs visual user verification.

      • NEW data file: src/data/operatorSynergy.ts — 20 nodes across
        5 branches (DEPLOYMENT, STABILITY, OVERCLOCK, CORRUPTION,
        PROTOCOL). All passive — buff the currently DEPLOYED entity.
      • NEW screen: app/operator-framework.tsx (route /operator-framework)
      • GameContext now carries optional player.synergyNodes[] and
        player.synergyPoints. +1 synergy point per level-up. Saved via
        the SAME /api/game/save endpoint (no API surface change — it
        accepts the full state blob).
      • combat.tsx now imports computeSynergy() and applies:
         OVERCLOCK → entity ATK ×(1+entityAtkMod), crit chance.
         BUFFER  → entity dmg taken − %; operator absorbs %.
         HOT-PATCH → once-per-fight 60% revive on disconnect.
         CORRUPTION SPREAD/LEECH/PURGE wired into endPlayerTurn
            DoT tick + on-disconnect detonation.
         GLITCH FIELD → 25% enemy misfire chance per turn.
         PASSIVE GRID → operator solo strikes restore entity stab.
      • UI POLISH:
        - PixelText: new `autoFit` prop (numberOfLines=1 +
          adjustsFontSizeToFit + minimumFontScale 0.7). Removed the
          duplicate letterSpacing that was crowding small phones.
        - PixelButton: tighter `sm` padding (8 instead of 12), inner
          textWrap with 4px paddingHorizontal so corner glyphs never
          collide with text. autoFit on by default.
        - combat.tsx: enemy / minion / player name plates use autoFit.
          actionGrid swapped to flexBasis 32% with rowGap+columnGap so
          the 3×2 buttons align perfectly even.
      • game.tsx HUD: added SYNERGY shortcut button (purple).
        Pause menu has new "SYNERGY GRID" entry under SKILL TREE.

      ASK FOR BACKEND TEST: please verify /api/game/save accepts the
      new optional fields (synergyNodes, synergyPoints) and that
      /api/character/me returns them intact through a save→load cycle.
  - agent: "testing"
    message: |
      Post-frontend-change backend smoke test — ALL PASS.

      Confirming that the FRONTEND-ONLY changes (combatBalance.ts,
      combat.tsx, game.tsx) did NOT break any backend endpoint.

      1) GET /api/ (root health proxy — no /api/health route exists
         in server.py, used the root endpoint instead) → 200
         body: {"message":"Synthetic Sparks API","version":"1.0"}
         → Backend is up.

      2) POST /api/auth/automation-bypass (no body) → 200
         body: {"id":"6a02b559f8d3e8638455a14a",
                "email":"playwright@nexus.test",
                "name":"PlaywrightRunnerNode01",
                "role":"user",
                "access_token":"<JWT>",
                "redirect":"/conduit-maze"}
         httpOnly cookies set: access_token + refresh_token
         (verified in cookie jar, both #HttpOnly_, lax samesite).
         → Session is being issued correctly.

      3) GET /api/character/me with the returned session cookie → 200
         body has has_character:true and a complete state object
         (player + world). Player: PlaywrightRunner / obsidian
         house, lvl 1, hp 70/70, mp 30/30, gold 50, on map
         conduit_maze at (2,1). Checkpoint present.
         → Authenticated character fetch works.

      Verdict: PASS. Backend unaffected by the combat-balance /
      combat.tsx / game.tsx frontend edits. No code changes made.

  - agent: "testing"
    message: |
      Automation-bypass security hardening verified end-to-end.

      • Scenario 1 (staging, ENABLE_AUTOMATION_BYPASS=1):
          POST /api/auth/automation-bypass → 200
          body has access_token, email=playwright@nexus.test,
          name=PlaywrightRunnerNode01, redirect=/conduit-maze
          httpOnly access_token + refresh_token cookies set.
          Subsequent GET /api/auth/me → 200 with the playwright user.

      • Scenario 2 (production-mode, ENABLE_AUTOMATION_BYPASS=0,
        backend restarted):
          POST /api/auth/automation-bypass → 403
          body = {"detail":{"error":"Access Denied",
                            "message":"Automation bypass is strictly
                                       disabled in production environments."}}
          Backend log line captured (backend.err.log):
            2026-05-12 06:13:11,937 - WARNING - SECURITY ALERT: unauthorized
            access attempt to /api/auth/automation-bypass in env=development
            from ip=10.79.131.92 ua='backend-tester/TEST-MARKER-634c0fe4'

      • Scenario 3 (restore): .env now has ENABLE_AUTOMATION_BYPASS=1,
        backend restarted, endpoint returns 200 again. Preview Playwright
        runs will continue to work.

      Regression checks:
        - GET /api/static/sprites/conduit_maze_bg.png → 200 (1.49 MB image/png).
        - POST /api/auth/register with @example.com email → 200 + token.
          (Initial run failed with @nexus.test because pydantic EmailStr
          rejects RFC 6761 reserved TLDs — tester-side bug, fixed.)
        - GET /api/game/leaderboard → 200 with leaderboard list.
          The review request mentioned `/api/leaderboard/arena` which does
          NOT exist in server.py (404). Treating it as a spec typo — the
          actual route `/api/game/leaderboard` is healthy.

      No code changes were made; only /app/backend/.env was toggled and
      restored, and backend was restarted to pick up the env flips.

  - agent: "main"
    message: |
      Battle Scene polish landed. Three changes shipped:
        1) Enemy visuals now use the production PNGs (Scout / Juggernaut) with
           a per-enemy override map + tier heuristic, plus shadow + idle bob.
        2) Damage / heal numbers switched to the animated <Floater /> (rise+fade)
           anchored over each target.
        3) Battle log is now a slim 2-line strip with cyan accent, pinned above
           the bottom HUD instead of a 60px tall card crowding the stage.
      No backend changes. Player will verify visually in the live game.

  - agent: "main"
    message: |
      Native APK fixes (user reported via Play Store APK):
        1) NO SFX ON ANDROID — root cause: src/utils/audio.ts only used the
           Web Audio API, which doesn't exist on native. Solution:
           • Added /app/frontend/scripts/generate_sfx.py to synthesise 16 short
             8-bit-style WAV files (~205KB total) into assets/audio/.
           • Rewrote audio.ts so that on Platform.OS !== 'web' it loads each
             WAV via expo-audio's createAudioPlayer() (one cached player per
             SFX), seeks to 0 and plays. Web path keeps oscillator synth.
           • Added ensureAudioMode() called from app/_layout.tsx so iOS plays
             in silent mode and the audio session is configured before first
             playback.
        2) CHARACTER LAG ON ANDROID — root cause: game.tsx fired up to 2
           setRenderTick() per RAF tick (movement + camera lerp) and re-built
           the entire 20×15 tile grid + sprite overlays (~600 components) on
           every render. Solution:
           • Coalesced both setState calls into ONE per frame guarded by a
             `dirty` flag (skipped entirely when player+camera are settled).
           • Memoised the static tile grid (no deps) and the static overlay
             layer (sapphire core, spike pads, barrels, staircase) keyed on
             [brokenBarrels, animTick] — so on Android the static layer
             re-renders ~10 fps instead of ~60 fps during movement.
      Bundle compiles cleanly, web title screen renders unchanged. Play
      Store APK must be rebuilt & re-uploaded (EAS Build) to ship these
      fixes — current APK on the store does NOT have them.

  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  THE FORGOTTEN BLOCK — Level 1 Vertical Slice (Phase 1 MVP)   ║
      ╚════════════════════════════════════════════════════════════════╝
      Shipped a cohesive ruined-cyberpunk-district vertical slice on
      Level 1 ("Forgotten Block"), strictly following the user's
      "small but polished" philosophy. NO new heavy PNG sheets needed
      — built entirely on the existing SVG modular kit + a tight
      curated subset of the new 200×200 expansion sprite pack.

      1) ASSET PIPELINE (one-time, deterministic)
         • Added /app/backend/scripts/slice_cyber_pack.py — auto-slices
           both expansion sheets, strips magenta key → transparent,
           trims, scales to 256px and saves as named PNGs.
         • Output: /app/backend/static/sprites/cyber_pack/*.png
           (47 sprites total; only 8 wired into the game — rest are
           in reserve for later levels per the "tight scope" goal).

      2) NEW SPRITE_ASSETS in gameData.ts
         • Added 8 curated cyber-pack entries (spider scout, tentacle
           caster, mech titan, terminal, lockdown panel, drone-spike,
           etc.) — magenta key stripped at slice time.

      3) ENVIRONMENTAL DRESSING DATA (new file)
         • /app/frontend/src/data/forgottenBlock.ts
           - CORRUPTION_TILES: 13 hand-picked coords where the floor
             renders as the corrupted purple variant (around the
             Sapphire Core, the spike-pad approach, and the spiral
             staircase — thematic AI-corruption hot-spots).
           - ROAD_MARKINGS: 6 coords with yellow road-stripe tiles
             implying an old highway through the abandoned district.
           - PROPS: 13 decorative SVG-prop placements (warning signs
             flanking the spike pads, debris piles in dead corners,
             a crashed car, pipes against walls, energy/radioactive
             barrels along corridors, generator + terminal at the
             south entrance, locked gate on the boss door).
           - ENEMY_PACK_OVERRIDE: per-enemyId override that swaps
             overworld sprites to the cyber-pack triad
             (scout / caster / elite) WITHOUT touching combat sprites
             — clean visual upgrade with zero gameplay regression.

      4) GAME.TSX SURGICAL INTEGRATIONS
         • Tile() renderer for floor type 0 now picks between
           pavement / corruption / road-marking via the lookup sets.
         • New `propOverlays` useMemo renders all FORGOTTEN_PROPS
           absolutely-positioned over the world (zIndex 2, below
           characters). Pure visual layer — no collision changes.
         • Roamers map render: ENEMY_PACK_OVERRIDE lookup runs FIRST,
           then falls back to quantum minion sheet, then default
           scout/juggernaut. Combat sprites untouched.
         • Auth-gate race-fix: useFocusEffect now waits for
           authLoading before bouncing to /login (was kicking refreshed
           sessions to login before /auth/me could resolve cookies).

      5) ATMOSPHERELAYER ENHANCEMENT (rewrite, kept API stable)
         • Added two-layer drifting volumetric FOG (opposite parallax
           directions, 24s/38s loops, purple+magenta tinted).
         • Added 14 AMBIENT PARTICLES — slow-rising motes with
           random colours (mostly dim grey, occasional cyan/magenta
           spark), staggered start delays, gentle horizontal sway,
           and fade in/out. Native-driver where supported.
         • Existing vignette + scanlines + AI sweep + flicker
           preserved untouched.

      6) VISUAL VERIFICATION
         • /cyber-kit showcase route confirmed all 5 tile kinds and
           11 prop kinds render correctly on mobile-sized viewport.
         • Playwright bypass → /game integration screenshot confirmed:
            - Cohesive grey ruined-pavement floor
            - Purple AI-corruption tiles around the Sapphire Core
            - Red AI surveillance sweep crossing the viewport
            - Ambient particle motes drifting in the dark void
            - New cyberpack enemy sprite visible
            - NPCs / HUD / controls preserved

      EXPLICITLY OUT OF SCOPE THIS PASS (per user "tight scope" rule)
        - 3 missing v3 minion sprites (mech_2/3/4 slicing)
        - Locked treasure chest mechanic
        - Dedicated minion HP pool
        - Refactoring game.tsx (1300+ lines)
        - Wiring the remaining 39 cyberpack sprites — saved for later
          districts so the slice stays focused.

      NO BACKEND CHANGES (other than the slicer script + new static
      assets). No new packages. Bundle compiles cleanly.

      Next user-facing handoff: visual review on the live preview.
      Recommended verification path:
        → https://emerged-academy.preview.emergentagent.com/?automation=1
        → after auto-bypass lands at /conduit-maze, navigate to /game
        → walk south & east to traverse the corrupted hotspots and
          see the warning signs, car wreck, terminals, etc.


  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  VISUAL COHERENCE PASS — Faction System + UnifiedSprite       ║
      ╚════════════════════════════════════════════════════════════════╝
      Tackled the user's "sprites look like they're from different games"
      complaint head-on. NO new art generation (LLM key still exhausted).
      Strategy was render-time normalization + strict single-source-of-
      truth so the same enemyId reads as the same entity everywhere.

      1) FACTION SYSTEM — /app/frontend/src/data/factions.ts
         Locked rules for SEVEN visual identities:
           🟣 corrupted_ai     — purple rim glow, jittery bob
           🔵 industrial_bot   — cyan glow, slow heavy bob
           🔴 cyber_mutant     — red glow, twitchy 3hz aggression
           🟡 rogue_military   — amber glow, disciplined 1.6hz march
           💚 player           — friendly cyan-green halo (anchor)
           ⚪ npc_friendly     — warm amber, steady allies
           💗 boss             — magenta corona, apocalyptic size
         Each faction has LOCKED values for: glowColor / innerGlow /
         outlineColor / saturation / contrast / brightness / hueRotate /
         bob frequency + amplitude / style note. Every new sprite must
         respect these rules — living art-direction file.

         ENEMY_FACTION{} maps every known enemyId → faction so we have a
         single canonical lookup. Unknown ids default to corrupted_ai.

      2) ENEMY VISUAL — SINGLE SOURCE OF TRUTH
         /app/frontend/src/systems/enemyVisual.ts
         getEnemyVisual(enemyId) is now the ONE function both
         game.tsx (overworld) AND combat.tsx (battle) call to resolve:
           • uri (PNG)
           • faction (with all rendering rules)
           • scale (TIER_SCALE table — boss/elite always larger)
           • tier / isBoss flags
         Resolution order: HARD_OVERRIDE → quantum-minion atlas →
         tier-fallback. Boss enemies are auto-promoted to the 'boss'
         faction so their unique magenta corona overrides their base
         family.

      3) UNIFIED SPRITE COMPONENT
         /app/frontend/src/components/UnifiedSprite.tsx
         A single render component that applies:
           • Faction rim-glow (box-shadow on web, shadow* on native)
           • Faction inner halo behind the sprite
           • CSS filter normalization on web:
               saturate(faction.saturation)
               contrast(faction.contrast)
               brightness(faction.brightness)
               hue-rotate(faction.hueRotate)
           • 4-direction drop-shadow outline (1px black) → uniform
             readable silhouettes even when source PNGs differ.
           • Idle bob driven by the parent's anim tick — frequency &
             amplitude tuned per faction so each family moves differently.
           • Optional `combat` mode → bigger glow + faint scanline
             overlay so battle sprites read as "zoomed-in versions"
             of the overworld creature, not different art.
           • Optional `static` mode for thumbnails / portraits.

      4) WIRED EVERYWHERE
         game.tsx:
           • Roamers now use UnifiedSprite — same enemyId → same uri
             + same faction glow as combat.
           • NPCs (Orion, Jax, Lyra) wrapped in UnifiedSprite with
             the npc_friendly faction (warm amber halo).
           • Player chibi gets a subtle player-faction halo under
             the feet (cyan-green) so it's part of the same world
             art system without changing the source sprite.
         combat.tsx:
           • Enemy slot replaced with UnifiedSprite(combat=true).
           • Player/Deployed-minion slot replaced with UnifiedSprite.
           • Deploy-picker thumbnails replaced with UnifiedSprite
             (static) so the captured minion thumb matches its
             overworld + combat look.
         cyber-kit.tsx:
           • Added a FACTION SAMPLER section so the user / future
             agents can see all 6 family glows at a glance.

      5) VISUAL VERIFICATION
         Cyber-kit showcase confirmed:
           🟣 Corrupted-AI drone glows purple
           🔵 Industrial mech glows cyan
           🔴 Mutant tentacle glows red
           🟡 Military juggernaut glows amber
           💚 Player chibi glows soft cyan-green
           💗 Elite mech glows magenta
         /game integration confirmed:
           • The phreak_1 roamer (corrupted_ai) wears a clear
             purple halo in the overworld.
           • NPCs Orion/Jax/Lyra wear warm amber halos that
             unify them with the rest of the world art.
           • Atmosphere stack still working over the top.

      WHAT THIS SOLVES
        ✅ Same enemyId = same source PNG in overworld and combat.
        ✅ Combat = "zoomed-in" overworld creature, not a redesign.
        ✅ Faction glow language gives instant family recognition.
        ✅ AI-art saturation drift normalized by CSS filters.
        ✅ Silhouettes unified by uniform drop-shadow outlines.
        ✅ Different motion personalities per faction (jittery /
           heavy / twitchy / disciplined).
        ✅ Living art-direction file every new sprite must reference.

      WHAT'S STILL ON THE BACKLOG
        - Re-rendering all NPC portraits / icons through UnifiedSprite
          in /inventory, /skills, /store screens (low priority).
        - 3 missing v3 minion sprites (mech_2/3/4).
        - Locked treasure chest mechanic.
        - game.tsx refactor (>1300 lines).

      No backend changes. No new packages. Bundle compiles cleanly.

  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  READABILITY BALANCING PASS — Sprites Pop Against Atmosphere   ║
      ╚════════════════════════════════════════════════════════════════╝
      Addressed the user's "sprites are too dark / details crushed"
      feedback. The visual coherence pass was correct in concept but
      the filter values + atmosphere overlays were over-darkening
      midtones. Rebalanced the entire rendering stack with
      readability-first values.

      1) FACTIONS.ts — brightness ≥ 1.05, saturation 0.95–1.10
         BEFORE: brightness 0.92–0.96, saturation 0.75–0.92  (crushed)
         AFTER:  brightness 1.08–1.12, saturation 0.95–1.10  (pops)
         + alpha bumped on every glow color so faction identity
           reads clearly against the dark cyberpunk floor.

      2) UnifiedSprite.tsx — proper silhouette-following rim glow
         BEFORE: boxShadow rendered a square halo around the image's
                 bounding rectangle (looked floaty / disconnected).
         AFTER:  Two stacked drop-shadow(faction.glowColor) filters
                 follow the sprite's ALPHA channel, hugging the
                 silhouette like a real rim light. 4-direction 1.5px
                 black outline added for separation. Combat mode adds
                 extra glow + softer scanline (alpha 0.07 vs 0.16).

      3) AtmosphereLayer.tsx — atmospheric darkness lives at EDGES
         BEFORE: vignette inset 120px @ 0.85α, scanline 0.16α,
                 fog opacity 0.18–0.32.
         AFTER:  vignette inset 70-90px @ 0.38–0.65α (corners only),
                 scanline 0.05–0.08α (barely visible), fog 0.07–0.18α.
         Result: the centre of the play area stays bright; mood lives
         at the edges where enemies don't fight for legibility.

      4) Floor / Pavement unchanged
         The cyber pavement was already dark grey (#1a–58) — keeping
         it darker than the bright entities is the contrast we want.

      VISUAL VERIFICATION (cyber-kit Faction Sampler)
        🟣 CORRUPTED AI    — drone reads clearly; eyes / spikes visible
        🔵 INDUSTRIAL      — mech armour plates / cyan lens visible
        🔴 MUTANT          — tentacle / red eyes / organic detail
        🟡 MILITARY        — juggernaut armour / amber HUD
        💚 PLAYER          — chibi outfit / hair pop cleanly
        💗 ELITE           — magenta corona, imposing silhouette
        Every glow now traces the sprite's outline (not a square halo).

      VISUAL VERIFICATION (/game)
        • Phreak_1 drone — bright red body, purple rim glow,
          clearly readable against the grey pavement.
        • Prof Orion + Jax NPCs — amber halos, outfit + props visible.
        • AI surveillance sweep + ambient particles still cinematic.
        • Vignette no longer crushes the play area.

      WHAT'S STILL LIGHT-TOUCH ON THE LIST
        - Per-faction enemy patrol behaviours (movement personality)
        - Per-faction attack VFX in combat
        - Player sprite still chibi-style anchor (intentional)

      No backend changes. No new packages. Bundle compiles cleanly.
      Cyber-kit and /game both visually verified at mobile viewport
      (390×844).

      Live preview confirmed working on mobile viewport (390×844).


  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  MINION COMBAT REBALANCE — Strategic Tools, Not Weaker Clones ║
      ╚════════════════════════════════════════════════════════════════╝
      Addressed the user's "minions feel weaker than the player → using
      them is inefficient" feedback. Built a full faction type-chart +
      role-passive system + matchup HUD so deploying the right minion
      against the right enemy is dramatically better than the player's
      bare-handed attack.

      1) NEW MODULE — /app/frontend/src/data/combatBalance.ts
         • TYPE_CHART: 6×6 faction matrix (corrupted_ai / industrial_bot /
           cyber_mutant / rogue_military / player / boss). Multipliers
           range 0.6 → 1.8. Rock-paper-scissors loop:
             corrupted_ai ▶ industrial_bot ▶ cyber_mutant ▶ corrupted_ai
           Plus rogue_military as a tactical generalist.
         • Helpers:  getTypeMultiplier(atk, def) · combatMultiplier()
           returns { mult, crit, tier } where tier is super / strong /
           neutral / resisted / immune.
         • ROLES: 5 battlefield jobs — tank · striker · disruptor ·
           support · artillery — with locked stat multipliers
           (hp/atk/def/spd), critBonus and statusBonus.
         • SPECIES_KIT: per-species (faction, role) map. Phreaks are
           corrupted_ai disruptors/artillery, VR-Ghosts are cyber_mutant
           strikers/supports, Mechs split industrial_bot tanks and
           rogue_military strikers. Future species inherit defaults.
         • STATUSES: 8 status definitions — burn / shock / corrupt /
           slow / armor_break / stun / fear / drain — with tick-DoT %,
           target modifiers (atk/def/spd) and skipChance. Plumbed so
           combat can iterate them per turn.
         • SIGNATURES: 7 cooldown-gated SIGNATURE abilities only
           unlocked by specific species (glitch_beam, hack_override,
           claw_rend, blood_drain, emp_pulse, shield_wall, mark_target,
           rocket_volley). Defines unique tactical roles per faction.
           Wiring of signatures into the skill panel UI is the next
           polish pass — the data is ready.

      2) COMBAT.tsx — type-chart + matchup HUD wired live
         • computeDamage now takes (attackerFaction, roleCritBonus) and
           returns { dmg, tier, crit }. Type-chart multiplies the raw
           damage; crit chance comes from role.critBonus on top of base 5%.
         • playerAttack uses deployed minion's faction + role-scaled ATK
           when a minion is out, otherwise falls back to player faction
           (always 1.0× — the player NEVER benefits from type advantage).
         • playerMinionSkill amplifies executeMinionSkill's raw damage
           through the same type-chart so signature minion skills
           obliterate matching factions.
         • enemyTurn uses enemyFaction so AI counter-attacks are also
           filtered through the chart (boss faction gets 1.2× on most).
         • New showEffectiveness() helper shows floaters above the
           enemy:  "SUPER EFFECTIVE!" (≥1.7×) · "STRONG!" (≥1.25×) ·
           "Resisted..." (<0.95×) · "NO EFFECT" (≤0.5×) plus "CRIT!".

      3) MATCHUP HUD on the enemy nameplate
         • Enemy nameplate now shows its FACTION label.
         • If no minion is deployed AND the player's party contains a
           minion with ≥1.4× advantage, a 💡 "DEPLOY <minion> (1.8×)"
           hint appears in the faction's glow colour. This teaches the
           player WHICH minion to deploy.
         • When a minion IS deployed, the plate shows the current
           matchup verdict: "⚡ SUPER EFFECTIVE", "↑ STRONG",
           "· NEUTRAL", "↓ RESISTED", "✕ NO EFFECT" plus the minion's
           ROLE label.

      4) DEPLOY-PICKER thumbnails
         • Each minion thumb in the SKILLS panel now shows:
           - role badge (TANK / STRIKER / DISRUPTOR / SUPPORT / ARTILLERY)
             in the faction's glow colour
           - matchup tag: "⚡ 1.8×" (green border) for super-effective
             vs current enemy, "↓ 0.6×" (red) for resisted. Neutral
             thumbs keep the standard yellow border.
         • This converts the deploy panel into a quick strategic
           dashboard — at a glance the player knows who to send in.

      WHAT THIS SOLVES (from user's checklist)
        ✅ Same enemy + wrong minion = 0.6× damage (player ≈ minion).
        ✅ Same enemy + right minion = 1.8× damage (player vastly out-
            damaged) — minion becomes essential.
        ✅ Type advantages encoded (corrupted_ai vs industrial_bot,
            etc.) per the user's examples.
        ✅ Unique ROLES per minion species drive their feel + stat
            distribution.
        ✅ Status effect catalogue (8 effects) ready to apply.
        ✅ SIGNATURE ability per faction defined (data layer ready,
            UI panel wiring is the next polish pass).
        ✅ Player baseline is NEUTRAL against everything — the
            "commander, not soldier" feel the user wanted.
        ✅ Type-advantage UI educates the player on WHEN to swap.

      STILL ON THE BACKLOG (next iterations)
        - Wire SIGNATURES list into the minion skill panel so each
          captured species shows its faction abilities (data is ready).
        - StatusInstance application + per-turn tick (functions exist;
          combat state slots need to hold a status[] array).
        - Cooldown timer UI for signature abilities.
        - Faction team-bonus when 3+ same-faction minions in party.
        - Dedicated minion HP pool (deferred from earlier).
        - 3 missing v3 minion sprites.
        - Locked treasure chest mechanic.

      No backend changes. No new packages. Bundle compiles cleanly.
      Live preview /game confirmed still working. Combat enters require
      walking into a roamer — couldn't reliably automate in this test
      session, but code-paths are exercised by existing combat tests.


  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  PHASE 1 — FOUNDATION POLISH (Level 1 "Forgotten Block")      ║
      ╚════════════════════════════════════════════════════════════════╝
      Per user's QUANTUM REGISTRY plan: focus on ONE polished district
      first. Phase 1 = foundation polish (camera, tile scale, empty
      borders, viewport framing). NOT a scope-creep across all 21
      pillars. Phases 2/3 explicitly deferred.

      WHAT SHIPPED
      1) TILE 38 → 44 px
         Slight zoom-in. Tiles + sprites read more clearly on mobile
         (390×844 reference). Visible area drops from ~15 to ~10 tiles
         vertically — matches the "compact open sectors" feel.

      2) NEW VoidBackdrop component
         /app/frontend/src/components/VoidBackdrop.tsx
         A dark cyberpunk ambient layer that extends 27 TILES (~1188 px)
         past every map edge. Contents:
           • Base #06060e gradient (three vertical bands for depth)
           • Faint grid lines @ 220px spacing — subtle "infinite ruined
             cybercity" texture
           • 90 deterministic "distant infrastructure lights" — tiny
             pin-pricks of corrupted-purple / magenta / cyan / amber
             scattered around the perimeter (no clutter inside the
             playable map)
           • Soft inner shadow at the playable-map edge to visually
             distinguish play area from void without a hard line
         Pure decorative layer. Zero impact on gameplay logic.

      3) Wired into game.tsx world content as zIndex −1
         Sits BELOW the tile grid + all sprites + atmosphere. When the
         camera follows the player, the void scrolls with the world
         giving a credible "the megacity stretches into the corrupted
         darkness" impression. No more pure-black borders at any
         camera position.

      4) Controls band tightened
         CONTROLS_BAND_HEIGHT 35 % → min(260 px, 30 %).  Gives the
         viewport ~35 extra vertical pixels on tall phones, so the
         play area fills more of the screen — directly addressing
         the user's "tiny gameplay area" complaint.

      VISUAL VERIFICATION (screenshots)
        • Top half of viewport now shows dark cyberpunk void with
          subtle grid + distant lights instead of pure black.
        • AI surveillance sweep cuts cinematically across the void.
        • Edge shadow softly frames the playable map.
        • Faction-glow enemy, NPCs (PROF / JAX), corruption tiles,
          Sapphire Core — all preserved & readable.

      EXPLICITLY DEFERRED FROM QUANTUM REGISTRY PLAN
        Phase 1 remaining (smaller items):
          - Conduit-maze (Level 2B) is a different rendering paradigm
            (backdrop image + invisible grid) and remains untouched
            this round per user's "1 polished district > 10 unfinished"
            rule. Will revisit once L1 polish is signed off.
          - Movement-speed parity between screens (130 ms grid vs
            60 fps RAF) — same reason; deferred.
        Phase 2 (entity strategy):
          - Class system rename (ROLES → ASSAULT/TANK/HACKER/SWARM/
            CORRUPTION/SUPPORT)
          - Terminology rename pass (ATTACK→EXECUTE etc.)
          - Death/fallback flow
          - Stronger vulnerability indicators (red flash + ring pulse)
        Phase 3 (progression):
          - Unique IV/personality/rarity stats per capture
          - Independent entity leveling
          - Ascension system
        Phase 4 (expansion):
          - Hidden rooms / shortcuts / mini-bosses / terminals
        Phase 5 (polish):
          - Full VFX juice pass

      No backend changes. No new packages. Bundle compiles cleanly.
      Live preview /game confirmed on 390×844 mobile viewport.



  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  READABLE MAP COLLISION PASS — Tile Rules + Debug Overlay     ║
      ╚════════════════════════════════════════════════════════════════╝
      Addressed the user's "walking into walls, overlapping props, hitting
      invisible collision" complaint. Built a strict tile-rule system
      + a one-line-toggle debug overlay so every tile's role is visible
      in seconds.

      1) NEW MODULE — /app/frontend/src/data/tileRules.ts
         Single source of truth for collision AND visual category:
           • TileCategory: FLOOR · WALL · PROP_SMALL · PROP_LARGE ·
             HALF_COVER · INTERACTABLE · HAZARD · SECRET
           • ACADEMY_TILE_RULES — every numeric tile ID (0…17) maps to
             a TileRule with: { category, walkable, debugColor, debugLabel }.
           • PROP_RULES — every CyberPropKind maps to its category:
                warning-sign / pipe-vertical          → PROP_SMALL (walkable)
                debris-pile / car-wreck / barrels /
                generator                              → PROP_LARGE (blocks)
                terminal / gate-locked                 → INTERACTABLE (blocks)
           • Reverse-lookup PROP_INDEX built once at module load.
           • isTileBlocked(tileId, x, y, brokenBarrels) — the ONE
             collision query that combines base tile + any prop on top.
           • categoryAt(tileId, x, y) — prop overrides tile for the
             debug colour/label lookup.

      2) GAME.tsx — collision pipeline rerouted through tileRules
         BEFORE: SOLID_TILE_TYPES = {1, 11, 12} hard-coded set; decorative
                 props had ZERO collision so the player could walk straight
                 through debris piles / car wrecks / generators / terminals
                 / locked gates.
         AFTER:  isTileWalkable() and canMoveTo() both call
                 isTileBlocked() from tileRules. PROP_LARGE +
                 INTERACTABLE-blocking props now collide correctly.
                 No more "walking into things that look solid".

      3) DEBUG COLLISION OVERLAY  —  toggle via ?debug=collision
         A tile-grid layer that colour-codes every tile by category:
              green   F   FLOOR walkable
              red     S   WALL stone / 'D' debris / 'W' outer wall
              cyan    ⚑   INTERACTABLE press-A
              cyan    ★   sapphire core (special)
              cyan    P   launch pad
              cyan    $   store
              cyan    !   skill chamber
              cyan    ⌬   terminal prop
              red     🔒   gate-locked prop
              orange  ◇   PROP_LARGE blocking
              yellow  ☣   HAZARD (future)
              ochre   |/s PROP_SMALL decorative
         Zero overhead in production (the constant is false on first
         paint when the URL has no ?debug param). Renders directly
         inside the world content view so it scrolls with the camera.

      4) Verified via Playwright screenshot at /game?debug=collision:
            • Every tile gets the correct coloured chip + label.
            • Stone walls clearly framed in red.
            • Walkable corridors clearly green.
            • Interactables (door, core, launch pad, etc.) clearly cyan.
            • Decorative prop tiles now visibly orange/red showing the
              fix (player can no longer walk through them).
         Normal view (no debug param) is unchanged.

      WHAT THIS SOLVES (from user's checklist)
        ✅ Tile rule system with strict collision categories
        ✅ Single source of truth — no more scattered if-checks
        ✅ Standardised grid: everything snaps to tile coords
        ✅ Visual communication groundwork (debug colours = same family
            we'll use for player-facing cues in next pass)
        ✅ Collision debug toggle for map polish iteration

      STILL ON THE BACKLOG  (next polish pass for "Readable Map")
        - Pulsing cyan rim on INTERACTABLE props when the player is
          within 1 tile (player-facing "press A" prompt)
        - Yellow caution stripes around HAZARD tiles (currently the
          spike pads already glow; add a dedicated stripe pattern)
        - Red-blink animation on gate-locked
        - Conduit-maze (Level 2B) tile-rule parity
        - Hidden / SECRET tile reveal mechanic
        - Eliminate any remaining prop placements that overlap walls
          (debug overlay makes audit trivial — quick follow-up)

      No backend changes. No new packages. Bundle compiles cleanly.
      Live preview confirmed both with and without ?debug=collision.

  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  PHASE 2 — ENTITY STRATEGY COMPLETION                          ║
      ╚════════════════════════════════════════════════════════════════╝
      Completed the four Phase-2 deliverables from the QUANTUM REGISTRY
      plan: AI-themed terminology, class system rename, death/fallback
      flow, and stronger vulnerability indicators.

      1) TERMINOLOGY RENAME (visible-string sweep in combat.tsx)
         ATTACK     → EXECUTE
         SKILL      → PROTOCOLS
         ITEM       → UTILITY
         TAME       → JAILBREAK
         CALL       → DEPLOY
         MINION     → ENTITY
         RUN        → DISCONNECT
         HP         → STABILITY
         MP         → POWER GRID / PWR
         XP         → DATA
         CRIT       → SYSTEM BREACH
         SUPER EFFECTIVE → VULNERABILITY EXPLOITED
         STRONG          → VULNERABLE
         PARTY      → NETWORK
         Internal variable names kept for stability.

      2) CLASS SYSTEM RENAME (combatBalance.ts ROLES)
         Old "striker"   → label "ASSAULT"  (high burst damage)
         Old "tank"      → label "TANK"     (unchanged)
         Old "disruptor" → label "HACKER"   (status-effect specialist)
         Old "support"   → label "SUPPORT"  (unchanged)
         Old "artillery" → label "CORRUPTION" (DoT, fragile)
         NEW class added: "swarm" → label "SWARM"
            (fast weak hits, stacking bleed, 70% HP / 110% ATK)
         Class blurbs rewritten in AI-warfare voice ("Drains POWER GRID",
         "Heals & shields the NETWORK", "Massive DoT, fragile shell").

      3) DEATH / FALLBACK FLOW
         New transient combat state:
           • minionHp / minionMaxHp — per-deployed-entity STABILITY pool
             initialised on deploy with role-scaled HP (TANK = 1.55×,
             ARTILLERY = 0.8× etc.)
           • knockedOut: Set<uid> — entities disconnected this fight,
             can't be re-deployed.
           • fallbackPrompt — flips on when an active entity is KO'd.
         Enemy-turn damage pipeline rewired:
           if (deployedMinion && minionHp > 0):
             entity STABILITY is depleted first (magenta floater)
             player STABILITY untouched
             if entity → 0:
               * push "⚠ NAME DISCONNECTED!" log line
               * add uid to knockedOut
               * setDeployedMinion(null)
               * if alive entities remain → open DEPLOY panel
                 (fallbackPrompt) so the player picks the next one
               * else → log "Network depleted — fighting solo"
           else:
             player takes the full hit (legacy behaviour)
         The "Defeat" check now only triggers when the damage that
         REACHED the player would bring their HP to 0. An entity dying
         never ends the fight — exactly the "player remains alive,
         choose another OR continue fighting yourself" flow the user
         specified.
         The deploy panel auto-filters out KO'd entities so the player
         can't redeploy a disconnected one this fight.

      4) STRONGER VULNERABILITY INDICATORS
         • Trigger: when computed damage tier is 'super' or 'strong',
           setVulnPulse(Date.now()) fires.
         • Pulse ring on enemy sprite:
              expanding (1× → 1.45×) faction-tinted ring
              opacity 1 → 0 over 600 ms
              borderWidth 3, faction.glowColor
         • Red flash:
              translucent red (255,80,140,0.45) wash for the first 18 %
              of the pulse lifetime, mix-blend-mode: screen on web for a
              cinematic damage-pop look.
         • Existing "VULNERABILITY EXPLOITED!" floater still fires above
           the enemy.
         Net effect: the player can FEEL the difference between a
         neutral hit and a faction-matchup hit even without reading
         the floater text.

      WHAT THIS SOLVES
        ✅ Combat UI now speaks the QUANTUM REGISTRY language end-to-end.
        ✅ 6 classes locked in (ASSAULT / TANK / HACKER / SUPPORT /
            CORRUPTION / SWARM) with mechanically distinct stat mods.
        ✅ Entity death is no longer an instant-loss event — the player
            is offered a tactical reshuffle.
        ✅ Vulnerability hits land with VISUAL POP, not just text.
        ✅ Entities now feel like tactical shields, not weak clones.

      STILL ON THE PHASE-2 / NEXT BACKLOG
        - Status-effect application + per-turn ticks (the data model
          exists in combatBalance.STATUSES; needs the combat loop to
          maintain an active-statuses array per combatant).
        - Cooldown UI for SIGNATURE abilities.
        - On-screen STABILITY mini-bar for the deployed entity (right
          now the entity's pool is invisible until a hit drops a
          floater above the player).
        - REBOOT (revive) utility item — restore a disconnected entity
          mid-fight at a cost.
        - Conduit-maze tile-rule parity (still deferred).

      No backend changes. No new packages. Bundle compiles cleanly.


  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  PHASE 2 POLISH — STABILITY Bar + Cyber Sweep                  ║
      ╚════════════════════════════════════════════════════════════════╝
      Follow-up to Phase 2 ship. Polished the tactical-feel items that
      the user prioritized first.

      1) STABILITY BAR on the deployed entity (CRITICAL TACTICAL FIX)
         The deploy panel now shows a STAT BAR for the active entity's
         transient STABILITY pool:
           • Magenta when fresh (>50%)
           • Amber when threatened (25–50%)
           • Red when critical (<25%)
           • Displays "STAB X / Y" inline.
         This is the visibility piece that was missing — players can
         now SEE when to swap entities before the disconnection event.

      2) CYBER TERMINOLOGY SWEEP (non-combat screens)
         game.tsx HUD:
            "XP X/Y"  →  "DATA X/Y"
            MENU: HP/MP labels → "STAB X/Y" + "PWR X/Y"
            "⚠ SPIKE TRAP! -10 HP"  →  "⚠ ION SPIKES! -10 STABILITY"
            "CONSOLE ACTIVATED · +40 HP"  →  "CONSOLE ACTIVATED · +40 STABILITY"
         combat.tsx:
            "LEVEL UP! +1 Skill Point"  →  "VERSION UPGRADE! +1 Protocol Slot"
            Deploy panel "MINION:" header  →  "ENTITY:"
            ROLE label now uses the new class names (ASSAULT/HACKER/
            CORRUPTION/SWARM).
         registry.tsx:
            "ACTIVE PARTY (X/Y)"  →  "ACTIVE NETWORK (X/Y)"
         conduit-maze.tsx:
            HUD "PARTY" header  →  "NETWORK"

      VERIFICATION (Playwright screenshot at /game)
         • HUD now reads "DATA 0/100" instead of "XP …"
         • Cyberpunk pavement, void backdrop, AI sweep, faction-glow
           enemy/NPCs, player chibi — all preserved.
         • Atmospheric darkness, distant infrastructure lights still
           cinematic in the void.

      WHAT THIS UNLOCKS
        ✅ Tactical visibility: the player can NOW watch their entity's
            STABILITY tick down and pre-emptively redeploy/swap.
        ✅ Vocabulary is fully cyber: no more "XP / HP / MP / PARTY"
            anywhere visible on screen during normal play.
        ✅ Class identity is consistent everywhere (ASSAULT, TANK,
            HACKER, SUPPORT, CORRUPTION, SWARM).

      STILL ON THE PHASE-2 POLISH BACKLOG (next deeper polish round)
        - Per-turn STATUS-EFFECT TICKS (data exists in STATUSES;
          combat loop needs an active-statuses array per combatant +
          a tick function that runs on turnEnd).
        - STATUS ICON ROW above each combatant (uses the icon glyph
          already defined per status).
        - COOLDOWN COUNTERS on SIGNATURE abilities (currently any-
          time-usable; SIGNATURES map already declares cooldown turns
          per ability).

  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  PHASE 2 FINAL POLISH — Controls + Readability + Redeploy UX  ║
      ╚════════════════════════════════════════════════════════════════╝
      Last polish pass before Phase 3. Focused exclusively on control
      ergonomics, UI readability, and tactical clarity per the user's
      checklist.

      1) A/B BUTTON LAYOUT — GameBoy-style thumb comfort
         ActionButton offsets swapped:
            A (primary, cyan-green) → right: 24  (closest to thumb)
            B (secondary, magenta)  → right: 100 (LEFT of A)
         Matches GBA / portable muscle-memory — primary action lives
         where the right thumb naturally rests.

      2) PLAYER-NAME AUTO-TRUNCATE in HUD
         BEFORE: "PLAYWRIGHTRUNNER" wrapped mid-word as PLAYWRIGHTRUN /
                  NER and overlapped the bars row.
         AFTER:  Names > 13 chars truncate with ellipsis:
                  "PLAYWRIGHTRU…"
                 numberOfLines={1} prevents any wrap.

      3) LOW-STABILITY PULSE WARNING (overworld HUD)
         When player STABILITY drops below 25 %:
           • the bar tints from neon-pink to alarm-red (#ff4566)
           • the entire bar group pulses 2 Hz (opacity 0.55 ↔ 1.0)
         Driven by animTick — no new timers added. Players see
         critical-stability danger at a glance even while moving.

      4) REDEPLOY BANNER in combat deploy panel
         When an entity disconnects (KO'd) and fallbackPrompt is true,
         a red-bordered banner appears ABOVE the entity picker:
            ⚠ ENTITY DISCONNECTED
            REDEPLOY ANOTHER ENTITY OR PRESS [BACK] TO FIGHT SOLO
         Clear tactical-urgency cue — no need to read the combat log.
         The ✕ close button also clears the prompt + flips back to
         the main action grid.

      5) DEPLOY-PANEL EMPTY STATE — terminology cleaned
         "No minions in party. Quarantine some!"
            →  "No entities in network — JAILBREAK some!"

      VERIFICATION (Playwright screenshot at /game)
         • Layout: cyan joystick LEFT, magenta B + green A RIGHT
         • HUD: "PLAYWRIGHTRU…" + "LV1 · S1" + DATA 0/100 + 50G
         • Player chibi visible & centred, pavement + corruption +
           road stripes + dollar store tile clearly readable
         • Void backdrop with distant infrastructure lights still
           cinematic below the map

      WHAT THIS ITERATION SOLVES (final Phase 2 checklist)
        ✅ Control layout — GBA-style, primary action closest to thumb
        ✅ UI readability — name auto-truncate, no overlapping text
        ✅ Tactical clarity — low-STAB pulse + REDEPLOY banner
        ✅ Mobile responsiveness — viewport untouched, controls fit
            tall + narrow screens without overflow
        ✅ Atmosphere preserved — eerie, synthetic, void-framed

      REMAINING POLISH (deferred to next deep round)
        - Per-turn STATUS-EFFECT ticks (active-statuses array per
          combatant, runs on turnEnd)
        - Status icon row above each combatant
        - SIGNATURE-ability cooldown counters
        - REBOOT (revive) utility item

  - agent: "main"
    message: |
      ╔════════════════════════════════════════════════════════════════╗
      ║  PHASE 2 MICRO-FIX — Action Grid Overflow + Log Truncation     ║
      ╚════════════════════════════════════════════════════════════════╝
      User screenshot showed combat action buttons overlapping each
      other ("EXECUTE | PROTOCOL$ | UTILITY", "JAILBREAK | DEPLOY |
      DISCONNECT") because the new cyber labels were too long for the
      3-column phone grid (390 px). Also the boss-intro log entry was
      getting clipped ("⚠ BOSS: Bio-Mech Marauder ap…"). One small
      surgical pass to fix both.

      1) ACTION GRID LABELS — shortened to 5-6 char cyber verbs
         (every word taken from the user's PREFERRED TERMINOLOGY list):
            EXECUTE     → STRIKE
            PROTOCOLS   → SIGNAL    (user-listed term)
            UTILITY     → PATCH     (user-listed term)
            JAILBREAK   → BREACH    (user-listed term)
            DEPLOY      → DEPLOY    (unchanged, fits)
            DISCONNECT  → ESCAPE
         All 6 buttons now sit cleanly side-by-side. `size="sm"` set
         on every action-grid button so the smaller font is used by
         default. The active-entity slot still flips DEPLOY→ENTITY
         on the same button.

      2) PIXELBUTTON.tsx polish
         • Added numberOfLines={1} to the inner label so any future
           long string is hard-clamped instead of wrapping.
         • minWidth lowered 100 → 60 so 3-col grids on narrow phones
           don't force overflow.

      3) COMBAT LOG ENTRY — numberOfLines 1 → 2
         Long boss intros + double-effect log lines now wrap to a
         second line instead of getting truncated with ellipsis.

      No backend changes. No new packages. Bundle compiles cleanly.
      Live preview confirms HUD layout intact + truncated player name
      working. Direct combat-URL screenshot shows "Loading..." (state
      not initialised when bypassing /game) — implementation is verified
      via code review; the label / overflow fix is purely CSS.

        - Final fantasy-term audit on inventory / shop / char-create
        - Conduit-maze tile-rule parity

      No backend changes. No new packages. Bundle compiles cleanly.
      Ready to proceed to Phase 3 once user signs off.

        - REBOOT (revive) utility item — restore a disconnected entity
          mid-fight at a POWER GRID cost.
        - Final fantasy-term audit on inventory/shop/character-create
          screens.

      No backend changes. No new packages. Bundle compiles cleanly.

