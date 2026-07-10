# Noorix Staging Deployment Runbook

This runbook keeps staging isolated from live production.

## What Was Added

- `.github/workflows/deploy-staging.yml`
- `deploy/staging-remote-install.sh`

The staging workflow is manual only. It deploys a selected branch or commit to:

- app root: `/var/www/noorix-staging`
- frontend root: `/var/www/noorix-staging/dist`
- backend root: `/var/www/noorix-staging/backend`
- service: `noorix-staging-backend`
- default API port: `3001`

## Required GitHub Secrets

Preferred dedicated staging secrets:

- `STAGING_HOST`
- `STAGING_USERNAME`
- `STAGING_SSH_KEY`
- `STAGING_SSH_PORT` optional, defaults to `22`

If those are not configured, the workflow falls back to the existing live server SSH secrets:

- `VPS_HOST`
- `VPS_USERNAME`
- `VPS_SSH_KEY`
- `VPS_SSH_PORT` optional

This fallback only reuses the SSH entrance to the same server. The staging installer still refuses the live app root, live API port, and live database name.

## Required Server File

Create this file on the staging server before the first run:

```bash
sudo mkdir -p /var/www/noorix-staging/backend
sudo nano /var/www/noorix-staging/backend/.env
```

Minimum example:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/noorix_staging
JWT_SECRET=replace-with-a-strong-staging-secret
CORS_ORIGIN=https://staging.example.com
```

Do not point staging to the live `noorix` database. The staging installer refuses the default live database name.

## Run

1. Open GitHub Actions.
2. Choose `Deploy Staging`.
3. Click `Run workflow`.
4. Use:
   - `ref`: `codex/centralize-filter-system`
   - `app_root`: `/var/www/noorix-staging`
   - `api_port`: `3001`
   - `public_url`: staging domain if available

## After Deployment

Validate these flows before merging to live:

- invoices list filters, cancelled invoice toggle, print/PDF
- day close report
- HR contract, salary certificate, final settlement PDF/save
- general report V2 and profit/loss report
- dashboard and core navigation
