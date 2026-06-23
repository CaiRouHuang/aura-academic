import { fireAndForget, insertRow, isSupabaseConfigured, patchRow, selectRows, upsertRow } from './supabaseRest';

export const REMOTE_TABLES = {
  PROJECTS: 'projects',
  CHECKPOINTS: 'checkpoints',
  SUBMISSIONS: 'submissions',
  AI_REVIEWS: 'ai_reviews',
  SCORING_SESSIONS: 'scoring_sessions',
  SCORE_ENTRIES: 'score_entries',
  ACTIVITY_LOGS: 'activity_logs',
  ASSIGNMENTS: 'assignments',
  CONSENTS: 'participant_consents',
  SRL_PROBES: 'srl_probe_responses',
  RESEARCH_EVENTS: 'research_events',
};

const LOCAL_KEY_BY_REMOTE_TABLE = {
  [REMOTE_TABLES.PROJECTS]: 'aura_projects',
  [REMOTE_TABLES.CHECKPOINTS]: 'aura_checkpoints',
  [REMOTE_TABLES.SUBMISSIONS]: 'aura_submissions',
  [REMOTE_TABLES.AI_REVIEWS]: 'aura_ai_reviews',
  [REMOTE_TABLES.SCORING_SESSIONS]: 'aura_scoring_sessions',
  [REMOTE_TABLES.SCORE_ENTRIES]: 'aura_score_entries',
  [REMOTE_TABLES.ACTIVITY_LOGS]: 'aura_activity_logs',
  [REMOTE_TABLES.ASSIGNMENTS]: 'aura_assignments',
  [REMOTE_TABLES.CONSENTS]: 'aura_consents',
  [REMOTE_TABLES.SRL_PROBES]: 'aura_srl_probe_responses',
  [REMOTE_TABLES.RESEARCH_EVENTS]: 'aura_research_events',
};

function setLocalStore(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows || []));
  window.dispatchEvent(new CustomEvent('aura_storage_change', { detail: { key } }));
}

function normalizeRows(table, rows) {
  if (table !== REMOTE_TABLES.ASSIGNMENTS) return rows || [];
  return (rows || []).map(row => ({ visibility: 'all', ...row }));
}

export async function hydrateRemoteDataToLocal() {
  if (!isSupabaseConfigured()) return false;

  const tables = [
    REMOTE_TABLES.ASSIGNMENTS,
    REMOTE_TABLES.PROJECTS,
    REMOTE_TABLES.CHECKPOINTS,
    REMOTE_TABLES.SUBMISSIONS,
    REMOTE_TABLES.AI_REVIEWS,
    REMOTE_TABLES.SCORING_SESSIONS,
    REMOTE_TABLES.SCORE_ENTRIES,
    REMOTE_TABLES.ACTIVITY_LOGS,
    REMOTE_TABLES.CONSENTS,
    REMOTE_TABLES.SRL_PROBES,
    REMOTE_TABLES.RESEARCH_EVENTS,
  ];

  await Promise.all(tables.map(async table => {
    const rows = await selectRows(table, 'select=*');
    setLocalStore(LOCAL_KEY_BY_REMOTE_TABLE[table], normalizeRows(table, rows));
  }));

  return true;
}

export function mirrorInsert(table, row, label) {
  fireAndForget(() => insertRow(table, row), label || `insert ${table}`);
}

export function mirrorUpsert(table, row, conflictTarget = 'id', label) {
  fireAndForget(() => upsertRow(table, row, conflictTarget), label || `upsert ${table}`);
}

export function mirrorPatch(table, id, updates, label) {
  fireAndForget(() => patchRow(table, id, updates), label || `patch ${table}`);
}

export function localKeyForRemoteTable(table) {
  return LOCAL_KEY_BY_REMOTE_TABLE[table];
}
