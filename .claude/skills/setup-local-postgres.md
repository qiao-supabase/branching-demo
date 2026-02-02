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

## Step 2: Reinitialize the Cluster

Reinitialize the PostgreSQL cluster with `supabase_admin` as the bootstrap user. This allows all Supabase migrations to run correctly, including the `demote-postgres` security migration.

```bash
# Remove existing data (WARNING: destroys all data)
rm -rf /var/lib/postgresql/16/main/*

# Reinitialize with supabase_admin as bootstrap user
sudo -u postgres /usr/lib/postgresql/16/bin/initdb \
  -D /var/lib/postgresql/16/main \
  -U supabase_admin \
  --auth-local=peer \
  --auth-host=scram-sha-256
```

## Step 3: Update pg_hba.conf

Edit `/etc/postgresql/16/main/pg_hba.conf` to use `supabase_admin` and `trust` for local connections:

```bash
# Find and replace the authentication settings
# Change:
#   local   all             postgres                                peer
#   local   all             all                                     peer
# To:
#   local   all             supabase_admin                          trust
#   local   all             all                                     trust
```

Or run this command to update it:
```bash
sed -i 's/local   all             postgres                                peer/local   all             supabase_admin                          trust/' /etc/postgresql/16/main/pg_hba.conf
sed -i 's/local   all             all                                     peer/local   all             all                                     trust/' /etc/postgresql/16/main/pg_hba.conf
chown postgres:postgres /etc/postgresql/16/main/pg_hba.conf
chmod 640 /etc/postgresql/16/main/pg_hba.conf
```

## Step 4: Start PostgreSQL

```bash
service postgresql start
```

## Step 5: Verify Bootstrap User

```bash
psql -U supabase_admin -d postgres -c "SELECT rolname, rolsuper FROM pg_roles WHERE rolsuper = true;"
```

Expected output:
```
    rolname     | rolsuper
----------------+----------
 supabase_admin | t
```

## Step 6: Set Password and Run Migrations

```bash
# Set password for supabase_admin
psql -U supabase_admin -d postgres -c "ALTER USER supabase_admin WITH PASSWORD 'postgres';"

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
# For supabase_admin
psql -U supabase_admin -d postgres -c "CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';"
```

### Peer authentication failed
This happens when the OS user doesn't match the database user. Solutions:
1. Use `trust` authentication in pg_hba.conf (recommended for local dev)
2. Connect via TCP: `psql -h 127.0.0.1 -U username`

### Permission errors on pg_hba.conf
```bash
chown postgres:postgres /etc/postgresql/16/main/pg_hba.conf
chmod 640 /etc/postgresql/16/main/pg_hba.conf
service postgresql restart
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

## Reference

- Migration scripts: https://github.com/supabase/postgres/tree/develop/migrations/db
- Supabase Postgres: https://github.com/supabase/postgres
