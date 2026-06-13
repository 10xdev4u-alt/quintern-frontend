# Quintern UI

Frontend for **Quintern** — an intern management system. Built with **React + Vite + Tailwind CSS**, deployed on **Vercel**.

## Tech Stack

| Component | Tech |
|-----------|------|
| Framework | React 18 |
| Build | Vite |
| Styling | Tailwind CSS |
| State | Zustand + React Query |
| Hosting | Vercel (serverless) |

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` — connects to backend at `http://localhost:5000/api`.

## Deploy to Vercel

1. Connect your GitHub repo to Vercel
2. Set Root Directory = `frontend`
3. Set env var: `VITE_API_BASE=https://<your-backend-url>/api`
4. Deploy (Vite auto-detected)

Full guide: [`VERCEL_SERVERLESS.md`](./VERCEL_SERVERLESS.md)

## Project Structure

```
frontend/
  src/
    App.jsx            — Root app with routing
    main.jsx           — Entry point
    index.css          — Global styles + Tailwind
    components/        — UI components
    pages/             — Route pages
    lib/               — API client, helpers
    store/             — Zustand stores
  public/              — Static assets
  index.html           — HTML shell
```

## Pages

| Route | Page |
|-------|------|
| `/` | Home / Dashboard |
| `/login` | Login |
| `/attendance` | Mark attendance |
| `/meetings` | View meetings |
| `/ratings` | Submit ratings |
| `/team` | Team view |
| `/projects` | Projects |
| `/tasks` | Social tasks |
| `/profile` | User profile |
| `/notifications` | Notifications |
| `/admin/*` | Admin dashboard, analytics, exports |

## Features

- **Attendance tracking** — Mark in/out, bulk operations
- **Meeting management** — Schedule and view
- **Rating system** — Peer and manager ratings
- **Team hierarchy** — Org chart view
- **Project management** — Track intern projects
- **Social tasks** — Assign and complete tasks
- **Notifications** — Real-time via WebSocket
- **Admin panel** — Analytics, reports, user management

---

Built for the Quintern platform.
