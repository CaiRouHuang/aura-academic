const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const accounts = [
  ['P01', 'WW8J3U', 'student', 'Participant P01'],
  ['P02', '3Z8DE4', 'student', 'Participant P02'],
  ['P03', 'DEW2X5', 'student', 'Participant P03'],
  ['P04', 'L98P7W', 'student', 'Participant P04'],
  ['P05', 'XF5FUW', 'student', 'Participant P05'],
  ['P06', 'VXJ3X4', 'student', 'Participant P06'],
  ['P07', 'Z78JFE', 'student', 'Participant P07'],
  ['P08', 'ZF2DST', 'student', 'Participant P08'],
  ['P09', 'ZUTWCA', 'student', 'Participant P09'],
  ['P10', 'SR4RG7', 'student', 'Participant P10'],
  ['PLUVIA', '3847', 'student', 'Participant PLUVIA'],
  ['teacher', 'TEACH1', 'teacher', 'Teacher'],
  ['dev', 'DEVLOG', 'dev', 'Developer'],
];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

console.log(`Using Supabase project URL: ${SUPABASE_URL}`);

for (const [code, password, role, displayName] of accounts) {
  const email = `${code.toLowerCase()}@aura.local`;
  const user = await createOrGetUser({ email, password, code, role, displayName });
  if (!user?.id) {
    console.warn(`Skipped profile for ${code}: user id unavailable.`);
    continue;
  }

  await upsertProfile({
    user_id: user.id,
    participant_code: code.toUpperCase(),
    role,
    display_name: displayName,
  });
  console.log(`${code} seeded as ${email}`);
}

async function createOrGetUser({ email, password, code, role, displayName }) {
  const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        participant_code: code.toUpperCase(),
        role,
        display_name: displayName,
      },
    }),
  });

  const payload = await createResponse.json().catch(() => ({}));
  if (createResponse.ok) return payload.user || payload;

  const message = JSON.stringify(payload);
  if (!/already|registered|exists/i.test(message)) {
    throw new Error(`Failed to create ${email}: ${message}`);
  }

  const listResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: adminHeaders(),
  });
  const listPayload = await listResponse.json().catch(() => ({}));
  const users = Array.isArray(listPayload?.users) ? listPayload.users : [];
  const existing = users.find(user => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    throw new Error(`User ${email} already exists but could not be found by admin list.`);
  }
  return existing;
}

async function upsertProfile(profile) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...adminHeaders(),
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upsert profile ${profile.participant_code}: ${text}`);
  }
}

function adminHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function normalizeSupabaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw.replace(/\/rest\/v1$/i, '').replace(/\/auth\/v1$/i, '');
}
