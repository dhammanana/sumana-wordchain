# WordChain — Future Work Plan

Tracked for later sessions. Status legend: ✅ done · 🔧 partial · ⬜ todo.

## A. Auth & session (recently fixed)
- ✅ Disable anonymous auth in Supabase dashboard (user action).
- ✅ `main.js`: restore session BEFORE router init; re-render HomeView on auth change.
- ✅ Treat anonymous sessions as logged-out in `main.js` + `HomeView`.
- ⬜ Verify in browser: logged-in user no longer sees login screen on refresh.
- ⬜ Consider a global store subscription so ANY view re-renders on auth change
  (current fix only re-renders HomeView via `navigate('/')`).

## B. Turn / guided-mode reliability
- ✅ Added `syncTurnState()` + 4s poll fallback in `PlayView` to self-heal missed
  realtime turn events.
- ⬜ Add integration test against a real Supabase instance (realtime + RPC).
- ✅ Added `leave_game()` RPC (migration_06) + client `leaveGame()` + wired into
  PlayView/LobbyView leave buttons so a leaving player's turn no longer stalls.
  **Needs DB apply:** run `supabase/migration_06_leave_game.sql` in the SQL editor.
- ⬜ Edge case: two words submitted "simultaneously" — DB trigger uses row lock,
  but client may show race; confirm `onWordInserted` re-syncs cleanly.

## C. Combat mode & host rules (schema + UI done, needs verification)
- 🔧 `migration_05_combat_and_rules.sql` written — must be applied in Supabase SQL editor.
- 🔧 `end_game()` / `dead_mode_eliminate()` RPCs written.
- ⬜ Apply migration to DB; verify gem settlement math (winner takes wagered gems).
  (Math now mirrored in pure `settleCombatGems()` in gameLogic.js + unit-tested.)
- ✅ Combat UI: show current gem balance + wager during play (PlayView
  `#combat-banner`); show gem delta on game end (`showCombatResult`).
  **Needs DB apply:** migration_05 (combat columns) must be applied for this to show.
- ⬜ "Allowed part of speech" rule needs a real POS source — currently `validateWord`
  supports `getPos` but no dictionary POS lookup is wired. Options:
  - Bundle a small POS-tagged word list (noun/verb/adjective).
  - Call a dictionary API (cost/rate-limit/privacy implications).

## D. Win / loss tracking
- ✅ `profiles.games_won/lost`, `game_results` table, shown on ProfileView.
- ⬜ Decide: should solo (vs bot) games count toward win/loss? Currently they don't
  call `endGame`.
- ⬜ Show win/loss on the scoreboard or a dedicated "Record" screen.
- ⬜ Add a "rematch" / "play again" button that resets scores and restarts.

## E. New game modes (see docs/GAME_MODE_IDEAS.md)
Priority order (high value, low effort):
1. ⬜ Banned Letter / Vowel-Free — mostly built via host rules; needs UI toggle polish.
2. ⬜ Length Ladder — small logic change to `checkChainRule`/validation.
3. ⬜ Category Chain — best for English learning; needs categorized word list.
4. ⬜ Ghost Mode — needs a prefix Trie over the word list.
5. ⬜ Speed Round, Reverse Chain, Anagram Attack, Wordle Duel, Team Battle — later.

## F. Word validation improvements
- ⬜ The client word list (`COMMON_WORDS`) is ~1000 words; many valid English words
  are rejected. Consider a larger dictionary or an API fallback.
- ✅ Profanity filter (`hasProfanity`) is now enforced in `validateWord`
  (rejects early, before any host rule). Unit-tested.
- ⬜ Cache definitions from a dictionary API into `word_definitions` (table exists).

## G. Testing & tooling
- ✅ `tests/gameLogic.test.js` (pure logic, run with `node tests/gameLogic.test.js`).
- ✅ `npm test` script added (runs the node test harness). Expanded tests cover
  profanity enforcement, combat gem settlement (`settleCombatGems`), and
  leave-game turn advance (`advanceTurnAfterLeave`).
- ⬜ Add a test runner / CI (e.g. `vitest`) — current harness is plain node, which
  is dependency-free and sufficient for pure logic.
- ⬜ Add a Supabase local dev setup (CLI + seed) for integration tests.
- ⬜ Lint + format (eslint/prettier) to match repo style.

## H. Open questions for the user
- Should combat gems be cosmetic or unlock features?
- Single "mode" dropdown vs independent rule toggles (current = toggles)?
- Count solo games in win/loss record?
- Preferred next mode to build?
