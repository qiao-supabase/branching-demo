# Setting Up Local PostgreSQL for Supabase

## Overview
This skill describes how to set up a local PostgreSQL instance with Supabase-compatible schema for development and testing without Docker.

## Prerequisites
- PostgreSQL 15, 16, or 17 installed locally
- GoTrue binary for authentication (see start-supabase.md)

## Step 1: Start PostgreSQL

**Ubuntu/Debian:**
```bash
service postgresql start
```

**macOS (Homebrew):**
```bash
brew services start postgresql@16
```

**Verify it's running:**
```bash
pg_isready -h localhost
```

## Step 2: Create Database and User

```bash
# Create the auth admin user
sudo -u postgres psql -c "CREATE USER supabase_auth_admin WITH PASSWORD 'postgres' SUPERUSER;"

# Create the database
sudo -u postgres psql -c "CREATE DATABASE supabase_auth OWNER supabase_auth_admin;"

# Create the auth schema
sudo -u postgres psql -d supabase_auth -c "CREATE SCHEMA IF NOT EXISTS auth;"

# Set search path for the user
sudo -u postgres psql -d supabase_auth -c "ALTER ROLE supabase_auth_admin SET search_path TO auth, public;"
```

## Step 3: Apply Supabase-Compatible Schema

Create and run the following SQL to set up Supabase-compatible schemas, roles, and functions:

```bash
sudo -u postgres psql -d supabase_auth << 'EOF'
-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS graphql_public;

-- Install available extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- Create Supabase roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
    END IF;
END
$$;

-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

-- Create auth helper functions
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text;
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.email', true), '')::text;
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
$$;
EOF
```

## Step 4: Configure GoTrue

Create `.env.gotrue` configuration file:

```bash
# Database
DATABASE_URL=postgres://supabase_auth_admin:postgres@localhost:5432/supabase_auth?sslmode=disable
GOTRUE_DB_DRIVER=postgres

# JWT Settings
GOTRUE_JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated

# API Settings
API_EXTERNAL_URL=http://localhost:9999
GOTRUE_API_HOST=0.0.0.0
PORT=9999

# Disable email verification for local dev
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMS_AUTOCONFIRM=true

# Site URL
GOTRUE_SITE_URL=http://localhost:3000
```

## Step 5: Run GoTrue Migrations

```bash
export $(cat .env.gotrue | grep -v '^#' | xargs) && ./auth migrate
```

## Step 6: Start GoTrue

```bash
set -a && source .env.gotrue && set +a && ./auth serve
```

## Step 7: Generate Service Role JWT

Generate a JWT token for API access:

```bash
node -e "
const crypto = require('crypto');
const secret = 'your-super-secret-jwt-token-with-at-least-32-characters-long';

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  iss: 'supabase',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
};

const headerB64 = base64url(JSON.stringify(header));
const payloadB64 = base64url(JSON.stringify(payload));
const signature = crypto.createHmac('sha256', secret)
  .update(headerB64 + '.' + payloadB64)
  .digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

console.log(headerB64 + '.' + payloadB64 + '.' + signature);
"
```

## Running Tests

Set environment variables and run tests:

```bash
SUPABASE_URL="http://localhost:9999" \
SUPABASE_SERVICE_ROLE_KEY="<your-generated-jwt>" \
npm test
```

## Troubleshooting

### PostgreSQL connection refused
```bash
# Check if PostgreSQL is running
pg_isready -h localhost

# Start PostgreSQL
service postgresql start
```

### GoTrue migration errors
- Ensure the `auth` schema exists before running migrations
- Check that `supabase_auth_admin` has the correct permissions

### "relation does not exist" errors
- Verify the search_path is set correctly for the user
- Run: `ALTER ROLE supabase_auth_admin SET search_path TO auth, public;`

## Schema Components

| Schema | Purpose |
|--------|---------|
| `auth` | User authentication tables |
| `extensions` | PostgreSQL extensions |
| `storage` | File storage metadata |
| `realtime` | Real-time subscriptions |
| `graphql_public` | GraphQL API |

## Roles

| Role | Purpose |
|------|---------|
| `anon` | Unauthenticated API access |
| `authenticated` | Authenticated user access |
| `service_role` | Admin access, bypasses RLS |
| `supabase_auth_admin` | Auth service admin |
| `supabase_storage_admin` | Storage service admin |
