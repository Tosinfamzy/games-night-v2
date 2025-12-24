# Deployment Guide

This guide covers deploying the Games Night application using **Vercel** (frontend) and **Railway** (backend).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      PRODUCTION                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌──────────────┐         ┌──────────────────────┐     │
│   │   Vercel     │         │      Railway         │     │
│   │  (Frontend)  │────────▶│     (Backend)        │     │
│   │              │  API    │                      │     │
│   │  - React SPA │  calls  │  - NestJS API        │     │
│   │  - CDN edge  │◀────────│  - WebSocket server  │     │
│   └──────────────┘         └──────────┬───────────┘     │
│                                       │                  │
│                            ┌──────────┴───────────┐     │
│                            │                      │     │
│                    ┌───────▼──────┐  ┌───────────▼───┐  │
│                    │  PostgreSQL  │  │     Redis     │  │
│                    │  (Railway)   │  │   (Railway)   │  │
│                    └──────────────┘  └───────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- GitHub account with repositories for both frontend and backend
- Vercel account (https://vercel.com)
- Railway account (https://railway.app)

---

## Backend Deployment (Railway)

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose the `games-night-v2` repository
5. Railway will auto-detect the Dockerfile

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database" → "PostgreSQL"**
3. Railway will provision a PostgreSQL instance

### Step 3: Add Redis

1. Click **"+ New"** again
2. Select **"Database" → "Redis"**
3. Railway will provision a Redis instance

### Step 4: Configure Environment Variables

In your Railway service settings, add these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Railway uses this |
| `DB_HOST` | `${{Postgres.PGHOST}}` | Railway variable reference |
| `DB_PORT` | `${{Postgres.PGPORT}}` | Railway variable reference |
| `DB_USER` | `${{Postgres.PGUSER}}` | Railway variable reference |
| `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` | Railway variable reference |
| `DB_NAME` | `${{Postgres.PGDATABASE}}` | Railway variable reference |
| `REDIS_HOST` | `${{Redis.REDISHOST}}` | Railway variable reference |
| `REDIS_PORT` | `${{Redis.REDISPORT}}` | Railway variable reference |
| `JWT_SECRET` | `your-secure-secret` | Generate a strong secret |
| `JWT_EXPIRATION` | `15m` | |
| `JWT_REFRESH_EXPIRATION` | `7d` | |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your Vercel URL |

### Step 5: Get Railway Token for CI/CD

1. Go to Railway **Account Settings** → **Tokens**
2. Create a new token with project access
3. Add to GitHub Secrets as `RAILWAY_TOKEN`

### Step 6: Deploy

Railway automatically deploys on every push to `main`. You can also trigger manual deploys from the dashboard.

---

## Frontend Deployment (Vercel)

### Step 1: Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New" → "Project"**
3. Import the `games-nightv2-ui` repository
4. Vercel will auto-detect Vite configuration

### Step 2: Configure Environment Variables

In Vercel project settings, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://your-api.up.railway.app` | Your Railway API URL |
| `VITE_WS_URL` | `wss://your-api.up.railway.app` | WebSocket URL |

### Step 3: Get Vercel Tokens for CI/CD

1. Go to Vercel **Account Settings** → **Tokens**
2. Create a new token
3. Get your Org ID and Project ID from project settings
4. Add to GitHub Secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

### Step 4: Deploy

Vercel automatically deploys:
- **Production**: On push to `main`
- **Preview**: On every pull request

---

## GitHub Secrets Required

### Frontend Repository (`games-nightv2-ui`)

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization/user ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

### Backend Repository (`games-night-v2`)

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token |

---

## CI/CD Pipeline Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Push to   │────▶│  CI Checks  │────▶│   Deploy    │
│    main     │     │  (GitHub)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌─────▼─────┐
              │   Lint    │ │   Tests   │
              │ TypeCheck │ │ Unit/E2E  │
              └─────┬─────┘ └─────┬─────┘
                    │             │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Build    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Deploy    │
                    │  (if main)  │
                    └─────────────┘
```

---

## Health Checks

### Backend Health Endpoint

```bash
# Check if API is healthy
curl https://your-api.up.railway.app/health

# Response
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Readiness Endpoint

```bash
curl https://your-api.up.railway.app/health/ready
```

---

## Monitoring & Logs

### Railway
- View logs: Railway Dashboard → Your Service → Logs
- Metrics: Railway Dashboard → Your Service → Metrics

### Vercel
- View logs: Vercel Dashboard → Your Project → Logs
- Analytics: Vercel Dashboard → Your Project → Analytics

---

## Rollback

### Railway
1. Go to Railway Dashboard → Deployments
2. Find the previous successful deployment
3. Click **"Redeploy"**

### Vercel
1. Go to Vercel Dashboard → Deployments
2. Find the previous successful deployment
3. Click **"..." → "Promote to Production"**

---

## Estimated Costs

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Vercel | 100GB bandwidth, unlimited deploys | $20/mo (Pro) |
| Railway | $5 credit/month | ~$10-15/mo typical |
| Railway PostgreSQL | Included | ~$5/mo |
| Railway Redis | Included | ~$3/mo |

**Estimated Total:** $10-20/month for a small production app

---

## Troubleshooting

### Common Issues

**1. WebSocket connections failing**
- Ensure `FRONTEND_URL` is set correctly in Railway
- Check CORS configuration in NestJS

**2. Database connection errors**
- Verify Railway variable references are correct
- Check if PostgreSQL service is running

**3. Build failures**
- Check Node.js version matches (20.x)
- Verify all dependencies are in package.json

**4. Preview deployments not working**
- Ensure GitHub tokens have correct permissions
- Check workflow file syntax

---

## Security Checklist

- [ ] JWT_SECRET is a strong, unique value
- [ ] Environment variables are set via platform UI, not committed
- [ ] CORS is configured for production domains only
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced (automatic on both platforms)
