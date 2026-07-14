import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mhtcoxowsxprwuezhcih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K2Plf9i8yr_LYQvKz6ZFYw_NaZHQ_fx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Wrap a promise with a timeout so it doesn't hang forever.
 * Resolves to null on timeout.
 */
async function withTimeout(promise, ms = 5000) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sign in anonymously (creates a stable user identity per browser)
 * Falls back to local mode gracefully if Supabase is unreachable.
 */
export async function ensureAuth() {
  const result = await withTimeout(supabase.auth.getSession());
  const session = result?.data?.session;
  if (session?.user) return session.user;

  const authResult = await withTimeout(supabase.auth.signInAnonymously());
  if (!authResult) {
    console.warn('Auth timed out or failed, running in local/offline mode');
    return null;
  }
  const { data, error } = authResult;
  if (error) {
    console.warn('Anonymous auth failed, falling back to local mode:', error.message);
    return null;
  }
  return data?.user || null;
}

/**
 * Get the current user's profile from the database, or null
 */
export async function getProfile() {
  const user = await ensureAuth();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.warn('Error fetching profile:', error.message);
  }
  return data || null;
}

/**
 * Create or update the user's profile
 */
export async function upsertProfile(profile) {
  const user = await ensureAuth();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...profile })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new group (study session) and add host as first member
 * @param {string} name - Group/session name
 * @param {string} gameMode - 'turns_timed' | 'turns_relaxed' | 'free_for_all'
 */
export async function createGroup(name, gameMode = 'turns_timed') {
  const user = await ensureAuth();
  if (!user) throw new Error('Not authenticated');

  // Get the generated code from the database function
  const { data: codeData, error: codeError } = await supabase
    .rpc('generate_group_code');

  let group;

  if (codeError) {
    // Fallback: generate code client-side
    const code = `${randomWord()}-${randomWord()}-${Math.floor(Math.random() * 99) + 1}`;

    const { data, error } = await supabase
      .from('groups')
      .insert({
        code,
        name: name || `${code}`,
        host_id: user.id,
        status: 'waiting',
        game_mode: gameMode,
      })
      .select()
      .single();

    if (error) throw error;
    group = data;
  } else {
    const code = codeData;
    const { data, error } = await supabase
      .from('groups')
      .insert({
        code,
        name: name || code,
        host_id: user.id,
        status: 'waiting',
        game_mode: gameMode,
      })
      .select()
      .single();

    if (error) throw error;
    group = data;
  }

  // IMPORTANT: Add the host as a group_member so turn rotation works correctly.
  // Without this, start_game() and skip_turn() cannot find the host in the turn order.
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
 * Join a group by its code (insert into group_members + create profile if needed)
 */
export async function joinGroup(code, displayName, avatarSeed) {
  const user = await ensureAuth();
  if (!user) throw new Error('Not authenticated');

  // Find the group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .single();

  if (groupError) throw new Error('Group not found. Check the invite code.');
  if (group.status === 'finished') throw new Error('This game has already ended.');

  // Ensure profile exists
  await upsertProfile({ display_name: displayName, avatar_seed: avatarSeed || user.id });

  // Get current member count for turn_position
  const { data: members } = await supabase
    .from('group_members')
    .select('turn_position')
    .eq('group_id', group.id)
    .order('turn_position', { ascending: false })
    .limit(1);

  const nextPosition = members && members.length > 0 ? members[0].turn_position + 1 : 1;

  // Join the group
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
 * Get group details with member info
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
 * Skip the current player's turn (timer expired), advance to next player
 */
export async function skipTurn(groupId) {
  const { error } = await supabase.rpc('skip_turn', { group_id_param: groupId });
  if (error) throw error;
}

/**
 * Submit a word to the chain
 */
export async function submitWord(groupId, word) {
  const user = await ensureAuth();
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
    // NOTE: PostgreSQL custom errcodes are NOT supported (they cause
    // 'unrecognized exception condition' errors). We detect by message text only.
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
 * Get words in a game
 */
export async function getGameWords(groupId) {
  const { data, error } = await supabase
    .from('game_words')
    .select('*, profiles(display_name, avatar_seed)')
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
  // Supabase internally prefixes topic with 'realtime:' and REUSES existing channels
  const topic = `realtime:${channelName}`;

  // Fully remove any existing channel with the same topic first (must await)
  const existing = supabase.getChannels().find(c => c.topic === topic);
  if (existing) {
    await supabase.removeChannel(existing);
  }

  // Create fresh channel and register all listeners before subscribing
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

  // Subscribe after all listeners are registered
  channel.subscribe((status) => {
    if (callbacks.onStatus) callbacks.onStatus(status);
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get word definition cache from DB
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
 * Cache a word definition in the DB
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
export async function getGameHistory() {
  const user = await ensureAuth();
  if (!user) return [];

  const { data, error } = await supabase
    .from('game_words')
    .select(`
      *,
      groups!inner(name, code, status),
      profiles!inner(display_name)
    `)
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return data || [];
}

/**
 * Get group history (finished games)
 */
export async function getGroupHistory() {
  const user = await ensureAuth();
  if (!user) return [];

  const { data, error } = await supabase
    .from('group_members')
    .select('*, groups!inner(*)')
    .eq('player_id', user.id)
    .order('joined_at', { ascending: false });

  if (error) return [];
  return data || [];
}

// Helper: random word for fallback code generation
function randomWord() {
  const words = ['vibrant', 'clever', 'swift', 'brave', 'calm', 'eager', 'fancy',
    'grand', 'happy', 'jolly', 'keen', 'lively', 'merry', 'noble', 'proud',
    'quick', 'sharp', 'smart', 'sunny', 'witty'];
  return words[Math.floor(Math.random() * words.length)];
}

/**
 * Check if user is a member of a group
 */
export async function isGroupMember(groupId) {
  const user = await ensureAuth();
  if (!user) return false;

  const { data, error } = await supabase
    .from('group_members')
    .select('player_id')
    .eq('group_id', groupId)
    .eq('player_id', user.id)
    .single();

  return !!data;
}
