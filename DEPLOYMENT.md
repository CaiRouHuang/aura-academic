# NAVI Experiment Deployment

This build is designed for the free tiers of Supabase and Vercel.

## 1. Supabase

1. Create a free Supabase project.
2. Open SQL Editor and run `supabase/migrations/001_experiment_schema.sql`.
3. Copy the Project URL and anon key from Project Settings > API.
   - Use the project root URL, for example `https://your-project.supabase.co`.
   - Do not use `https://your-project.supabase.co/rest/v1/` for `SUPABASE_URL`.
4. Copy the service role key only for local seeding. Do not put it in Vercel browser env.
5. Seed accounts locally:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
npm run seed:supabase-users
```

Windows PowerShell:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
npm run seed:supabase-users
```

Seeded accounts:

| Account | Password | Role |
| --- | --- | --- |
| P01 | WW8J3U | student |
| P02 | 3Z8DE4 | student |
| P03 | DEW2X5 | student |
| P04 | L98P7W | student |
| P05 | XF5FUW | student |
| P06 | VXJ3X4 | student |
| P07 | Z78JFE | student |
| P08 | ZF2DST | student |
| P09 | ZUTWCA | student |
| P10 | SR4RG7 | student |
| teacher | TEACH1 | teacher |
| dev | DEVLOG | dev |

## 2. Vercel

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. Set framework preset to Vite.
4. Set root directory to this folder if the repo contains more than this app: `0.INDEX/aura-academic`.
5. Build command: `npm run build`.
6. Output directory: `dist`.

Set these Vercel environment variables:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AI_BASE_URL=https://integrate.api.nvidia.com/v1
VITE_AI_MODEL=meta/llama-3.1-70b-instruct
VITE_PROFILE_FORM_URL=https://forms.gle/your-profile-form
VITE_POST_FORM_URL=https://forms.gle/your-post-form
NVIDIA_API_KEY=your-nvidia-api-key
AI_BASE_URL=https://integrate.api.nvidia.com/v1
```

`NVIDIA_API_KEY` is server-only. It is used by `api/ai/chat-completions.js` and is not sent from the browser.

## 3. Local Test

Create `.env.local` from `.env.example`, then run:

```bash
npm install
npm run dev
```

If Supabase env is missing, the app falls back to localStorage demo mode.

## 4. Production Smoke Test

1. Login with `P01`.
2. Complete consent and the profile form confirmation.
3. Login as `teacher` and create an assignment.
4. Login with `P01` through `P10` and confirm the assignment is visible.
5. Create a project, generate checkpoints, answer SRL probe #1.
6. Upload a checkpoint submission, receive AI feedback, answer SRL probe #2.
7. Complete all checkpoints, answer SRL probe #3, open the post form link.
8. Login as `dev`, open research log, export JSON/CSV.

## Notes

The migration uses broad authenticated read/write RLS policies so the experiment can run quickly on the free tier. For a stricter production study, replace these policies with participant-scoped policies for student data and teacher/dev-only policies for research logs.
