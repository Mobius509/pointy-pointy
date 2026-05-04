# Pointy Points

A simple family task & points tracker. Daughter sees her daily checklist and progress toward a big goal (currently: a dog at 5,000 points). Parents share an admin view, gated by a 4–8 digit PIN, to manage tasks, award one-off bonuses, and undo entries.

Built with Next.js 15 (App Router) + Supabase + Tailwind. Deploys to Vercel free tier.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to <https://supabase.com> → new project (free tier is fine).
2. Once it's ready, open **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret — server only)
3. Create `.env.local` from the example and paste those values:
   ```bash
   cp .env.local.example .env.local
   ```

### 3. Apply the schema

In the Supabase dashboard, open **SQL Editor → New query** and run, in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/seed.sql` (sample tasks + a "Get a dog" goal at 5,000 pts; safe to skip)

### 4. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. First-run setup

1. Visit `/parent` — you'll be prompted to set a 4–8 digit PIN.
2. Use the tabs to manage tasks, set the goal, etc.
3. Hand the kid `/` (the home page).

## Daily flow

- **Kid view (`/`)** — open it, see today's checklist + the progress bar to the dog. Tap a task to mark it done; confetti plays and the bar fills up. Bigger celebration every 500 pts.
- **Parent view (`/parent`)** — PIN-gated. Tabs:
  - **Overview** — at-a-glance progress and today's totals.
  - **Tasks** — add/edit daily tasks and bonus templates, set point values, archive old ones.
  - **Award bonus** — one-tap bonus from a saved template, or a one-off.
  - **Activity** — log of every awarded point. Undo button removes a wrong award.
  - **Goal** — edit name/target, mark redeemed, start a new goal.
  - **Settings** — change PIN, set timezone (controls when the daily checklist resets).

The parent PIN unlocks for 8 hours and there's a 🔒 Lock button in the parent nav.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at <https://vercel.com/new>.
3. Add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy. Add the URL to her phone's home screen for an app-like icon.

## Notes

- **No per-user accounts** — this is a single-family app. Parent admin is gated by a PIN; the kid view is open. All writes go through Next.js Server Actions using Supabase's service-role key on the server, never the browser.
- **Time zones** — "today" is computed in the timezone you set under Settings. Default is `America/New_York`.
- **Undo** — deleting a completion in the Activity log permanently removes those points from progress. Goal progress is the running sum of completion points since the active goal started.
