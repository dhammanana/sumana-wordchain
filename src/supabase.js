import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mhtcoxowsxprwuezhcih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K2Plf9i8yr_LYQvKz6ZFYw_NaZHQ_fx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/**
 * Wrap a promise with a timeout
 */
async function withTimeout(promise, ms = 8000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sign in with a social provider (Google, Facebook, GitHub)
 */
export async function signInWithProvider(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin + '/wordchain/',
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session / user
 */
export async function getSession() {
  const { data, error } = await withTimeout(supabase.auth.getSession());
  if (error) throw error;
  return data?.session || null;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Get the user's profile from the database
 */
export async function getProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Error fetching profile:', error.message);
  }
  return data || null;
}

/**
 * Ensure a profile exists for the current user.
 * Creates one from the OAuth provider data (Google/Facebook/GitHub) if missing.
 * Returns the profile row.
 */
export async function ensureProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Try to load existing profile
  let profile = await getProfile(user.id);
  if (profile) return profile;

  // Build profile data from the OAuth identity
  const meta = user.user_metadata || {};
  const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || 'google';

  const profileData = {
    id: user.id,
    display_name: meta.full_name || meta.name || meta.user_name || user.email?.split('@')[0] || 'Player',
    avatar_url: meta.avatar_url || meta.picture || null,
    email: user.email || null,
    provider,
    gems: 0,
    total_score: 0,
    total_days_active: 0,
  };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Could not create profile:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Profile creation failed:', e.message);
    return null;
  }
}

/**
 * Create or update the user's profile
 */
export async function upsertProfile(profile) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Track user activity (daily active days)
 */
export async function trackActivity() {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.rpc('track_user_activity', { user_id_param: user.id });
}

/**
 * Create a new group
 */
export async function createGroup(name, gameMode = 'turns_timed', rules = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data: codeData, error: codeError } = await supabase
    .rpc('generate_group_code');

  let code;
  if (codeError) {
    code = `${randomWord()}-${randomWord()}-${Math.floor(Math.random() * 99) + 1}`;
  } else {
    code = codeData;
  }

  const insertObj = {
    code,
    name: name || code,
    host_id: user.id,
    status: 'waiting',
    game_mode: gameMode,
    turn_seconds: rules.turnSeconds || 60,
    win_score: rules.winScore || null,
    dead_mode: !!rules.deadMode,
    banned_vowels: (rules.bannedVowels || []).join(','),
    min_length: rules.minLength || 2,
    banned_suffixes: (rules.bannedSuffixes || []).join(','),
    allowed_pos: (rules.allowedPos || []).join(','),
    combat_mode: !!rules.combatMode,
    gem_wager: rules.gemWager || 0,
  };

  const { data: group, error } = await supabase
    .from('groups')
    .insert(insertObj)
    .select()
    .single();

  if (error) throw error;

  // Add host as member
  const { error: joinError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      player_id: user.id,
      turn_position: 1,
      score: 0,
    });

  if (joinError && joinError.code !== '23505') {
    console.warn('Could not add host to group_members:', joinError.message);
  }

  return group;
}

/**
 * Join a group by code
 */
export async function joinGroup(code) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .single();

  if (groupError) throw new Error('Group not found. Check the invite code.');
  if (group.status === 'finished') throw new Error('This game has already ended.');

  // Get current member count for turn_position
  const { data: members } = await supabase
    .from('group_members')
    .select('turn_position')
    .eq('group_id', group.id)
    .order('turn_position', { ascending: false })
    .limit(1);

  const nextPosition = members && members.length > 0 ? members[0].turn_position + 1 : 1;

  const { error: joinError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      player_id: user.id,
      turn_position: nextPosition,
      score: 0,
    });

  if (joinError) {
    if (joinError.code === '23505') {
      throw new Error('You are already a member of this group.');
    }
    throw joinError;
  }

  return group;
}

/**
 * Get group details with members
 */
export async function getGroupWithMembers(groupId) {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;

  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('*, profiles(*)')
    .eq('group_id', groupId)
    .order('turn_position');

  if (membersError) throw membersError;

  return { ...group, members: members || [] };
}

/**
 * Get group by code
 */
export async function getGroupByCode(code) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .single();
  if (error) return null;
  return data;
}

/**
 * Start the game (host only)
 */
export async function startGame(groupId) {
  const { error } = await supabase.rpc('start_game', { group_id_param: groupId });
  if (error) throw error;
}

/**
 * Skip turn
 */
export async function skipTurn(groupId) {
  const { error } = await supabase.rpc('skip_turn', { group_id_param: groupId });
  if (error) throw error;
}

/**
 * End the game and record win/loss + settle combat gems.
 */
export async function endGame(groupId) {
  const { error } = await supabase.rpc('end_game', { group_id_param: groupId });
  if (error) throw error;
}

/**
 * A player leaves the game. The `leave_game` RPC removes the member, reassigns
 * host if needed, advances the turn if it was their turn, and ends the game if
 * fewer than 2 players remain. This prevents a stalled turn when someone leaves.
 */
export async function leaveGame(groupId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.rpc('leave_game', {
    group_id_param: groupId,
    player_id_param: user.id,
  });
  if (error) throw error;
}

/**
 * Fetch per-player results (win/loss + gem delta) for a finished game.
 */
export async function getGameResults(groupId) {
  const { data, error } = await supabase
    .from('game_results')
    .select('player_id, result, gems_delta')
    .eq('group_id', groupId);
  if (error) throw error;
  return data || [];
}

/**
 * Dead mode: a player who times out is eliminated and the game ends.
 */
export async function deadModeEliminate(groupId, playerId) {
  const { error } = await supabase.rpc('dead_mode_eliminate', {
    group_id_param: groupId,
    player_id_param: playerId,
  });
  if (error) throw error;
}

/**
 * Submit a word
 */
export async function submitWord(groupId, word) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('game_words')
    .insert({
      group_id: groupId,
      player_id: user.id,
      word: word.toUpperCase(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This word has already been used in this game!');
    }
    if (error.message?.includes('Not your turn')) {
      throw new Error('It is not your turn!');
    }
    if (error.message?.includes('must start with')) {
      throw new Error(error.message || 'Word must start with the required letter');
    }
    if (error.message?.includes('not active')) {
      throw new Error('The game has not started yet or has ended.');
    }
    throw error;
  }
  return data;
}

/**
 * Get game words
 */
export async function getGameWords(groupId) {
  const { data, error } = await supabase
    .from('game_words')
    .select('*, profiles(display_name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Subscribe to game changes (Realtime)
 */
export async function subscribeToGame(groupId, callbacks) {
  const channelName = `game:${groupId}`;
  const topic = `realtime:${channelName}`;

  const existing = supabase.getChannels().find(c => c.topic === topic);
  if (existing) {
    await supabase.removeChannel(existing);
  }

  const channel = supabase.channel(channelName);

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'game_words',
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      if (callbacks.onWordInserted) callbacks.onWordInserted(payload.new);
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'groups',
      filter: `id=eq.${groupId}`,
    },
    (payload) => {
      if (callbacks.onGroupUpdated) callbacks.onGroupUpdated(payload.new);
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'group_members',
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      if (callbacks.onMembersChanged) callbacks.onMembersChanged(payload.new);
    }
  );

  channel.subscribe((status) => {
    if (callbacks.onStatus) callbacks.onStatus(status);
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get cached word definition
 */
export async function getCachedDefinition(word) {
  const { data, error } = await supabase
    .from('word_definitions')
    .select('data')
    .eq('word', word.toLowerCase())
    .single();
  if (error) return null;
  return data?.data;
}

/**
 * Cache a word definition
 */
export async function cacheDefinition(word, definitionData) {
  const { error } = await supabase
    .from('word_definitions')
    .upsert({ word: word.toLowerCase(), data: definitionData });
  if (error) console.warn('Failed to cache definition:', error.message);
}

/**
 * Get user's game history
 */
export async function getGameHistory(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('game_words')
    .select(`
      *,
      groups!inner(name, code, status),
      profiles!inner(display_name)
    `)
    .eq('player_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return data || [];
}

/**
 * Get group history
 */
export async function getGroupHistory(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('group_members')
    .select('*, groups!inner(*)')
    .eq('player_id', userId)
    .order('joined_at', { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Check if user is a group member
 */
export async function isGroupMember(groupId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('group_members')
    .select('player_id')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .single();

  return !!data;
}

function randomWord() {
  const words = ['vibrant', 'clever', 'swift', 'brave', 'calm', 'eager', 'fancy',
    'grand', 'happy', 'jolly', 'keen', 'lively', 'merry', 'noble', 'proud',
    'quick', 'sharp', 'smart', 'sunny', 'witty'];
  return words[Math.floor(Math.random() * words.length)];
}
