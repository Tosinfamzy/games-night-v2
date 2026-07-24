# Deploy Runbook — Games Night v2

A step-by-step checklist to take the app from "green locally" to "live for games night".
This is the actionable companion to [DEPLOYMENT.md](DEPLOYMENT.md) (which explains the
architecture). Work top to bottom; each step has a check you can verify before moving on.

**Stack:** backend (`games-night-v2`) → Railway + Postgres + Redis · frontend
(`games-nightv2-ui`) → Vercel.

> Target runtime is **Node 22** (both repos). Ignore any "Node 20" mention in the older
> DEPLOYMENT.md — it's stale.

---

## 0. Pre-flight (local — already verified)

- [x] Backend builds, lints clean, 311 unit tests pass
- [x] Frontend builds, 211 unit tests pass
- [x] Both `.env` files are gitignored (no secrets tracked)

---

## 1. Backend → Railway

### 1a. Create the services
1. [Railway dashboard](https://railway.app/dashboard) → **New Project** → **Deploy from GitHub repo** → `Tosinfamzy/games-night-v2`. Railway auto-detects the `Dockerfile`.
2. **+ New → Database → PostgreSQL**.
3. **+ New → Database → Redis**.

### 1b. Set backend environment variables
In the backend service → **Variables**, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_HOST` | `${{Postgres.PGHOST}}` |
| `DB_PORT` | `${{Postgres.PGPORT}}` |
| `DB_USER` | `${{Postgres.PGUSER}}` |
| `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `DB_NAME` | `${{Postgres.PGDATABASE}}` |
| `REDIS_HOST` | `${{Redis.REDISHOST}}` |
| `REDIS_PORT` | `${{Redis.REDISPORT}}` |
| `REDIS_PASSWORD` | `${{Redis.REDISPASSWORD}}` (if the Redis plugin sets one) |
| `JWT_SECRET` | **generate a fresh one** — see below |
| `JWT_EXPIRATION` | `15m` |
| `JWT_REFRESH_EXPIRATION` | `7d` |
| `FRONTEND_URL` | your Vercel URL (fill in after step 2, then redeploy) |

**Generate a production `JWT_SECRET`** (do NOT reuse the placeholder from `.env.example`,
and never commit the value anywhere — paste it straight into the Railway Variables UI):
```bash
openssl rand -base64 48
```

> Migrations run automatically on boot (`migrationsRun`), and `synchronize` stays **off** in
> production — no manual migration step needed.

### 1c. Deploy & verify
- Railway deploys on push to `main`. Wait for the build to go green.
- Copy the public backend URL (e.g. `https://games-night-v2-production.up.railway.app`).
- **Check:**
  ```bash
  curl https://<your-railway-url>/v1/health
  ```
  Expect a `200` with a status/uptime payload. (Health path is `/v1/health`, per `railway.toml`.)

### 1d. Optional CI/CD token
- Railway **Account → Tokens** → create a token → add to the **backend** GitHub repo secrets as `RAILWAY_TOKEN`.

---

## 2. Frontend → Vercel

1. [Vercel dashboard](https://vercel.com/dashboard) → **Add New → Project** → import `Tosinfamzy/games-nightv2-ui`. It auto-detects Vite (config is in `vercel.json`).
2. **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | your Railway backend URL from step 1c (e.g. `https://<your-railway-url>`) |

   > Only `VITE_API_URL` is needed — the WebSocket URL is derived from it in code. Ignore the
   > old `VITE_WS_URL` reference in DEPLOYMENT.md.
3. **Deploy.** Copy the resulting Vercel URL.
4. Go back to Railway → set `FRONTEND_URL` to that Vercel URL → redeploy the backend (so CORS + WebSocket origins allow it).

### 2a. Optional CI/CD tokens
- Vercel **Account → Tokens** → create `VERCEL_TOKEN`; grab **Org ID** and **Project ID** from project settings.
- Add to the **frontend** GitHub repo secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
  (The frontend `deploy.yml` waits for CI's **Build** check, then deploys.)

---

## 3. End-to-end smoke test (before the event)

- [ ] `curl <railway-url>/v1/health` → 200
- [ ] Open the Vercel URL → app loads, no console CORS errors
- [ ] Sign up / log in (JWT flow works)
- [ ] Create a session as games master → get a join code
- [ ] Join from a second device/browser with the code
- [ ] Assign teams, start a game, award a score → **live update appears on both clients** (WebSocket OK)
- [ ] Send a chat message → appears in real time

If WebSocket updates don't arrive: 99% of the time `FRONTEND_URL` on Railway doesn't exactly
match the Vercel origin (scheme + host, no trailing slash).

---

## 4. Nice-to-haves (not blockers for games night)

- [ ] Work through the Dependabot backlog (~35 open branches) — majors are intentionally held; the safe patch/minor ones can be batched.
- [ ] Refresh `docs/DEPLOYMENT.md` Node version (20 → 22).
- [ ] Custom domain on Vercel/Railway if you want a friendlier URL for guests.
