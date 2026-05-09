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
  current_focus:
    - "Battle Scene sprite + floater + log polish"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
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
