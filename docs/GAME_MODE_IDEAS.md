# WordChain — Game Mode Ideas

A prepared list of playable modes. Each is described with the **rule**, the
**skill it teaches**, and a rough **implementation note** so we can pick what to
build next. Sources: classic word-chain / "Shiritori" (Japanese), "Ghost",
"Anagram", "Boggle", "Scrabble"-style constraints, and "Wordle" feedback.

## Already implemented / in progress
- **Guided Turns** (`turns_timed`) — take turns, timer per turn. ✅
- **Relaxed Turns** (`turns_relaxed`) — no timer. ✅
- **Open Practice** (`free_for_all`) — anyone submits anytime. ✅
- **Combat mode** — wager gems, winner takes the pot. 🔧 (schema + UI done)
- **Host rules** — win score, dead mode, banned vowels/suffixes, min length,
  allowed part of speech. 🔧 (schema + UI done)

## Suggested new modes

### 1. Ghost Mode (elimination by spelling)
- **Rule:** Players add one letter at a time to a growing string. If you complete
  a real word (≥3 letters) on your turn, you lose. You must keep the string a
  valid *prefix* of some word.
- **Skill:** spelling, word-family awareness, forward planning.
- **Impl:** needs a prefix dictionary (Trie). Reuse `isValidWord` for completion
  check; add `isPrefix(word)` against the word list.

### 2. Category Chain (themed rounds)
- **Rule:** Host picks a category (animals, food, verbs...). Every word must
  belong to the category AND chain by last/first letter.
- **Skill:** vocabulary within a topic; great for English learners.
- **Impl:** reuse `allowedPos` idea but with a category tag; needs a categorized
  word list or a free-text category with dictionary lookup.

### 3. Reverse Chain (last-letter → first-letter)
- **Rule:** instead of next word starting with previous last letter, it must
  *end* with the previous word's first letter. Twists the mental model.
- **Skill:** flexibility, pattern switching.
- **Impl:** small change to `checkChainRule` (compare last vs first).

### 4. Length Ladder (escalating length)
- **Rule:** each successive word must be exactly one letter longer than the
  previous. Resets if it gets too long.
- **Skill:** vocabulary breadth across lengths.
- **Impl:** track previous word length; validate `word.length === prev+1`.

### 5. Anagram Attack
- **Rule:** host/round gives a base word; players must submit words that are
  anagrams or sub-anagrams of it within the timer.
- **Skill:** letter manipulation, anagramming.
- **Impl:** sort letters of candidate and compare to sorted base subset.

### 6. Wordle Duel (feedback guessing)
- **Rule:** one player thinks of a 5-letter word; others get Wordle-style
  colored feedback per guess, taking turns. First to guess wins the round.
- **Skill:** deductive reasoning, vowel/consonant patterns.
- **Impl:** separate mini-game; reuse dictionary for validity.

### 7. Speed Round (no turn order)
- **Rule:** `free_for_all` + short global timer; everyone races to submit valid
  chain words; most words in 60s wins.
- **Skill:** fluency under pressure.
- **Impl:** reuse `free_for_all`; add a global round timer + word-count scoring.

### 8. Banned Letter / Vowel-Free
- **Rule:** a random letter (or vowel) is banned each round; words may not
  contain it. (Superset of the "remove some vowel" rule you suggested.)
- **Skill:** vocabulary flexibility; forces creative word choice.
- **Impl:** reuse `bannedVowels`; extend to ban any letter.

### 9. Definition Blind (dictionary challenge)
- **Rule:** a definition is shown; first player to type the correct word (that
  also chains) scores bonus gems.
- **Skill:** receptive vocabulary, dictionary use.
- **Impl:** needs a definition source (the existing `word_definitions` cache).

### 10. Team Battle
- **Rule:** players split into two teams; turns alternate by team; combined team
  score; combat gems split among the winning team.
- **Skill:** collaboration, strategy.
- **Impl:** add `team` column to `group_members`; aggregate scores by team.

## Recommended next picks (high value, low effort)
1. **Banned Letter / Vowel-Free** — already 80% built via host rules.
2. **Length Ladder** — tiny logic change, very fun.
3. **Category Chain** — best for English learning (your app's core goal).
4. **Ghost Mode** — needs a Trie but is a classic and highly engaging.

## Open questions for you
- Should combat gems be purely cosmetic (bragging rights) or unlock something?
- Do you want a single "mode" dropdown that combines several rules, or keep
  rules as independent toggles (current approach)?
- For win/loss, should solo (vs bot) games count toward the record?
