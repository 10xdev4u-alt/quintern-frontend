# ▲ Quintern · Vercel Serverless Deployment

> Deploy the **entire Quintern stack** on Vercel for **$0/month** — no Docker,
> no sleeping, no server management.

Vercel natively supports Fastify in 2026. No adapters (`@fastify/aws-lambda`,
`serverless-http`) needed — Vercel auto-detects it from `backend/src/app.js`
and wraps it as a serverless function with Fluid Compute.

**Cost: $0/month** (Vercel Hobby + Neon free Postgres + Upstash free Redis).

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │         Vercel Edge Network (CDN)         │
                    │                                          │
                    │  Frontend (SPA)      Backend (Fastify)    │
                    │  quintern.vercel.app  backend.vercel.app  │
                    │  Vite build,          Auto-detected       │
                    │  served as static     serverless fn       │
                    └────────┬────────────────────┬─────────────┘
                             │                    │
                    ┌────────▼─────┐    ┌─────────▼──────────┐
                    │  Neon (PG)   │    │  Upstash (Redis)    │
                    │  Free tier   │    │  10k cmd/day free   │
                    │  0.5GB       │    │  REST API, no TCP   │
                    └──────────────┘    └─────────────────────┘
```

---

## Step-by-step deploy

### Step 1 · Fork (or prepare) the repo

Ensure your repo is pushed to GitHub so Vercel can access it.

### Step 2 · Deploy the backend (Vercel project #1)

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your Quintern repo
3. **Configure project:**
   - **Framework Preset**: `Other` (Vercel auto-detects Fastify)
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci --omit=dev` (leave default)
   - **Output Directory**: leave blank
4. **Environment Variables** — add these:

```env
NODE_ENV=production
JWT_SECRET=<generate: openssl rand -base64 48 | tr -d '\n'>
JWT_ACCESS_SECRET=<generate another>
JWT_REFRESH_SECRET=<generate another>
CSRF_SECRET=<generate another>
API_KEY=<generate another>
CORS_ORIGIN=https://<your-frontend-url>.vercel.app
DATABASE_URL=<from Neon, see step 4>
AI_PROVIDER=heuristic
RESEND_API_KEY=<from resend.com, optional>
EMAIL_FROM=Quintern <noreply@quintern.com>
```

5. Click **Deploy**
6. Vercel detects `src/app.js` → recognizes Fastify → wraps it as a serverless function
   > **If auto-detection doesn't work:** select **Framework Preset → Other**. Vercel's `@vercel/node` runtime handles Fastify natively even without explicit detection.
7. You get a URL like `https://<your-project-name>.vercel.app` (Vercel assigns a random-ish subdomain based on your project name)

### Step 3 · Deploy the frontend (Vercel project #2)

Same Vercel account, separate project:

1. **Add New** → **Project** → import same repo
2. **Configure project:**
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variable:**
   - `VITE_API_BASE` = `https://<your-backend-url>.vercel.app/api`
4. Click **Deploy**
5. You get a URL like `https://<your-project-name>.vercel.app`

### Step 4 · Set up Neon (PostgreSQL)

1. Go to [neon.tech](https://neon.tech) → Sign in with GitHub
2. **New Project** → `quintern` → **AWS US East** (or closest region)
3. Copy the connection string:
   ```
   postgresql://neondb_owner:<password>@ep-xxx.us-east-2.aws.neon.tech/quintern?sslmode=require
   ```
4. Paste it as `DATABASE_URL` in your Vercel backend project's env vars

### Step 5 · Set up Upstash (Redis — optional)

1. Go to [upstash.com](https://upstash.com) → Sign in with GitHub
2. **Create Database** → `quintern` → **US East**
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Add both to your Vercel backend env vars

### Step 6 · Run migrations

Vercel doesn't have a shell. You have two options:

**Option A: Run locally against your Neon DB**
```bash
# First, install backend deps
cd backend && npm ci

# Then run migrations + seed against your Neon database
DATABASE_URL="<your-neon-url>" node src/db/migrate.js
DATABASE_URL="<your-neon-url>" node seeds/seed.js
```

> **Note:** Run these from the `backend/` directory (where `package.json` lives) so `node_modules` is found correctly.

**Option B: Create a one-shot migration endpoint (not recommended for prod)**

### Step 7 · Verify

```bash
# Replace with your actual Vercel URLs
BACKEND=https://<your-backend-url>.vercel.app
FRONTEND=https://<your-frontend-url>.vercel.app

# Health check
curl -fsS $BACKEND/health
# → {"status":"ok","db":"connected","redis":"disabled"}

# Login
curl -fsS -X POST $BACKEND/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@internops.com","password":"Admin@123"}'
# → {"accessToken":"...", "user":{...}}

# Open frontend
open $FRONTEND
```

---

## What's included

| Feature | Status | Notes |
|---------|--------|-------|
| Fastify auto-detection | ✅ | Vercel detects `src/app.js` as Fastify |
| All API routes | ✅ | All `/api/*` routes work as serverless functions |
| WebSocket | ❌ | Vercel serverless doesn't support persistent WS |
| File uploads | ❌ | No persistent filesystem — use S3/R2 for production |
| Cron jobs | ✅ | Guarded with `!process.env.VERCEL` |
| Database (Neon) | ✅ | Connection pooling works with serverless |
| Redis (Upstash) | ✅ | REST API, no TCP needed |
| AI assistant | ✅ | Works — heuristic fallback without API keys |

### Things that differ from Docker deployment

| Docker (old) | Vercel (new) |
|-------------|--------------|
| Persistent filesystem | Ephemeral — no file uploads |
| WebSocket real-time | Polling fallback for notifications |
| Cron job hourly cleanup | Not needed (no file uploads) |
| Always-on process | Per-request invocation |

---

## Cost breakdown

| Service      | Plan    | Cost |
|--------------|---------|------|
| Backend (Vercel) | Hobby  | $0   |
| Frontend (Vercel) | Hobby | $0   |
| PostgreSQL (Neon) | Free   | $0   |
| Redis (Upstash)   | Free   | $0   |
| Email (Resend)    | Free   | $0 (3k/mo) |
| **Total**    |         | **$0/month** |

**Limits:** Vercel Hobby — 100k requests/day, 10s execution (30s with Fluid Compute),
100GB bandwidth. Neon Free — 0.5GB storage, 191h compute. Upstash Free — 10k cmd/day.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `500: INTERNAL SERVER ERROR` | Check Vercel function logs (Dashboard → Function Logs) |
| `DATABASE_URL` not found | Ensure env var is set in Vercel dashboard, not in `.env` |
| CORS errors in browser | Set `CORS_ORIGIN` to your exact frontend URL |
| Cold start is slow | Vercel Fluid Compute keeps a pool warm — first request ~1s |
| "Missing JWT_SECRET" | Generate it: `openssl rand -base64 48 \| tr -d '\n'` |
