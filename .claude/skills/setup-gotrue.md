# Setting Up GoTrue (Supabase Auth Service)

## Overview
GoTrue is the authentication service used by Supabase. This skill describes how to download, configure, and run GoTrue locally for development and testing.

## Prerequisites
- PostgreSQL running with Supabase-compatible schema (see [setup-local-postgres.md](setup-local-postgres.md))
- Node.js (for JWT generation)

## Step 1: Download GoTrue Binary

GoTrue is now part of the `supabase/auth` repository. Download the appropriate binary for your platform:

**Linux x86_64:**
```bash
curl -L https://github.com/supabase/auth/releases/latest/download/auth-v2.186.0-x86.tar.gz -o auth.tar.gz
tar -xzf auth.tar.gz
rm auth.tar.gz
chmod +x auth
```

**macOS ARM64 (Apple Silicon):**
```bash
curl -L https://github.com/supabase/auth/releases/latest/download/auth-v2.186.0-arm64.tar.gz -o auth.tar.gz
tar -xzf auth.tar.gz
rm auth.tar.gz
chmod +x auth
```

**Check latest releases:**
https://github.com/supabase/auth/releases

## Step 2: Create Configuration File

Create `.env.gotrue` in your project root:

```bash
# Database connection
DATABASE_URL=postgres://supabase_auth_admin:postgres@localhost:5432/supabase_auth?sslmode=disable
GOTRUE_DB_DRIVER=postgres

# JWT Settings
GOTRUE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated

# API Settings
API_EXTERNAL_URL=http://localhost:9999
GOTRUE_API_HOST=0.0.0.0
PORT=9999

# Auto-confirm users (no email verification for local dev)
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMS_AUTOCONFIRM=true

# Site URL (for redirects)
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_URI_ALLOW_LIST=http://localhost:3000

# Disable rate limiting for local dev
GOTRUE_RATE_LIMIT_HEADER=
GOTRUE_RATE_LIMIT_EMAIL_SENT=0

# Log level
GOTRUE_LOG_LEVEL=debug
```

## Step 3: Run Database Migrations

GoTrue needs its auth tables in the database:

```bash
export $(cat .env.gotrue | grep -v '^#' | xargs) && ./auth migrate
```

This creates tables in the `auth` schema:
- `auth.users` - User accounts
- `auth.identities` - Identity providers
- `auth.sessions` - Active sessions
- `auth.refresh_tokens` - Token refresh data
- `auth.mfa_factors` - MFA configuration
- And more...

## Step 4: Start GoTrue Server

```bash
set -a && source .env.gotrue && set +a && ./auth serve
```

Or run in background:
```bash
set -a && source .env.gotrue && set +a && ./auth serve > gotrue.log 2>&1 &
```

**Verify it's running:**
```bash
curl -s http://localhost:9999/health
# Should return: {"version":"...","name":"GoTrue","description":"..."}
```

## Step 5: Generate Service Role JWT

Generate a JWT token signed with your `GOTRUE_JWT_SECRET`:

```bash
node -e "
const crypto = require('crypto');
const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  iss: 'supabase',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
};

const headerB64 = base64url(JSON.stringify(header));
const payloadB64 = base64url(JSON.stringify(payload));
const signature = crypto.createHmac('sha256', secret)
  .update(headerB64 + '.' + payloadB64)
  .digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

console.log(headerB64 + '.' + payloadB64 + '.' + signature);
"
```

## Step 6: Configure Environment for CLI

```bash
export SUPABASE_URL="http://localhost:9999"
export SUPABASE_SERVICE_ROLE_KEY="<your-generated-jwt>"
```

## API Endpoints

GoTrue exposes these endpoints (no `/auth/v1` prefix when running standalone):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/admin/users` | GET | List users (admin) |
| `/admin/users` | POST | Create user (admin) |
| `/admin/users/:id` | GET | Get user (admin) |
| `/admin/users/:id` | DELETE | Delete user (admin) |
| `/signup` | POST | User signup |
| `/token?grant_type=password` | POST | Sign in with password |
| `/token?grant_type=refresh_token` | POST | Refresh token |
| `/logout` | POST | Sign out |
| `/user` | GET | Get current user |

## Running Tests

```bash
SUPABASE_URL="http://localhost:9999" \
SUPABASE_SERVICE_ROLE_KEY="<your-jwt>" \
npm test
```

## Troubleshooting

### "Database error checking email"
- Ensure migrations have been run: `./auth migrate`
- Check that auth schema exists and has correct permissions
- Verify `search_path` is set: `ALTER ROLE supabase_auth_admin SET search_path TO auth, public;`

### "relation does not exist"
- Run migrations again
- Check database connection string in `.env.gotrue`

### Connection refused on port 9999
- Check if GoTrue is running: `pgrep -f "./auth"`
- Check logs: `cat gotrue.log`
- Verify PORT is set correctly in `.env.gotrue`

### JWT authentication errors
- Ensure JWT is signed with the same secret as `GOTRUE_JWT_SECRET`
- Check JWT hasn't expired
- Verify `role` claim is set to `service_role` for admin operations

## Stopping GoTrue

```bash
pkill -f "./auth"
```

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `GOTRUE_JWT_SECRET` | Secret for signing JWTs | Required |
| `GOTRUE_JWT_EXP` | Token expiry in seconds | 3600 |
| `PORT` | HTTP server port | 9999 |
| `GOTRUE_MAILER_AUTOCONFIRM` | Skip email verification | false |
| `GOTRUE_SITE_URL` | Base URL for redirects | Required |
| `GOTRUE_LOG_LEVEL` | Logging verbosity | info |
