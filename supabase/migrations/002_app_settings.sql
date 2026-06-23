-- Aura Academic: Global App Settings table
-- Run this in Supabase SQL Editor AFTER 001_experiment_schema.sql

create table if not exists public.app_settings (
  id text primary key default 'global',
  ai_provider text not null default 'nvidia',
  ai_api_key text not null default '',
  ai_model text not null default 'custom',
  ai_custom_model text not null default 'moonshotai/kimi-k2.6',
  ai_base_url text not null default 'https://integrate.api.nvidia.com/v1',
  language text not null default 'zh',
  updated_at timestamptz not null default now()
);

-- Insert default settings row with pre-configured values
insert into public.app_settings (id, ai_provider, ai_api_key, ai_model, ai_custom_model, ai_base_url, language)
values (
  'global',
  'nvidia',
  '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',
  'custom',
  'moonshotai/kimi-k2.6',
  'https://integrate.api.nvidia.com/v1',
  'zh'
)
on conflict (id) do nothing;

-- Enable Row Level Security
alter table public.app_settings enable row level security;

-- Allow all authenticated users to read settings
create policy "authenticated_read_app_settings"
  on public.app_settings for select to authenticated using (true);

-- Allow all authenticated users to update settings (DEV will use this)
create policy "authenticated_update_app_settings"
  on public.app_settings for update to authenticated using (true) with check (true);

-- Allow insert (for initial seed)
create policy "authenticated_insert_app_settings"
  on public.app_settings for insert to authenticated with check (true);
