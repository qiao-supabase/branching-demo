# Setting Up Local PostgreSQL for Supabase

## Overview
This skill describes how to set up a local PostgreSQL instance with Supabase-compatible schema for development and testing without Docker.

## Prerequisites
- PostgreSQL 15, 16, or 17 installed locally

## Next Steps
After completing PostgreSQL setup, see [setup-gotrue.md](setup-gotrue.md) for GoTrue (auth service) configuration.

## Step 1: Stop PostgreSQL

```bash
service postgresql stop
```

## Step 2: Configure pg_hba.conf for Local Trust

Update `/etc/postgresql/16/main/pg_hba.conf` to use trust authentication for local connections:

```bash
sed -i 's/local   all             postgres                                peer/local   all             supabase_admin                          trust/' /etc/postgresql/16/main/pg_hba.conf
sed -i 's/local   all             all                                     peer/local   all             all                                     trust/' /etc/postgresql/16/main/pg_hba.conf
```

## Step 3: Reinitialize the Cluster

Reinitialize the PostgreSQL cluster with `supabase_admin` as the bootstrap user. This allows all Supabase migrations to run correctly, including the `demote-postgres` security migration.

```bash
# Remove existing data (WARNING: destroys all data)
rm -rf /var/lib/postgresql/16/main/*

# Reinitialize with supabase_admin as bootstrap user
sudo -u postgres /usr/lib/postgresql/16/bin/initdb \
  -D /var/lib/postgresql/16/main \
  -U supabase_admin
```

## Step 4: Start PostgreSQL

```bash
service postgresql start
```

## Step 5: Create Required Schemas and Extensions

Create the pgbouncer schema, extensions schema, and pg_stat_statements extension required by Supabase migrations:

```bash
psql -U supabase_admin -d postgres <<'EOF'
-- Create pgbouncer user and schema
CREATE USER pgbouncer;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM pgbouncer;
CREATE SCHEMA pgbouncer AUTHORIZATION pgbouncer;

CREATE OR REPLACE FUNCTION pgbouncer.get_auth(p_usename TEXT)
RETURNS TABLE(username TEXT, password TEXT) AS
$$
BEGIN
    RAISE WARNING 'PgBouncer auth request: %', p_usename;
    RETURN QUERY
    SELECT usename::TEXT, passwd::TEXT FROM pg_catalog.pg_shadow
    WHERE usename = p_usename;
END;
$$ LANGUAGE plpgsql SET search_path = '' SECURITY DEFINER;

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(p_usename TEXT) TO pgbouncer;

-- Create extensions schema and pg_stat_statements
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
EOF
```

## Step 6: Run Migrations

```bash
# Clone Supabase postgres repository
git clone --depth 1 https://github.com/supabase/postgres.git /tmp/supabase-postgres

# Run migrations
cd /tmp/supabase-postgres/migrations/db
POSTGRES_PASSWORD=postgres ./migrate.sh
```

The `demote-postgres` migration will succeed because `supabase_admin` is the bootstrap user with proper privileges.

## Step 7: Verify postgres Role Was Demoted

```bash
psql -U supabase_admin -d postgres -c "SELECT rolname, rolsuper FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin');"
```

Expected output:
```
    rolname     | rolsuper
----------------+----------
 supabase_admin | t
 postgres       | f
```

---

## Troubleshooting

### PostgreSQL connection refused
```bash
# Check if PostgreSQL is running
pg_isready -h localhost

# Start PostgreSQL
service postgresql start
```

### "role does not exist"
```bash
psql -U supabase_admin -d postgres -c "CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';"
```

---

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
| `pgbouncer` | Connection pooling authentication |

## Roles

| Role | Purpose |
|------|---------|
| `postgres` | Database owner (demoted after migrations) |
| `supabase_admin` | Bootstrap superuser for migrations |
| `anon` | Unauthenticated API access |
| `authenticated` | Authenticated user access |
| `service_role` | Admin access, bypasses RLS |
| `supabase_auth_admin` | Auth service admin |
| `supabase_storage_admin` | Storage service admin |
| `supabase_realtime_admin` | Realtime service admin |
| `pgbouncer` | Connection pooler authentication |

## Reference

- Migration scripts: https://github.com/supabase/postgres/tree/develop/migrations/db
- Supabase Postgres: https://github.com/supabase/postgres
