# Setting Up Local PostgreSQL for Supabase

## Overview
This skill describes how to set up a local PostgreSQL instance with Supabase-compatible schema for development and testing without Docker.

## Prerequisites
- PostgreSQL 15, 16, or 17 installed locally

## Next Steps
After completing PostgreSQL setup, see [setup-gotrue.md](setup-gotrue.md) for GoTrue (auth service) configuration.

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

## Step 4: Set Up GoTrue (Auth Service)

After PostgreSQL is configured, proceed to [setup-gotrue.md](setup-gotrue.md) for:
- Downloading GoTrue binary
- Configuration file setup
- Running migrations
- JWT generation
- Starting the auth server

## Troubleshooting

### PostgreSQL connection refused
```bash
# Check if PostgreSQL is running
pg_isready -h localhost

# Start PostgreSQL
service postgresql start
```

### Permission errors
- Ensure `supabase_auth_admin` has SUPERUSER or appropriate permissions
- Re-run: `ALTER USER supabase_auth_admin WITH SUPERUSER;`

### Schema not found
- Verify the auth schema exists: `\dn` in psql
- Re-run: `CREATE SCHEMA IF NOT EXISTS auth;`

### Search path issues
- Verify search_path is set correctly for the user
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
