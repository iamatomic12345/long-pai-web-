# Long Pai (ล่องไป)

```
frontend/   the web page — index.html (single bundled file), assets/, data/, images/, tools/bundle.py
backend/    Express API (auth, provinces, stories, bookings, …); also serves frontend/
```

The backend serves `frontend/` at `/`, so the whole app runs from one URL and the page
finds the API on its own origin. Details for each part: [backend/README.md](backend/README.md).

## Run locally

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, …
npm install
npm run migrate && npm run seed
npm start                 # → http://localhost:4000
```

Open http://localhost:4000 (set `FRONTEND_URL=http://localhost:4000/index.html` in `.env`).

## Deploy on Railway (from GitHub)

The repo root has `package.json` + `railway.json`, so Railway builds it with no extra settings:
`npm install` (which installs `backend/`), runs migrations and seed before each deploy,
then `npm start`, health-checked at `/health`.

1. Railway → **New Project → Deploy from GitHub repo** → pick this repo (leave Root Directory empty).
2. **Variables** — add every name from `backend/.env.example` except `PORT` (Railway sets it):
   - `DATABASE_URL` — Supabase → Connect → **Session pooler** URI (IPv4), with `?sslmode=no-verify` appended
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=stories`
   - `JWT_SECRET`, `SESSION_SECRET` — long random strings
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://<your-app>.up.railway.app/index.html`
   - Google / Facebook keys if you use those logins; their callback URLs become
     `https://<your-app>.up.railway.app/api/auth/google/callback` (and `/facebook/callback`)
3. **Settings → Networking → Generate Domain** to get the public URL, then put it in `FRONTEND_URL`.

Every push to `master` redeploys automatically.
