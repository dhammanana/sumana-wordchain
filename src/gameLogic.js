/**
 * gameLogic.js — Pure, framework-free game rules.
 *
 * These functions mirror the authoritative logic that lives in the Supabase
 * database (see supabase/schema.sql: handle_new_word, skip_turn). Keeping a
 * pure JS copy here lets us unit-test the turn-advancement and rule-validation
 * behaviour without a database, and keeps the client and server consistent.
 *
 * IMPORTANT: The database trigger is the source of truth at runtime. The
 * client uses these helpers only for optimistic UI and validation feedback.
 */

/**
 * Advance to the next player in turn order, wrapping around to the first.
 *
 * @param {Array<{player_id: string, turn_position: number}>} members
 * @param {string} currentPlayerId
 * @returns {string|null} next player id, or null if no members
 */
export function nextPlayerId(members, currentPlayerId) {
  if (!members || members.length === 0) return null;
  const sorted = [...members].sort((a, b) => (a.turn_position ?? 0) - (b.turn_position ?? 0));
  const idx = sorted.findIndex(m => m.player_id === currentPlayerId);
  if (idx === -1) return sorted[0].player_id; // current not found -> first player
  const next = sorted[(idx + 1) % sorted.length];
  return next.player_id;
}

/**
 * Compute the last letter of a word (lowercased).
 * @param {string} word
 * @returns {string}
 */
export function lastLetter(word) {
  if (!word || word.length === 0) return '';
  return word[word.length - 1].toLowerCase();
}

/**
 * Score for a word: length - 2, minimum 1 (matches DB: greatest(length-2, 1)).
 * @param {string} word
 * @returns {number}
 */
export function scoreForWord(word) {
  if (!word) return 0;
  return Math.max(word.length - 2, 1);
}

/**
 * Validate a candidate word against the active game rules.
 * Returns { ok: true } or { ok: false, reason: string }.
 *
 * @param {Object} params
 * @param {string} params.word            candidate word (any case)
 * @param {string|null} params.requiredLetter  letter the word must start with (null = first word)
 * @param {string[]} params.usedWords     lowercased words already played
 * @param {Object} [params.rules]         host-configured rules
 * @param {number} [params.rules.winScore]        win at this score (0/undefined = no limit)
 * @param {boolean} [params.rules.deadMode]       true = timeout loses
 * @param {string[]} [params.rules.bannedVowels]  vowels not allowed anywhere
 * @param {number} [params.rules.minLength]       minimum word length
 * @param {string[]} [params.rules.bannedSuffixes] suffixes not allowed (e.g. ['ing'])
 * @param {string[]} [params.rules.allowedPos]    allowed parts of speech (e.g. ['noun','verb'])
 * @param {Function} [params.isWordValid]  (word) => boolean dictionary check
 * @param {Function} [params.getPos]       (word) => string[] parts of speech
 * @param {Function} [params.hasProfanity] (word) => boolean profanity check
 */
export function validateWord({
  word,
  requiredLetter,
  usedWords = [],
  rules = {},
  isWordValid,
  getPos,
  hasProfanity,
}) {
  const w = (word || '').trim();
  if (!w) return { ok: false, reason: 'Please enter a word.' };
  if (w.length < 2) return { ok: false, reason: 'Word must be at least 2 letters.' };

  // Profanity filter (if a checker is provided). Reject early so it cannot be
  // bypassed by any host rule.
  if (typeof hasProfanity === 'function' && hasProfanity(w)) {
    return { ok: false, reason: 'Please keep it friendly — that word is not allowed.' };
  }

  // Chain rule: must start with required letter
  if (requiredLetter) {
    if (w[0].toLowerCase() !== requiredLetter.toLowerCase()) {
      return { ok: false, reason: `Word must start with "${requiredLetter.toUpperCase()}".` };
    }
  }

  // Duplicate check
  const lower = w.toLowerCase();
  if (usedWords.some(u => u.toLowerCase() === lower)) {
    return { ok: false, reason: 'This word has already been used!' };
  }

  // Dictionary validity (if a checker is provided)
  if (typeof isWordValid === 'function' && !isWordValid(lower)) {
    return { ok: false, reason: `"${w}" is not in the dictionary.` };
  }

  // Minimum length rule
  if (rules.minLength && w.length < rules.minLength) {
    return { ok: false, reason: `Words must be at least ${rules.minLength} letters.` };
  }

  // Banned vowels rule
  if (Array.isArray(rules.bannedVowels) && rules.bannedVowels.length) {
    const banned = rules.bannedVowels.map(v => v.toLowerCase());
    const hasBanned = [...lower].some(ch => banned.includes(ch));
    if (hasBanned) {
      return { ok: false, reason: `Words may not contain: ${banned.map(v => v.toUpperCase()).join(', ')}.` };
    }
  }

  // Banned suffixes rule (e.g. no words ending in "ing")
  if (Array.isArray(rules.bannedSuffixes) && rules.bannedSuffixes.length) {
    const bad = rules.bannedSuffixes.find(s => lower.endsWith(s.toLowerCase()));
    if (bad) {
      return { ok: false, reason: `Words may not end in "${bad}".` };
    }
  }

  // Allowed part-of-speech rule
  if (Array.isArray(rules.allowedPos) && rules.allowedPos.length && typeof getPos === 'function') {
    const pos = getPos(lower) || [];
    const allowed = rules.allowedPos.map(p => p.toLowerCase());
    const matches = pos.some(p => allowed.includes(p.toLowerCase()));
    if (!matches) {
      return { ok: false, reason: `Only ${allowed.join(' / ')} words are allowed.` };
    }
  }

  return { ok: true };
}

/**
 * Determine whether the game has a winner under the "first to N points" rule.
 * @param {Array<{player_id: string, score: number}>} members
 * @param {number} [winScore]
 * @returns {string|null} winning player id, or null
 */
export function checkWinner(members, winScore) {
  if (!winScore || winScore <= 0) return null;
  const winner = members.find(m => (m.score || 0) >= winScore);
  return winner ? winner.player_id : null;
}

/**
 * Compute combat gem settlement (pure mirror of the `end_game()` RPC loop).
 *
 * In combat mode the winner collects the wagered gems from every other
 * participant. Losers are clamped at 0 by the DB; this pure helper returns the
 * *intended* deltas (negative for losers, positive for the winner) so the
 * client can show a preview and the unit tests can verify the math.
 *
 * @param {Array<{player_id: string}>} members
 * @param {string|null} winnerId
 * @param {number} wager  gems wagered per player
 * @returns {Object<string, number>} map of player_id -> gems delta
 */
export function settleCombatGems(members, winnerId, wager) {
  const deltas = {};
  for (const m of members) deltas[m.player_id] = 0;
  if (!winnerId || !(wager > 0)) return deltas;
  for (const m of members) {
    if (m.player_id === winnerId) continue;
    deltas[m.player_id] -= wager;
    deltas[winnerId] += wager;
  }
  return deltas;
}

/**
 * Determine the new active turn after a player leaves (pure mirror of the
 * `leave_game()` RPC).
 *
 * Rules:
 *  - If fewer than 2 members remain, the game should end -> returns null.
 *  - If the leaving player was NOT the active turn, the current turn is kept
 *    (as long as that player is still present).
 *  - If the leaving player WAS the active turn, advance to the next player in
 *    turn order after the leaver.
 *
 * @param {Array<{player_id: string, turn_position: number}>} members
 * @param {string} leavingPlayerId
 * @param {string|null} currentTurnPlayerId
 * @returns {string|null} next player id, or null if the game should end
 */
export function advanceTurnAfterLeave(members, leavingPlayerId, currentTurnPlayerId) {
  const remaining = members.filter(m => m.player_id !== leavingPlayerId);
  if (remaining.length < 2) return null;

  // Leaving player wasn't the active turn: keep current turn if still present.
  if (currentTurnPlayerId && currentTurnPlayerId !== leavingPlayerId) {
    if (remaining.some(m => m.player_id === currentTurnPlayerId)) {
      return currentTurnPlayerId;
    }
  }

  // Otherwise advance to the player who follows the leaver in turn order.
  return nextPlayerId(members, leavingPlayerId);
}
