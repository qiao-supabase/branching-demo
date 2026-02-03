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

### Detailed Setup Guides

- **[setup-local-postgres.md](setup-local-postgres.md)** - PostgreSQL installation, database setup, Supabase-compatible schema, roles, and helper functions
- **[setup-gotrue.md](setup-gotrue.md)** - GoTrue binary download, configuration, migrations, JWT generation, and API reference
- **[setup-postgrest.md](setup-postgrest.md)** - PostgREST binary download, configuration, REST API setup, and usage examples
- **[setup-kong.md](setup-kong.md)** - Kong API gateway setup, routing configuration, and unified API endpoint

### Quick Start Summary

1. **Install PostgreSQL** and start the service
2. **Create database** with Supabase-compatible schema (see [setup-local-postgres.md](setup-local-postgres.md))
3. **Download GoTrue** binary from [supabase/auth releases](https://github.com/supabase/auth/releases)
4. **Configure GoTrue** with `.env.gotrue` (see [setup-gotrue.md](setup-gotrue.md))
5. **Run migrations**: `./auth migrate`
6. **Start GoTrue**: `./auth serve`
7. **Download PostgREST** binary from [PostgREST releases](https://github.com/PostgREST/postgrest/releases)
8. **Configure PostgREST** with environment variables (see [setup-postgrest.md](setup-postgrest.md))
9. **Start PostgREST**: `./postgrest`
10. **Install Kong** (see [setup-kong.md](setup-kong.md))
11. **Configure Kong** with `kong.yml` (included in project root)
12. **Start Kong**: `kong start` (routes `/auth/v1/*` to GoTrue, `/rest/v1/*` to PostgREST)
13. **Set environment variables** for unified API access via Kong

### Environment Variables

With Kong as the API gateway:
```bash
export SUPABASE_URL="http://localhost:8000"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
```

Without Kong (direct GoTrue access):
```bash
export SUPABASE_URL="http://localhost:9999"
export SUPABASE_SERVICE_ROLE_KEY="<your-generated-jwt>"
```

### Running Tests

```bash
npm test
```

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
# Via Supabase CLI
curl http://localhost:54321/auth/v1/health

# Via Kong (local services)
curl http://localhost:8000/auth/v1/health

# Direct GoTrue (no Kong)
curl http://localhost:9999/health
```

### Docker not available
Use Option 2 (cloud) or Option 3 (local services) above.
