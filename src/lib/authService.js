import {
  clearSupabaseSession,
  isSupabaseConfigured,
  selectRows,
  signInWithPassword,
  signOutSupabase,
} from './supabaseRest';

export const PARTICIPANT_ACCOUNTS = [
  { code: 'P01', password: 'WW8J3U' },
  { code: 'P02', password: '3Z8DE4' },
  { code: 'P03', password: 'DEW2X5' },
  { code: 'P04', password: 'L98P7W' },
  { code: 'P05', password: 'XF5FUW' },
  { code: 'P06', password: 'VXJ3X4' },
  { code: 'P07', password: 'Z78JFE' },
  { code: 'P08', password: 'ZF2DST' },
  { code: 'P09', password: 'ZUTWCA' },
  { code: 'P10', password: 'SR4RG7' },
  { code: 'PLUVIA', password: '384700' },
];

const LOCAL_PRIVILEGED_ACCOUNTS = [
  {
    code: 'TEACHER',
    aliases: ['teacher', 'demo-teacher', 'teacher@aura.local'],
    password: 'TEACH1',
    role: 'teacher',
    name: 'Demo Teacher',
    email: 'teacher@aura.local',
  },
  {
    code: 'DEV',
    aliases: ['dev', 'developer', 'dev@aura.local'],
    password: 'DEVLOG',
    role: 'dev',
    name: 'Developer',
    email: 'dev@aura.local',
  },
];

export function participantEmail(code) {
  return `${String(code).trim().toLowerCase()}@aura.local`;
}

function normalizeLoginId(value) {
  return String(value || '').trim();
}

function buildLocalStudent(account) {
  return {
    id: account.code,
    participant_code: account.code,
    name: account.code,
    role: 'student',
    email: participantEmail(account.code),
    auth_provider: 'local',
  };
}

function buildLocalPrivileged(account) {
  return {
    id: account.code.toLowerCase(),
    participant_code: account.code,
    name: account.name,
    role: account.role,
    email: account.email,
    auth_provider: 'local',
  };
}

function localLogin(loginId, password) {
  const id = normalizeLoginId(loginId);
  const upper = id.toUpperCase();
  const student = PARTICIPANT_ACCOUNTS.find(account => account.code === upper);
  if (student && student.password === password) {
    return buildLocalStudent(student);
  }

  const privileged = LOCAL_PRIVILEGED_ACCOUNTS.find(account =>
    account.aliases.map(alias => alias.toLowerCase()).includes(id.toLowerCase()) || account.code === upper
  );
  if (privileged && privileged.password === password) {
    return buildLocalPrivileged(privileged);
  }

  throw new Error('帳號或密碼不正確。');
}

async function remoteProfileForUser(authUser, fallbackCode) {
  const rows = await selectRows(
    'profiles',
    `user_id=eq.${encodeURIComponent(authUser.id)}&select=*`
  );
  const profile = rows[0] || {};
  const participantCode = profile.participant_code || fallbackCode || authUser.email?.split('@')[0]?.toUpperCase();
  const role = profile.role || (participantCode === 'DEV' ? 'dev' : participantCode === 'TEACHER' ? 'teacher' : 'student');

  return {
    id: authUser.id,
    participant_code: participantCode,
    name: profile.display_name || participantCode,
    role,
    email: authUser.email,
    auth_provider: 'supabase',
  };
}

export async function loginWithExperimentAccount(loginId, password) {
  const id = normalizeLoginId(loginId);
  if (!id || !password) {
    throw new Error('請輸入帳號與密碼。');
  }

  if (!isSupabaseConfigured()) {
    return localLogin(id, password);
  }

  const upper = id.toUpperCase();
  const email = id.includes('@')
    ? id.toLowerCase()
    : upper === 'TEACHER'
      ? 'teacher@aura.local'
      : upper === 'DEV'
        ? 'dev@aura.local'
        : participantEmail(upper);

  try {
    const session = await signInWithPassword({ email, password });
    return remoteProfileForUser(session.user, upper);
  } catch (error) {
    clearSupabaseSession();
    throw new Error(error.message || '登入失敗，請確認帳號與密碼。', { cause: error });
  }
}

export async function logoutExperimentAccount() {
  if (isSupabaseConfigured()) {
    await signOutSupabase();
  } else {
    clearSupabaseSession();
  }
}
