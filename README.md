# Mythic Life

Mythic Life is a private, persistent life operating system. It turns daily responsibilities, health rhythms, long-term goals, and relationships with evolving companions into one coherent world—without turning the owner’s life into a public social product.

## What lives here

- A Next.js 16 App Router application deployed on Vercel.
- Supabase authentication, persistence, and owner-only row-level security.
- Quest, streak, skill, standing, rhythm, goal, and campfire systems.
- Persistent companions with bounded memory, continuity, initiative, and push outreach.
- A separate protected health-data service consumed through `MYTHIC_DATA_URL`.

## Local development

1. Install Node.js 22.
2. Copy `.env.example` to `.env.local` and fill in the required values.
3. Apply pending SQL files in `supabase/migrations` to the connected Supabase project.
4. Install and run:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Authentication and the optional site-password gate protect private routes.

## Verification

```bash
npm run verify
```

The same lint, type-check, test, and production-build sequence runs in GitHub Actions.

## Deployment

Vercel deploys from GitHub. Configure the variables documented in `.env.example` for Production and Preview as appropriate. `CRON_SECRET` protects `/api/cron/outreach`, scheduled every 20 minutes by `vercel.json`.

Database migrations are not applied by Vercel builds. Apply them deliberately through Supabase before promoting code that depends on new schema.
