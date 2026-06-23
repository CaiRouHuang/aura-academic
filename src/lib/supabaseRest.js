const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const SESSION_KEY = 'aura_supabase_session';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSupabaseSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSupabaseSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getAuthToken() {
  return getSupabaseSession()?.access_token || SUPABASE_ANON_KEY;
}

function buildHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function parseResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.error_description || payload?.msg || payload?.message || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function signInWithPassword({ email, password }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const session = await parseResponse(response);
  setSupabaseSession(session);
  return session;
}

export async function signOutSupabase() {
  if (!isSupabaseConfigured()) {
    clearSupabaseSession();
    return;
  }

  const session = getSupabaseSession();
  if (!session?.access_token) {
    clearSupabaseSession();
    return;
  }

  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: buildHeaders(),
    });
  } finally {
    clearSupabaseSession();
  }
}

export async function selectRows(table, query = '') {
  if (!isSupabaseConfigured()) return [];
  const suffix = query ? `?${query}` : '';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${suffix}`, {
    headers: buildHeaders({ Prefer: 'return=representation' }),
  });
  return parseResponse(response);
}

export async function insertRow(table, row) {
  if (!isSupabaseConfigured()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  const rows = await parseResponse(response);
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function upsertRow(table, row, conflictTarget = 'id') {
  if (!isSupabaseConfigured()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictTarget)}`, {
    method: 'POST',
    headers: buildHeaders({
      Prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(row),
  });
  const rows = await parseResponse(response);
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function patchRow(table, id, updates) {
  if (!isSupabaseConfigured()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(updates),
  });
  const rows = await parseResponse(response);
  return Array.isArray(rows) ? rows[0] : rows;
}

export function fireAndForget(task, label = 'Supabase sync') {
  if (!isSupabaseConfigured()) return;
  Promise.resolve()
    .then(task)
    .catch(error => {
      console.warn(`[Aura] ${label} failed`, error);
      window.dispatchEvent(new CustomEvent('aura_remote_sync_error', {
        detail: { label, message: error.message || String(error) },
      }));
    });
}
