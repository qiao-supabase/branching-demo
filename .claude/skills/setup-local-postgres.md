# Setting Up Local PostgreSQL 17 for Supabase

## Overview
This skill describes how to install and set up PostgreSQL 17 with Supabase-compatible schema for development and testing without Docker. It uses the official Supabase PostgreSQL build which includes all required extensions.

## Prerequisites
- Linux system (x64 or arm64)
- Root access
- curl and unzip installed

## Next Steps
After completing PostgreSQL setup, see [setup-gotrue.md](setup-gotrue.md) for GoTrue (auth service) configuration.

## Step 1: Download PostgreSQL 17

Download the Supabase PostgreSQL build from GitHub Actions artifacts via nightly.link:

```bash
# For x64 systems
curl -L -o /tmp/postgres-artifact.zip \
  "https://nightly.link/supabase/postgres/actions/runs/21658919255/supabase-postgres-linux-x64.zip"

# For arm64 systems
curl -L -o /tmp/postgres-artifact.zip \
  "https://nightly.link/supabase/postgres/actions/runs/21658919255/supabase-postgres-linux-arm64.zip"
```

## Step 2: Extract and Install

```bash
# Extract the artifact
mkdir -p /tmp/postgres-extract
unzip -o /tmp/postgres-artifact.zip -d /tmp/postgres-extract

# Install to /opt/postgresql-17
mkdir -p /opt/postgresql-17
cp -r /tmp/postgres-extract/* /opt/postgresql-17/
chmod +x /opt/postgresql-17/bin/*

# Clean up
rm -rf /tmp/postgres-artifact.zip /tmp/postgres-extract
```

## Step 3: Set Up PATH

```bash
# Create profile.d script for system-wide PATH
cat > /etc/profile.d/postgresql.sh << 'EOF'
export PATH="/opt/postgresql-17/bin:$PATH"
EOF
chmod +x /etc/profile.d/postgresql.sh

# For current session
export PATH="/opt/postgresql-17/bin:$PATH"
```

Verify the installation:
```bash
/opt/postgresql-17/bin/psql --version
# Should output: psql (PostgreSQL) 17.6
```

## Step 4: Create postgres User and Directories

```bash
# Create postgres user if it doesn't exist
id postgres 2>/dev/null || useradd -r -m -s /bin/bash postgres

# Create data and run directories
mkdir -p /var/lib/postgresql/17/main
mkdir -p /var/run/postgresql
chown -R postgres:postgres /var/lib/postgresql/17
chown postgres:postgres /var/run/postgresql
```

## Step 5: Initialize the Cluster

Initialize the PostgreSQL cluster with `supabase_admin` as the bootstrap user:

```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
export NIX_PGLIBDIR='/opt/postgresql-17/lib'
/opt/postgresql-17/bin/.initdb-wrapped \
  -D /var/lib/postgresql/17/main \
  -U supabase_admin \
  --auth=trust
"
```

## Step 6: Configure PostgreSQL

Use the bundled Supabase configuration templates from the artifact:

```bash
# Copy the bundled postgresql.conf template
cp /opt/postgresql-17/share/supabase-cli/config/postgresql.conf.template \
   /var/lib/postgresql/17/main/postgresql.conf

# Set up pgsodium and vault key script paths
GETKEY_SCRIPT="/opt/postgresql-17/share/supabase-cli/config/pgsodium_getkey.sh"
echo "pgsodium.getkey_script = '$GETKEY_SCRIPT'" >> /var/lib/postgresql/17/main/postgresql.conf
echo "vault.getkey_script = '$GETKEY_SCRIPT'" >> /var/lib/postgresql/17/main/postgresql.conf

# Set ownership
chown postgres:postgres /var/lib/postgresql/17/main/postgresql.conf
```

The bundled postgresql.conf.template includes:
- Port 54322 (Supabase CLI default)
- All Supabase extensions preloaded (pg_stat_statements, pg_cron, pg_net, pgsodium, supabase_vault, supautils)
- Supautils reserved roles configuration
- Conservative memory settings for local development

## Step 7: Start PostgreSQL

```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
export NIX_PGLIBDIR='/opt/postgresql-17/lib'
/opt/postgresql-17/bin/.pg_ctl-wrapped \
  -D /var/lib/postgresql/17/main \
  -l /var/lib/postgresql/17/main/logfile \
  start
"
```

Verify it's running:
```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
/opt/postgresql-17/bin/.pg_isready-wrapped -h /tmp -p 54322
"
# Should output: /tmp:54322 - accepting connections
```

**Note:** The bundled postgresql.conf configures the Unix socket in `/tmp`, not `/run/postgresql`. Always use `-h /tmp -p 54322` when connecting.

## Step 8: Run Migrations

The Supabase PostgreSQL build includes bundled migrations. Run them:

```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
export NIX_PGLIBDIR='/opt/postgresql-17/lib'
export POSTGRES_PASSWORD=''
export POSTGRES_PORT=54322
export POSTGRES_HOST=/tmp
cd /opt/postgresql-17/share/supabase-cli/migrations
./migrate.sh
"
```

**Important:** The `POSTGRES_PORT` and `POSTGRES_HOST` environment variables are required. The migrate.sh script defaults to port 5432 and localhost, which won't work with the Supabase configuration.

The migrations will:
- Create the `postgres` role and other API roles
- Set up all Supabase schemas (auth, storage, realtime, etc.)
- Demote the `postgres` role from superuser
- Configure proper permissions

## Step 9: Verify Setup

```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'

echo '=== Roles ==='
/opt/postgresql-17/bin/.psql-wrapped -h /tmp -p 54322 -U supabase_admin -d postgres -c \\
  \"SELECT rolname, rolsuper FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin', 'anon', 'authenticated', 'service_role') ORDER BY rolname;\"

echo '=== Schemas ==='
/opt/postgresql-17/bin/.psql-wrapped -h /tmp -p 54322 -U supabase_admin -d postgres -c \\
  \"SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name;\"
"
```

Expected output:
```
=== Roles ===
    rolname     | rolsuper
----------------+----------
 anon           | f
 authenticated  | f
 postgres       | f
 service_role   | f
 supabase_admin | t

=== Schemas ===
  schema_name
----------------
 auth
 extensions
 graphql
 graphql_public
 pgbouncer
 public
 realtime
 storage
 vault
```

---

## Helper Commands

### Connect to PostgreSQL
```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
/opt/postgresql-17/bin/.psql-wrapped -h /tmp -p 54322 -U supabase_admin -d postgres
"
```

### Stop PostgreSQL
```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
/opt/postgresql-17/bin/.pg_ctl-wrapped -D /var/lib/postgresql/17/main stop
"
```

### Check PostgreSQL Status
```bash
su - postgres -c "
export PATH='/opt/postgresql-17/bin:/usr/bin:/bin'
export LD_LIBRARY_PATH='/opt/postgresql-17/lib'
/opt/postgresql-17/bin/.pg_ctl-wrapped -D /var/lib/postgresql/17/main status
"
```

### View Logs
```bash
tail -f /var/lib/postgresql/17/main/logfile
```

---

## Troubleshooting

### "Exec format error"
You downloaded the wrong architecture. Check your system architecture with `uname -m` and download the matching artifact (x64 for x86_64, arm64 for aarch64).

### "cannot be run as root"
PostgreSQL binaries must be run as a non-root user. Use `su - postgres` as shown in the examples.

### PostgreSQL connection refused
```bash
# Check if PostgreSQL is running (must specify socket dir and port)
su - postgres -c "/opt/postgresql-17/bin/.pg_isready-wrapped -h /tmp -p 54322"

# Start if not running
su - postgres -c "/opt/postgresql-17/bin/.pg_ctl-wrapped -D /var/lib/postgresql/17/main start"
```

### "no response" on pg_isready
The Supabase postgresql.conf uses `/tmp` as the Unix socket directory. Always use `-h /tmp -p 54322` flags when connecting. Without these flags, tools default to checking `/run/postgresql` on port 5432.

### Migration fails with "connection refused" on port 5432
The migrate.sh script defaults to port 5432. Set the correct environment variables:
```bash
export POSTGRES_PORT=54322
export POSTGRES_HOST=/tmp
```

### Migration fails with "role already exists"
If you've run partial setup before, you may need to reinitialize:
```bash
# Stop PostgreSQL first
su - postgres -c "/opt/postgresql-17/bin/.pg_ctl-wrapped -D /var/lib/postgresql/17/main stop"

# Remove data directory and start fresh from Step 5
rm -rf /var/lib/postgresql/17/main/*
```

---

## Bundled Extensions

The Supabase PostgreSQL 17 build includes these Supabase-specific extensions:
- supautils
- pg_graphql
- pgsodium
- supabase_vault
- pg_net
- pg_cron

Plus 100+ standard PostgreSQL extensions.

## Schema Components

The migration scripts create these schemas:

| Schema | Purpose |
|--------|---------|
| `auth` | User authentication (GoTrue) |
| `storage` | File storage metadata |
| `realtime` | Real-time subscriptions |
| `extensions` | PostgreSQL extensions |
| `graphql` / `graphql_public` | GraphQL API |
| `vault` | Secret management |
| `pgbouncer` | Connection pooling authentication |

## Roles

| Role | Purpose |
|------|---------|
| `supabase_admin` | Bootstrap superuser for migrations |
| `postgres` | Database owner (demoted after migrations) |
| `anon` | Unauthenticated API access |
| `authenticated` | Authenticated user access |
| `service_role` | Admin access, bypasses RLS |
| `supabase_auth_admin` | Auth service admin |
| `supabase_storage_admin` | Storage service admin |
| `supabase_realtime_admin` | Realtime service admin |
| `pgbouncer` | Connection pooler authentication |

## Reference

- Supabase Postgres: https://github.com/supabase/postgres
- PostgreSQL 17 artifacts: https://github.com/supabase/postgres/actions
