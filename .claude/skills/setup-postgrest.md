# Setting Up PostgREST (REST API for PostgreSQL)

## Overview
PostgREST is a standalone REST API server that exposes your PostgreSQL database as a RESTful API. This skill describes how to download, configure, and run PostgREST locally for development and testing.

## Prerequisites
- PostgreSQL running with Supabase-compatible schema (see [setup-local-postgres.md](setup-local-postgres.md))
- GoTrue running for authentication (see [setup-gotrue.md](setup-gotrue.md))

## Step 1: Download PostgREST Binary

Download the latest PostgREST binary:

```bash
curl -L https://github.com/PostgREST/postgrest/releases/download/v14.4/postgrest-v14.4-linux-static-x86-64.tar.xz -o postgrest.tar.xz
tar -xJf postgrest.tar.xz
rm postgrest.tar.xz
chmod +x postgrest
```

**Check latest releases:**
https://github.com/PostgREST/postgrest/releases

## Step 2: Configure Database Roles

The `authenticator` role should already exist from Supabase migrations. Reset any problematic settings:

```bash
psql -U supabase_admin -d postgres <<'EOF'
-- Reset authenticator role settings (removes safeupdate if set)
ALTER ROLE authenticator RESET ALL;

-- Ensure authenticator can switch to API roles
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Grant schema permissions to API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
EOF
```

## Step 3: Set Environment Variables

PostgREST can be configured entirely via environment variables (prefixed with `PGRST_`):

```bash
# Database connection
export PGRST_DB_URI="postgres://authenticator:postgres@localhost:5432/postgres"

# Schema to expose
export PGRST_DB_SCHEMAS="public"

# Anonymous role (used when no JWT provided)
export PGRST_DB_ANON_ROLE="anon"

# JWT secret (must match GOTRUE_JWT_SECRET)
export PGRST_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

# Server settings
export PGRST_SERVER_HOST="0.0.0.0"
export PGRST_SERVER_PORT="3000"

# Role claim key in JWT
export PGRST_JWT_ROLE_CLAIM_KEY=".role"

# Log level
export PGRST_LOG_LEVEL="info"
```

## Step 4: Start PostgREST Server

```bash
./postgrest
```

Or run in background:
```bash
./postgrest > postgrest.log 2>&1 &
```

Or start with inline environment variables:
```bash
PGRST_DB_URI="postgres://authenticator:postgres@localhost:5432/postgres" \
PGRST_DB_SCHEMAS="public" \
PGRST_DB_ANON_ROLE="anon" \
PGRST_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long" \
PGRST_SERVER_HOST="0.0.0.0" \
PGRST_SERVER_PORT="3000" \
PGRST_JWT_ROLE_CLAIM_KEY=".role" \
PGRST_LOG_LEVEL="info" \
./postgrest
```

**Verify it's running:**
```bash
curl -s http://localhost:3000/
# Should return OpenAPI spec JSON
```

## Step 5: Create a Test Table (Optional)

```bash
psql -U supabase_admin -d postgres <<'EOF'
-- Create a test table
CREATE TABLE IF NOT EXISTS public.todos (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    done BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Allow anon to read all todos
CREATE POLICY "Allow anon read" ON public.todos FOR SELECT TO anon USING (true);

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated full access" ON public.todos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.todos TO anon;
GRANT ALL ON public.todos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.todos_id_seq TO authenticated;

-- Insert sample data
INSERT INTO public.todos (task, done) VALUES
    ('Learn PostgREST', false),
    ('Setup Supabase locally', true);
EOF
```

## API Usage Examples

### Anonymous Read (no authentication)
```bash
curl http://localhost:3000/todos
```

### Authenticated Request (with JWT)
```bash
# Generate an authenticated JWT
JWT=$(node -e "
const crypto = require('crypto');
const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  iss: 'supabase',
  role: 'authenticated',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
};

const headerB64 = base64url(JSON.stringify(header));
const payloadB64 = base64url(JSON.stringify(payload));
const signature = crypto.createHmac('sha256', secret)
  .update(headerB64 + '.' + payloadB64)
  .digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

console.log(headerB64 + '.' + payloadB64 + '.' + signature);
")

# Insert a new todo
curl -X POST http://localhost:3000/todos \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"task": "New task", "done": false}'
```

### Filtering and Querying
```bash
# Filter by column
curl "http://localhost:3000/todos?done=eq.false"

# Select specific columns
curl "http://localhost:3000/todos?select=id,task"

# Order results
curl "http://localhost:3000/todos?order=created_at.desc"

# Limit results
curl "http://localhost:3000/todos?limit=10"
```

## Troubleshooting

### "could not access file safeupdate"
The authenticator role has safeupdate extension enabled but it's not installed:
```bash
psql -U supabase_admin -d postgres -c "ALTER ROLE authenticator RESET ALL;"
```

### Connection refused on port 3000
```bash
# Check if PostgREST is running
pgrep -f postgrest

# Check logs
cat postgrest.log

# Restart PostgREST
pkill -f postgrest
./postgrest > postgrest.log 2>&1 &
```

### JWT authentication errors
- Ensure JWT is signed with the same secret as `PGRST_JWT_SECRET`
- Check that `role` claim matches a valid PostgreSQL role (anon, authenticated, service_role)
- Verify JWT hasn't expired

### Schema cache not updating
Send SIGUSR1 to reload schema cache:
```bash
pkill -SIGUSR1 -f postgrest
```

Or restart PostgREST after schema changes.

## Stopping PostgREST

```bash
pkill -f "./postgrest"
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PGRST_DB_URI` | PostgreSQL connection string | Required |
| `PGRST_DB_SCHEMAS` | Schemas to expose | `public` |
| `PGRST_DB_ANON_ROLE` | Role for unauthenticated requests | Required |
| `PGRST_JWT_SECRET` | Secret for verifying JWTs | Required |
| `PGRST_SERVER_HOST` | Host to bind to | `127.0.0.1` |
| `PGRST_SERVER_PORT` | Port to listen on | `3000` |
| `PGRST_JWT_ROLE_CLAIM_KEY` | JSON path to role in JWT | `.role` |
| `PGRST_LOG_LEVEL` | Logging verbosity | `error` |

## Reference

- PostgREST Documentation: https://postgrest.org/
- PostgREST Releases: https://github.com/PostgREST/postgrest/releases
- PostgREST API Reference: https://postgrest.org/en/stable/references/api.html
