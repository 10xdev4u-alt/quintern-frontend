# 🚆 Quintern · Railway Deployment Guide

> Deploy Quintern to Railway for **$0-5/month** — no sleep, no Docker hassle.

Railway's free tier gives you **$5 in monthly credits** — enough to run the
Quintern backend + PostgreSQL 24/7 with no sleeping. Unlike Render/Zeabur,
the service stays awake as long as it's within the credit budget.

---

## One-click deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/quintern)

Or follow the manual steps below.

---

## Manual setup (10 minutes)

### Step 1 · Sign up + create project

1. Go to **[railway.app](https://railway.app)** → **Sign in with GitHub**
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select `rajat-wyrm/Quintern`
4. Railway auto-detects Node.js and reads `railway.json` from the repo root

### Step 2 · Add PostgreSQL

1. In your project dashboard, click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway creates a Postgres instance and auto-injects `DATABASE_URL` into the backend
3. That's it — the backend picks it up automatically

### Step 3 · Add environment variables

Go to your backend service → **Variables** tab → add these:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=<generate a random 32+ char string>
JWT_ACCESS_SECRET=<generate another>
JWT_REFRESH_SECRET=<generate another>
CSRF_SECRET=<generate another>
CORS_ORIGIN=https://<your-vercel-url>.vercel.app
AI_PROVIDER=heuristic
RESEND_API_KEY=re_xxxxxxxxxxxx  # optional — for password reset emails
EMAIL_FROM=Quintern <noreply@quintern.com>
```

**Generate secrets:**
```bash
# Run this in your terminal:
openssl rand -base64 48 | tr -d '\n'
# Do it 4 times for each JWT_* + CSRF secret
```

### Step 4 · Set root directory

Railway needs to know the backend is in the `backend/` subdirectory:

1. Go to your backend service → **Settings** tab
2. In **Root Directory**, type: `backend`
3. Railway will rebuild with the correct context

### Step 5 · Run migrations

1. Go to your backend service → **"Shell"** tab (or use Railway CLI)
2. Run:
```bash
node src/db/migrate.js
node seeds/seed.js
```

### Step 6 · Set up the frontend (Vercel)

Keep the frontend on Vercel — it's a static site and Vercel is the best host for that:

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import `rajat-wyrm/Quintern`
3. Set **Root Directory** = `frontend`
4. Set **Environment Variable**:
   - `VITE_API_BASE` = `https://quintern-api.up.railway.app/api`
5. Click **Deploy**

---

## Post-deploy checks

```bash
# Replace with your actual Railway URL
BACKEND=https://quintern-api.up.railway.app
FRONTEND=https://quintern.vercel.app

# 1. Health
curl -fsS $BACKEND/health
# → {"status":"ok","db":"connected","redis":"disabled"}

# 2. Login
curl -fsS -X POST $BACKEND/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@internops.com","password":"Admin@123"}'
# → {"accessToken":"...", "user":{...}}

# 3. Open the frontend
open $FRONTEND
```

---

## What's included in this repo

- [`railway.json`](railway.json) — Railway config (build + deploy settings)
- [`backend/package.json`](backend/package.json) — `start` script for production
- [`backend/src/config/index.js`](backend/src/config/index.js) — env vars mapped to config

---

## Cost breakdown

| Service      | Plan    | Cost     |
|--------------|---------|----------|
| Backend      | Railway Hobby | ~$5/mo credits (free for low traffic) |
| PostgreSQL   | Railway Hobby | Included in credits |
| Frontend     | Vercel Hobby  | $0       |
| Redis        | Upstash Free  | $0       |
| **Total**    |         | **$0-5/mo** |

Railway's Hobby plan gives $5/mo in free usage credits. The Quintern backend
running 24/7 uses about $3-4/mo of credits, so you stay within the free budget.

---

## Going beyond free

| Need                    | Upgrade                        | Cost      |
|-------------------------|--------------------------------|-----------|
| More backend resources  | Railway Developer ($10/mo)     | $10/mo    |
| No credit monitoring    | Railway Team ($20/mo)          | $20/mo    |
| Custom domain + SSL     | Included in all plans          | $0        |
| PostgreSQL backups      | Included with Postgres plugin  | $0        |
