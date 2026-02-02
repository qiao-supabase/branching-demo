# Starting the Local Supabase Stack

## Overview
This skill describes how to start and manage the local Supabase development stack for this project.

## Prerequisites
- Docker must be installed and running
- Supabase CLI must be installed (`npm install -g supabase` or `brew install supabase/tap/supabase`)

## Starting Supabase

To start the local Supabase stack:

```bash
supabase start
```

This will start all Supabase services including:
- **API** (PostgREST): http://localhost:54321
- **Database** (PostgreSQL 15): localhost:54322
- **Studio** (Dashboard UI): http://localhost:54323
- **Inbucket** (Email testing): http://localhost:54324

## Default Credentials

The local development stack uses these default credentials:

- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`

## Checking Status

To check if Supabase is running:

```bash
supabase status
```

## Stopping Supabase

To stop all services:

```bash
supabase stop
```

To stop and reset all data:

```bash
supabase stop --no-backup
```

## Running Database Migrations

After starting Supabase, apply migrations:

```bash
supabase db reset
```

This will reset the database and run all migrations from `supabase/migrations/`.

## Troubleshooting

### Port conflicts
If ports are in use, check for existing containers:
```bash
docker ps
```

### Docker not running
Ensure Docker Desktop or Docker daemon is running before starting Supabase.

### Health check
Verify the API is responding:
```bash
curl http://localhost:54321/auth/v1/health
```
