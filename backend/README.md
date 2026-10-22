# longpai backend

Express + PostgreSQL API for the longpai travel app: user auth, province reference
data, per-user visited-province tracking, and traveler stories.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET
npm run migrate        # creates tables
npm run seed           # loads the 77 provinces and the tour catalog
npm start               # or: npm run dev (auto-restart)
```

Requires a running PostgreSQL instance reachable at `DATABASE_URL`. Every
variable is listed (without values) in `.env.example`.

## Deploying (Render + Supabase)

See the [root README](../README.md#deploy-on-render-from-github). In short:

- **Database**: Supabase Postgres — `DATABASE_URL` is its Session pooler URI
  with `?sslmode=no-verify`. Render runs `npm run migrate` and `npm run seed`
  in every build (both are safe to re-run).
- **Story photos**: a *public* Supabase Storage bucket (default name
  `stories`) plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally
  `SUPABASE_BUCKET`. Without them photos go to local `uploads/`, which is
  wiped on every deploy.
- **Server**: `npm start` listens on `PORT` (Render sets it). Set
  `NODE_ENV=production` and `FRONTEND_URL` to the deployed `index.html`.

## Serving the frontend

The API also serves `../frontend/` as static files (`/` → `index.html`), so one
process hosts the whole app. When `frontend/` isn't next to `backend/` the API
runs on its own.

`index.html` picks its API base without code changes:

1. `window.LONGPAI_API`, set in the deploy-config line at the top of
   `index.html`'s `<head>` — only needed when the page is hosted somewhere
   other than this server;
2. otherwise the page's own origin when it's served from a real host (the
   normal case — this server);
3. otherwise `http://localhost:4000` when opened from `localhost`,
   `127.0.0.1`, or `file://`.

Guests use the app entirely offline (localStorage); once logged in, the API is
the source of truth for points, check-ins, stories, bookings, coupons, and
favorites.

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
3. Set `FRONTEND_URL` to wherever `index.html` is served — **must be
   http/https**, not `file://` (browsers block server redirects to local
   files). Locally that's `FRONTEND_URL=http://localhost:4000/index.html`
   (this server). Its origin is also the only other one CORS allows to call
   the API from a browser. (`frontend/long pai (standalone).html` just
   forwards to `index.html`, so an older `FRONTEND_URL` keeps working until
   you update it.)
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
| GET    | /api/me                     | yes  | current user `{ id, name, email, points, role }` (role read from the database) |
| GET    | /api/auth/google            | no   | redirect to Google consent screen (501 if not configured) |
| GET    | /api/auth/google/callback   | no   | Google redirects here → redirects to `FRONTEND_URL#token=...` |
| GET    | /api/auth/facebook          | no   | redirect to Facebook consent screen (501 if not configured) |
| GET    | /api/auth/facebook/callback | no   | Facebook redirects here → redirects to `FRONTEND_URL#token=...` |
| GET    | /api/provinces              | no   | all 77 provinces (name, region, spot, …) |
| GET    | /api/provinces/visited      | yes  | provinces the current user has checked in |
| POST   | /api/provinces/:id/visited  | yes  | `{ lat, lng }` → mark visited if within 50km of the province (+50 points, idempotent) |
| DELETE | /api/provinces/:id/visited  | yes  | unmark a province (-50 points, floored at 0) |
| GET    | /api/stories                | no   | traveler story feed, newest first (`?limit=&before=`) |
| POST   | /api/stories                | yes  | multipart: `image` file (jpg/png/webp, ≤5MB) + `caption?`, `provinceId?` → new story (+20 points) |
| DELETE | /api/stories/:id            | yes  | owner or admin only (403 otherwise); removes the photo from storage; the poster loses 20 points (floored at 0) |
| GET    | /api/bookings               | yes  | your bookings, oldest first (with tour name/province) |
| POST   | /api/bookings               | yes  | `{ tourId, pax, date, contactName, phone }` → booking; total and points (1 per ฿20) are computed server-side |
| GET    | /api/coupons                | yes  | your redeemed coupons |
| POST   | /api/coupons/redeem         | yes  | `{ tierId }` → coupon with a server-generated code; deducts the tier cost atomically (400 if not enough points) |
| GET    | /api/favorites              | yes  | your favorite tour ids |
| POST   | /api/favorites/:tourId      | yes  | add a favorite (idempotent, 404 for an unknown tour) |
| DELETE | /api/favorites/:tourId      | yes  | remove a favorite |

## Story photos

`POST /api/stories` takes `multipart/form-data` (multer, held in memory). Only
jpg/png/webp up to 5MB are accepted, and the file's leading bytes must match its
type — anything else is a `400` and is never stored. The photo is then saved
under a random name:

- **Supabase Storage** when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are
  set — `image_url` is the object's public URL (bucket `SUPABASE_BUCKET`,
  default `stories`, which must be public);
- otherwise **local disk** at `uploads/stories/`, served at
  `/uploads/stories/<file>` (git-ignored; local dev only).

Deleting a story removes its photo from wherever it lives. Stories posted
before uploads keep their inline `image_data`.

## Admins

`users.role` is `user` (default) or `admin`. An admin may delete any story.
There is deliberately no API to change roles — promote someone from a terminal
on the server:

```bash
npm run make-admin -- someone@example.com
```

## Tours, bookings, and rewards

The tour catalog (`tours` table) is seeded from `db/seed/tours-data.js`, which
mirrors `LP_DATA.TOURS` in the frontend — keep the ids and prices in sync when
a tour changes. Bookings are priced from that table, so the client's
`total`/`earn` are never trusted. Reward tiers live in `src/config/rewards.js`
(mirroring the frontend's `REWARD_TIERS`); redeeming uses a conditional
`UPDATE ... WHERE points >= cost` so concurrent redeems can't overspend.

## GPS check-in verification

`POST /api/provinces/:id/visited` requires `lat`/`lng` in the body (the user's
current position) and rejects the check-in with `400 ตำแหน่งไม่ตรงกับจังหวัดนี้`
if it's more than 50km (Haversine great-circle distance) from that province's
seeded centroid (`provinces.latitude`/`longitude`). The submitted coordinates
are stored alongside the visit in `user_visited_provinces.latitude`/`longitude`.
Unmarking a visit (`DELETE`) doesn't require location — it's just removing a
record, not proving presence. Province centroids come from
[dataengineercafe/thailand-province-latitude-longitude](https://github.com/dataengineercafe/thailand-province-latitude-longitude).
