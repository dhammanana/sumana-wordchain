/**
 * gameLogic.test.js — Unit tests for pure game logic.
 *
 * Runs with plain Node (no dependencies):
 *   node tests/gameLogic.test.js
 *
 * These tests cover the turn-advancement and rule-validation behaviour that
 * previously lived only inside the Supabase trigger (schema.sql) and the
 * PlayView realtime handlers. They exist to guard against the regression where
 * "the turn didn't come to the next person" in guided mode.
 */

import assert from 'node:assert/strict';
import {
  nextPlayerId,
  lastLetter,
  scoreForWord,
  validateWord,
  checkWinner,
  settleCombatGems,
  advanceTurnAfterLeave,
} from '../src/gameLogic.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`      ${err.message}`);
  }
}

console.log('Turn advancement (nextPlayerId)');

test('advances to the next player in turn order', () => {
  const members = [
    { player_id: 'A', turn_position: 1 },
    { player_id: 'B', turn_position: 2 },
    { player_id: 'C', turn_position: 3 },
  ];
  assert.equal(nextPlayerId(members, 'A'), 'B');
  assert.equal(nextPlayerId(members, 'B'), 'C');
});

test('wraps around from last player to first', () => {
  const members = [
    { player_id: 'A', turn_position: 1 },
    { player_id: 'B', turn_position: 2 },
    { player_id: 'C', turn_position: 3 },
  ];
  assert.equal(nextPlayerId(members, 'C'), 'A');
});

test('returns first player when current player is not found', () => {
  const members = [
    { player_id: 'A', turn_position: 1 },
    { player_id: 'B', turn_position: 2 },
  ];
  assert.equal(nextPlayerId(members, 'ZZZ'), 'A');
});

test('returns null for empty member list', () => {
  assert.equal(nextPlayerId([], 'A'), null);
});

test('orders by turn_position, not array order', () => {
  const members = [
    { player_id: 'C', turn_position: 3 },
    { player_id: 'A', turn_position: 1 },
    { player_id: 'B', turn_position: 2 },
  ];
  assert.equal(nextPlayerId(members, 'A'), 'B');
  assert.equal(nextPlayerId(members, 'B'), 'C');
  assert.equal(nextPlayerId(members, 'C'), 'A');
});

console.log('\nScoring & helpers');

test('lastLetter returns lowercased final character', () => {
  assert.equal(lastLetter('Apple'), 'e');
  assert.equal(lastLetter('ZOO'), 'o');
});

test('scoreForWord is length - 2 with a minimum of 1', () => {
  assert.equal(scoreForWord('go'), 1);   // 2 - 2 = 0 -> min 1
  assert.equal(scoreForWord('cat'), 1);  // 3 - 2 = 1
  assert.equal(scoreForWord('apple'), 3); // 5 - 2 = 3
});

console.log('\nWord validation (validateWord)');

test('rejects empty / too-short words', () => {
  assert.equal(validateWord({ word: '', requiredLetter: null }).ok, false);
  assert.equal(validateWord({ word: 'a', requiredLetter: null }).ok, false);
});

test('enforces the chain rule (must start with required letter)', () => {
  const res = validateWord({ word: 'Cat', requiredLetter: 'c' });
  assert.equal(res.ok, true);
  const bad = validateWord({ word: 'Dog', requiredLetter: 'c' });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /start with "C"/);
});

test('first word (requiredLetter null) has no chain constraint', () => {
  assert.equal(validateWord({ word: 'Apple', requiredLetter: null }).ok, true);
});

test('rejects duplicate words', () => {
  const res = validateWord({
    word: 'Cat',
    requiredLetter: 'c',
    usedWords: ['cat', 'dog'],
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /already been used/i);
});

test('honours a dictionary validity check when provided', () => {
  const isWordValid = (w) => w === 'cat';
  const good = validateWord({ word: 'Cat', requiredLetter: 'c', isWordValid });
  assert.equal(good.ok, true);
  const bad = validateWord({ word: 'Xyzzy', requiredLetter: 'x', isWordValid });
  assert.equal(bad.ok, false);
});

test('minLength rule', () => {
  const res = validateWord({
    word: 'cat',
    requiredLetter: 'c',
    rules: { minLength: 4 },
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /at least 4/);
});

test('bannedVowels rule', () => {
  const res = validateWord({
    word: 'cat',
    requiredLetter: 'c',
    rules: { bannedVowels: ['a'] },
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /A/);
  const ok = validateWord({
    word: 'dog',
    requiredLetter: 'd',
    rules: { bannedVowels: ['a'] },
  });
  assert.equal(ok.ok, true);
});

test('bannedSuffixes rule (e.g. no "ing")', () => {
  const res = validateWord({
    word: 'sing',
    requiredLetter: 's',
    rules: { bannedSuffixes: ['ing'] },
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /ing/i);
});

test('allowedPos rule uses a part-of-speech lookup', () => {
  const getPos = (w) => (w === 'run' ? ['verb', 'noun'] : ['noun']);
  const verbOk = validateWord({
    word: 'run',
    requiredLetter: 'r',
    rules: { allowedPos: ['verb'] },
    getPos,
  });
  assert.equal(verbOk.ok, true);
  const nounOnly = validateWord({
    word: 'cat',
    requiredLetter: 'c',
    rules: { allowedPos: ['verb'] },
    getPos,
  });
  assert.equal(nounOnly.ok, false);
});

test('rejects profanity when a checker is provided', () => {
  const hasProfanity = (w) => w === 'badword';
  const bad = validateWord({ word: 'badword', requiredLetter: 'b', hasProfanity });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /not allowed/i);
  const ok = validateWord({ word: 'book', requiredLetter: 'b', hasProfanity });
  assert.equal(ok.ok, true);
});

test('profanity is rejected even when it would otherwise be valid', () => {
  // A profane word that starts with the right letter and is in the dictionary
  // must still be rejected before any other rule is consulted.
  const hasProfanity = (w) => w === 'damn';
  const res = validateWord({
    word: 'damn',
    requiredLetter: 'd',
    usedWords: [],
    rules: { bannedVowels: ['a'] }, // would also reject, but profanity fires first
    hasProfanity,
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /not allowed/i);
});

test('does not reject anything when no profanity checker is given', () => {
  const res = validateWord({ word: 'whatever', requiredLetter: 'w' });
  assert.equal(res.ok, true);
});

console.log('\nWin condition (checkWinner)');

test('returns null when no win score is set', () => {
  const members = [{ player_id: 'A', score: 500 }];
  assert.equal(checkWinner(members, 0), null);
  assert.equal(checkWinner(members, undefined), null);
});

test('returns the first player to reach the win score', () => {
  const members = [
    { player_id: 'A', score: 95 },
    { player_id: 'B', score: 100 },
  ];
  assert.equal(checkWinner(members, 100), 'B');
});

console.log('\nCombat gem settlement (settleCombatGems)');

test('winner takes the wagered gems from each loser', () => {
  const members = [
    { player_id: 'A' },
    { player_id: 'B' },
    { player_id: 'C' },
  ];
  const deltas = settleCombatGems(members, 'A', 5);
  assert.equal(deltas.A, 10);  // +5 from B and +5 from C
  assert.equal(deltas.B, -5);
  assert.equal(deltas.C, -5);
});

test('no settlement when wager is zero', () => {
  const members = [{ player_id: 'A' }, { player_id: 'B' }];
  const deltas = settleCombatGems(members, 'A', 0);
  assert.equal(deltas.A, 0);
  assert.equal(deltas.B, 0);
});

test('no settlement when there is no winner', () => {
  const members = [{ player_id: 'A' }, { player_id: 'B' }];
  const deltas = settleCombatGems(members, null, 5);
  assert.equal(deltas.A, 0);
  assert.equal(deltas.B, 0);
});

test('every player starts at 0 delta', () => {
  const members = [{ player_id: 'A' }, { player_id: 'B' }, { player_id: 'C' }, { player_id: 'D' }];
  const deltas = settleCombatGems(members, 'C', 3);
  assert.equal(deltas.C, 9);
  assert.equal(deltas.A, -3);
  assert.equal(deltas.B, -3);
  assert.equal(deltas.D, -3);
});

console.log('\nLeave-game turn advance (advanceTurnAfterLeave)');

const leaveMembers = [
  { player_id: 'A', turn_position: 1 },
  { player_id: 'B', turn_position: 2 },
  { player_id: 'C', turn_position: 3 },
];

test('returns null when fewer than 2 players remain', () => {
  assert.equal(advanceTurnAfterLeave([{ player_id: 'A', turn_position: 1 }], 'A', 'A'), null);
  assert.equal(advanceTurnAfterLeave(
    [{ player_id: 'A', turn_position: 1 }, { player_id: 'B', turn_position: 2 }],
    'B', 'A'), null);
});

test('keeps current turn if the leaver was not active', () => {
  // B leaves; it's A's turn -> A stays the turn.
  assert.equal(advanceTurnAfterLeave(leaveMembers, 'B', 'A'), 'A');
});

test('advances to next player when the active player leaves', () => {
  // A (active) leaves -> B takes the turn.
  assert.equal(advanceTurnAfterLeave(leaveMembers, 'A', 'A'), 'B');
  // C (active) leaves -> wraps to A.
  assert.equal(advanceTurnAfterLeave(leaveMembers, 'C', 'C'), 'A');
});

test('advances correctly when current turn is unknown', () => {
  // B leaves, current turn not specified -> next after B is C.
  assert.equal(advanceTurnAfterLeave(leaveMembers, 'B', null), 'C');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
process.exit(failed === 0 ? 0 : 1);
