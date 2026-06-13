# ▲ Quintern Frontend — Vercel Deployment Guide

> Deploy the **Quintern UI** on Vercel for **$0/month** — instant CDN, auto SSL, zero config.

**Repo:** [`10xdev4u-alt/quintern-frontend`](https://github.com/10xdev4u-alt/quintern-frontend)

---

## Step-by-step (5 minutes)

### Step 1 · Create a Vercel project

1. Go to **[vercel.com](https://vercel.com)** → **Sign in with GitHub**
2. **Add New** → **Project**
3. Import **`10xdev4u-alt/quintern-frontend`**

### Step 2 · Configure

| Setting | Value |
|---------|-------|
| Framework Preset | `Vite` (auto-detected) |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### Step 3 · Add environment variable

Add this **one** env var:

```env
VITE_API_BASE=https://<your-backend-url>.up.railway.app/api
```

> Replace `<your-backend-url>` with your Railway backend URL (e.g. `https://quintern-api.up.railway.app`).

### Step 4 · Deploy

Click **Deploy** → Vercel builds and serves the SPA on a `.vercel.app` domain in ~30 seconds.

---

## ✅ Verify

```bash
FRONTEND=https://<your-project>.vercel.app

# Open in browser
open $FRONTEND
```

You should see the login page. Sign in with `admin@internops.com` / `Admin@123`.

---

## ⚙️ What's in the repo

| File | Purpose |
|------|---------|
| `vercel.json` | SPA rewrites, security headers, cache control |
| `frontend/` | React + Vite + Tailwind — all pages, components, stores |
| `frontend/src/lib/axios.js` | API client — uses `VITE_API_BASE` |
| `frontend/src/store/auth.js` | JWT auth state (Zustand) |

---

## 🔗 Connecting to the backend

1. **Frontend env var:** `VITE_API_BASE` = your Railway backend URL + `/api`
2. **Backend env var:** `CORS_ORIGIN` = your Vercel frontend URL
3. That's it — everything else is wired up

---

## 💰 Cost

| Item | Cost |
|------|------|
| Frontend (Vercel Hobby) | **$0** |
| Bandwidth | 100 GB/mo free |
| Builds | 6,000 min/mo free |
| **Total** | **$0/month** |
