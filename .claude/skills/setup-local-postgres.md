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

## Step 2: Initialize Database with Supabase Schema

Use the official Supabase migration scripts to set up the database schema:

```bash
# Clone the supabase/postgres repository (or download just the migrations)
git clone --depth 1 https://github.com/supabase/postgres.git /tmp/supabase-postgres

# Create the supabase_admin role (required by migrate.sh)
sudo -u postgres psql -c "CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';"

# Run the migration script
cd /tmp/supabase-postgres/migrations/db
POSTGRES_PASSWORD=postgres ./migrate.sh
```

This script will:
- Create the `postgres` role if it doesn't exist
- Run init scripts (schemas for auth, storage, etc.)
- Run all migrations
- Set up roles and permissions

### Alternative: Download and Run Directly

If you don't want to clone the entire repo:

```bash
# Create temp directory and download migration files
mkdir -p /tmp/supabase-db/init-scripts /tmp/supabase-db/migrations

# Download migrate.sh
curl -sL https://raw.githubusercontent.com/supabase/postgres/develop/migrations/db/migrate.sh \
  -o /tmp/supabase-db/migrate.sh
chmod +x /tmp/supabase-db/migrate.sh

# Download init scripts
for f in 00000000000000-initial-schema.sql 00000000000001-auth-schema.sql \
         00000000000002-storage-schema.sql 00000000000003-post-setup.sql; do
  curl -sL "https://raw.githubusercontent.com/supabase/postgres/develop/migrations/db/init-scripts/$f" \
    -o "/tmp/supabase-db/init-scripts/$f"
done

# Create supabase_admin role
sudo -u postgres psql -c "CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';"

# Run migrations
cd /tmp/supabase-db
POSTGRES_PASSWORD=postgres ./migrate.sh
```

## Step 3: Prepare for GoTrue Migrations

The Supabase migration scripts create auth functions owned by `supabase_admin`, but GoTrue runs as `supabase_auth_admin`. Transfer ownership to allow GoTrue migrations to succeed:

```bash
sudo -u postgres psql -d supabase -c "
ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
"
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

### "role supabase_admin does not exist"
```bash
sudo -u postgres psql -c "CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';"
```

### Permission errors
- Ensure `supabase_admin` has SUPERUSER permissions
- Re-run: `ALTER USER supabase_admin WITH SUPERUSER;`

### Migration script errors
- Check that all init-scripts are downloaded
- Verify PostgreSQL version is 15+
- Check logs for specific SQL errors

## Schema Components

The migration scripts create these schemas:

| Schema | Purpose |
|--------|---------|
| `auth` | User authentication (GoTrue) |
| `storage` | File storage metadata |
| `realtime` | Real-time subscriptions |
| `extensions` | PostgreSQL extensions |
| `graphql_public` | GraphQL API |
| `pgsodium` | Encryption functions |
| `vault` | Secret management |

## Roles

| Role | Purpose |
|------|---------|
| `postgres` | Database owner |
| `supabase_admin` | Admin for migrations |
| `anon` | Unauthenticated API access |
| `authenticated` | Authenticated user access |
| `service_role` | Admin access, bypasses RLS |
| `supabase_auth_admin` | Auth service admin |
| `supabase_storage_admin` | Storage service admin |
| `supabase_realtime_admin` | Realtime service admin |

## Reference

- Migration scripts: https://github.com/supabase/postgres/tree/develop/migrations/db
- Supabase Postgres: https://github.com/supabase/postgres
