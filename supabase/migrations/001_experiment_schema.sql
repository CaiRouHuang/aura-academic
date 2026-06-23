-- Aura Academic experiment schema
-- Run this in Supabase SQL Editor before seeding users.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_code text unique not null,
  role text not null check (role in ('student', 'teacher', 'dev')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.participant_consents (
  id text primary key,
  user_id text not null,
  participant_code text not null,
  consent_version text not null,
  consented_at timestamptz not null,
  profile_form_confirmed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.assignments (
  id text primary key,
  teacher_id text not null,
  title text not null,
  requirement_description text,
  scoring_criteria text,
  global_deadline text,
  visibility text not null default 'all' check (visibility in ('all', 'private')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  assignment_id text,
  title text not null,
  description text,
  expected_deliverable text,
  team_members text,
  deadline text,
  gantt_file_url text,
  status text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.checkpoints (
  id text primary key,
  project_id text not null,
  order_index integer,
  title text not null,
  goal_description text,
  expected_deliverable text,
  due_date text,
  weight_percent integer,
  status text,
  strategy_prompt text,
  self_check_questions jsonb not null default '[]'::jsonb,
  convergence_focus text,
  help_seeking_hint text,
  criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id text primary key,
  checkpoint_id text not null,
  submitted_by text not null,
  version integer,
  file_urls jsonb not null default '[]'::jsonb,
  files_data jsonb not null default '[]'::jsonb,
  description text,
  submitted_at timestamptz not null default now()
);

create table if not exists public.ai_reviews (
  id text primary key,
  submission_id text not null,
  completion_rate integer,
  criteria_results jsonb not null default '[]'::jsonb,
  reflection_questions jsonb not null default '[]'::jsonb,
  overall_comment text,
  suggestions text,
  encouragement text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.srl_probe_responses (
  id text primary key,
  user_id text not null,
  participant_code text not null,
  project_id text,
  checkpoint_id text,
  submission_id text,
  probe_key text not null,
  prompt text,
  rating integer,
  response_text text,
  submitted_at timestamptz not null default now()
);

create table if not exists public.research_events (
  event_id text primary key,
  event_type text not null,
  timestamp timestamptz not null,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.activity_logs (
  id text primary key,
  project_id text not null,
  action_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scoring_sessions (
  id text primary key,
  project_id text not null,
  reviewer_id text not null,
  reviewer_role text,
  status text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.score_entries (
  id text primary key,
  session_id text not null,
  dimension text not null,
  score integer,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.participant_consents enable row level security;
alter table public.assignments enable row level security;
alter table public.projects enable row level security;
alter table public.checkpoints enable row level security;
alter table public.submissions enable row level security;
alter table public.ai_reviews enable row level security;
alter table public.srl_probe_responses enable row level security;
alter table public.research_events enable row level security;
alter table public.activity_logs enable row level security;
alter table public.scoring_sessions enable row level security;
alter table public.score_entries enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'participant_consents',
    'assignments',
    'projects',
    'checkpoints',
    'submissions',
    'ai_reviews',
    'srl_probe_responses',
    'research_events',
    'activity_logs',
    'scoring_sessions',
    'score_entries'
  ]
  loop
    execute format('drop policy if exists "authenticated_read_%1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "authenticated_insert_%1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "authenticated_update_%1$s" on public.%1$I', table_name);
    execute format('create policy "authenticated_read_%1$s" on public.%1$I for select to authenticated using (true)', table_name);
    execute format('create policy "authenticated_insert_%1$s" on public.%1$I for insert to authenticated with check (true)', table_name);
    execute format('create policy "authenticated_update_%1$s" on public.%1$I for update to authenticated using (true) with check (true)', table_name);
  end loop;
end $$;
