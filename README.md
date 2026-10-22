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

## Deploy on Render (from GitHub)

The repo root has `render.yaml` (a Render Blueprint), so Render sets the service up itself:
`npm install` (which installs `backend/`), then migrations and seed, then `npm start`,
health-checked at `/health`. The blueprint fills in `NODE_ENV`, `SUPABASE_BUCKET` and
generates `JWT_SECRET` / `SESSION_SECRET`.

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick this repo; it reads `render.yaml`.
3. Fill in the variables it asks for:
   - `DATABASE_URL` — Supabase → Connect → **Session pooler** URI (IPv4; Render can't reach
     Supabase's IPv6-only direct host), with `?sslmode=no-verify` appended
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `FRONTEND_URL=https://<your-service>.onrender.com/index.html`
   - Google / Facebook keys if you use those logins; their callback URLs become
     `https://<your-service>.onrender.com/api/auth/google/callback` (and `/facebook/callback`).
     Leave the ones you don't use blank.
4. **Apply**. The real URL shows at the top of the service page; if it differs from
   `FRONTEND_URL`, correct it under **Environment** (this redeploys).

Every push to `master` redeploys automatically. The free plan sleeps after 15 minutes
idle, so the first visit after that takes about a minute.
