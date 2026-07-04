# longpai backend

Express + PostgreSQL API for the longpai travel app: user auth, province reference
data, per-user visited-province tracking, and traveler stories.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET
npm run migrate        # creates tables
npm run seed           # loads the 77 provinces
npm start               # or: npm run dev (auto-restart)
```

Requires a running PostgreSQL instance reachable at `DATABASE_URL`.

## Auth

Send `Authorization: Bearer <token>` on protected routes. Tokens are issued by
`/api/auth/register`, `/api/auth/login`, and the OAuth callbacks below.

### Google / Facebook login

1. Create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   and [Facebook Developer Console](https://developers.facebook.com/apps/), each with an
   authorized redirect URI matching `GOOGLE_CALLBACK_URL` / `FACEBOOK_CALLBACK_URL`
   (e.g. `http://localhost:4000/api/auth/google/callback`).
2. Fill in `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and/or
   `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` in `.env`. Leaving a pair blank disables
   that provider (its routes respond `501`).
3. Set `FRONTEND_URL` to wherever `long pai (standalone).html` is served —
   **must be http/https**, not `file://` (browsers block server redirects to
   local files). For local testing: `python3 -m http.server 8080` from the
   project folder, then `FRONTEND_URL=http://localhost:8080/long pai (standalone).html`.
4. Flow: the frontend's "เข้าสู่ระบบด้วย Google/Facebook" buttons send the
   browser to `GET /api/auth/google` (or `/facebook`) → provider consent screen
   → `GET /api/auth/*/callback` → the backend finds-or-creates the user by
   email, issues a JWT, and redirects to `${FRONTEND_URL}#token=<jwt>`
   (or `#oauth_error=<message>` on failure). The frontend reads that hash on
   load, calls `/api/auth/me` to hydrate the profile, and clears the hash.

The OAuth handshake uses a short-lived (5 min), httpOnly session cookie purely
to hold the CSRF `state` value — it's scoped to the `/api/auth/google*` and
`/api/auth/facebook*` routes only; the rest of the API stays stateless JWT.
The default in-memory session store is fine for one dev instance; swap in a
shared store (e.g. `connect-pg-simple`) before running multiple processes.

## Endpoints

| Method | Path                        | Auth | Description                          |
|--------|-----------------------------|------|--------------------------------------|
| POST   | /api/auth/register          | no   | `{ name, email, password }` → token + user |
| POST   | /api/auth/login             | no   | `{ email, password }` → token + user |
| GET    | /api/auth/me                | yes  | current user profile + points        |
| GET    | /api/auth/google            | no   | redirect to Google consent screen (501 if not configured) |
| GET    | /api/auth/google/callback   | no   | Google redirects here → redirects to `FRONTEND_URL#token=...` |
| GET    | /api/auth/facebook          | no   | redirect to Facebook consent screen (501 if not configured) |
| GET    | /api/auth/facebook/callback | no   | Facebook redirects here → redirects to `FRONTEND_URL#token=...` |
| GET    | /api/provinces              | no   | all 77 provinces (name, region, spot, grid position) |
| GET    | /api/provinces/visited      | yes  | provinces the current user has checked in |
| POST   | /api/provinces/:id/visited  | yes  | mark a province visited (+50 points, idempotent) |
| DELETE | /api/provinces/:id/visited  | yes  | unmark a province (-50 points, floored at 0) |
| GET    | /api/stories                | no   | traveler story feed, newest first (`?limit=&before=`) |
| POST   | /api/stories                | yes  | `{ provinceId?, caption?, emoji?, image }` → new story (+20 points) |
| DELETE | /api/stories/:id            | yes  | delete your own story (403 if not the owner, -20 points floored at 0) |

`image` is expected as a data URL string (matching the frontend's client-side
downscaled JPEG output), stored as-is. For heavier traffic, swap `image_data`
for an object-storage URL instead of storing base64 in Postgres.
