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

For environments without Docker, install services individually.

### Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql-15
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Install GoTrue (Auth Service)

GoTrue is the Supabase Auth service. Download the binary:

```bash
# Download latest release
curl -L https://github.com/supabase/gotrue/releases/latest/download/gotrue-linux-amd64 -o gotrue
chmod +x gotrue

# Or on macOS
curl -L https://github.com/supabase/gotrue/releases/latest/download/gotrue-darwin-amd64 -o gotrue
chmod +x gotrue
```

### Configure GoTrue

Create a `.env` file for GoTrue:

```bash
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

# JWT Settings
GOTRUE_JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters
GOTRUE_JWT_EXP=3600

# API Settings
API_EXTERNAL_URL=http://localhost:9999
GOTRUE_API_HOST=0.0.0.0
PORT=9999

# Mailer (disable for local dev)
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMTP_ADMIN_EMAIL=admin@example.com

# Site URL
GOTRUE_SITE_URL=http://localhost:3000
```

### Start GoTrue

```bash
./gotrue
```

### Update Environment for CLI

```bash
export SUPABASE_URL="http://localhost:9999"
export SUPABASE_SERVICE_ROLE_KEY="your-jwt-token"
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
curl http://localhost:54321/auth/v1/health
```

### Docker not available
Use Option 2 (cloud) or Option 3 (local services) above.
