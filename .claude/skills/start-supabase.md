# Starting the Local Supabase Stack

## Overview
This skill describes how to start and manage Supabase services for this project, with multiple options depending on your environment.

## Option 1: Using Supabase CLI with Docker (Recommended)

### Prerequisites
- Docker must be installed and running
- Supabase CLI must be installed

### Installing Prerequisites

**macOS:**
```bash
# Install Docker
brew install --cask docker

# Install Supabase CLI
brew install supabase/tap/supabase
```

**Linux (Ubuntu/Debian):**
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Supabase CLI
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

**Windows:**
```powershell
# Install Docker Desktop from https://docker.com
# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Cross-platform (npm):**
```bash
npm install -g supabase
```

### Starting Supabase

```bash
supabase start
```

Services will be available at:
- **API** (PostgREST): http://localhost:54321
- **Database** (PostgreSQL 15): localhost:54322
- **Studio** (Dashboard UI): http://localhost:54323
- **Inbucket** (Email testing): http://localhost:54324

---

## Option 2: Using Supabase Cloud Project

If Docker is not available, use a free Supabase cloud project.

### Setup

1. Create a project at https://supabase.com/dashboard
2. Get your project URL and keys from Settings > API
3. Set environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

4. Run the CLI:
```bash
npm run create-user -- user@example.com password123
```

---

## Option 3: Local PostgreSQL with GoTrue (No Docker)

For environments without Docker, install services individually. This option provides a lightweight setup for auth testing.

> **Detailed instructions:** See [setup-local-postgres.md](setup-local-postgres.md) for complete PostgreSQL setup including schema, roles, and troubleshooting.

### Quick Start

**1. Install and start PostgreSQL:**

```bash
# Ubuntu/Debian
sudo apt install postgresql-16
service postgresql start

# macOS
brew install postgresql@16
brew services start postgresql@16
```

**2. Set up database (see setup-local-postgres.md for details):**

```bash
sudo -u postgres psql -c "CREATE USER supabase_auth_admin WITH PASSWORD 'postgres' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE supabase_auth OWNER supabase_auth_admin;"
sudo -u postgres psql -d supabase_auth -c "CREATE SCHEMA IF NOT EXISTS auth;"
sudo -u postgres psql -d supabase_auth -c "ALTER ROLE supabase_auth_admin SET search_path TO auth, public;"
```

**3. Download GoTrue (Auth Service):**

```bash
# Linux x86_64
curl -L https://github.com/supabase/auth/releases/latest/download/auth-v2.186.0-x86.tar.gz | tar -xz

# macOS ARM64
curl -L https://github.com/supabase/auth/releases/latest/download/auth-v2.186.0-arm64.tar.gz | tar -xz
```

**4. Create `.env.gotrue` configuration:**

```bash
DATABASE_URL=postgres://supabase_auth_admin:postgres@localhost:5432/supabase_auth?sslmode=disable
GOTRUE_DB_DRIVER=postgres
GOTRUE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
API_EXTERNAL_URL=http://localhost:9999
GOTRUE_API_HOST=0.0.0.0
PORT=9999
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMS_AUTOCONFIRM=true
GOTRUE_SITE_URL=http://localhost:3000
```

**5. Run migrations and start GoTrue:**

```bash
# Run migrations
export $(cat .env.gotrue | grep -v '^#' | xargs) && ./auth migrate

# Start server
set -a && source .env.gotrue && set +a && ./auth serve
```

**6. Set environment for CLI:**

```bash
export SUPABASE_URL="http://localhost:9999"
export SUPABASE_SERVICE_ROLE_KEY="<your-generated-jwt>"
```

See [setup-local-postgres.md](setup-local-postgres.md) for JWT generation instructions.

---

## Default Local Credentials

When using `supabase start`, these default credentials are used:

- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`

## CLI Commands Reference

```bash
# Check status
supabase status

# Stop services
supabase stop

# Stop and reset data
supabase stop --no-backup

# Reset database and run migrations
supabase db reset
```

## Troubleshooting

### Port conflicts
```bash
# Check what's using a port
lsof -i :54321
# or
netstat -tlnp | grep 54321
```

### Health check
```bash
curl http://localhost:54321/auth/v1/health
```

### Docker not available
Use Option 2 (cloud) or Option 3 (local services) above.
