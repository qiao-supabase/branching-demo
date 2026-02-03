# Setting Up Supabase Realtime Service

## Overview
Supabase Realtime is an Elixir-based server that listens to PostgreSQL database changes using logical replication and broadcasts them to connected clients via WebSockets. This skill describes how to download, configure, and run Realtime locally for development and testing.

## Prerequisites
- PostgreSQL running with Supabase-compatible schema (see [setup-local-postgres.md](setup-local-postgres.md))
- PostgreSQL configured with `wal_level = logical` (already set in setup-local-postgres.md)
- GoTrue running for authentication (see [setup-gotrue.md](setup-gotrue.md))

## Step 1: Download Realtime Binary

Download the latest Realtime release:

```bash
curl -L https://github.com/supabase/realtime/releases/latest/download/realtime-linux-x86_64.tar.gz -o realtime.tar.gz
tar -xzf realtime.tar.gz
rm realtime.tar.gz
chmod +x realtime
```

**Check latest releases:**
https://github.com/supabase/realtime/releases

**Alternative for macOS (ARM):**
```bash
curl -L https://github.com/supabase/realtime/releases/latest/download/realtime-darwin-arm64.tar.gz -o realtime.tar.gz
tar -xzf realtime.tar.gz
rm realtime.tar.gz
chmod +x realtime
```

## Step 2: Configure Database for Realtime

Create the necessary publication and configure replication:

```bash
psql -U supabase_admin -d postgres <<'EOF'
-- Create publication for realtime changes
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- Grant supabase_realtime_admin necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_realtime_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO supabase_realtime_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO supabase_realtime_admin;

-- Create realtime schema if not exists
CREATE SCHEMA IF NOT EXISTS realtime;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;

-- Grant replication permission
ALTER USER supabase_realtime_admin WITH REPLICATION;
EOF
```

## Step 3: Enable Realtime on Tables

To broadcast changes for a specific table, add it to the publication:

```bash
psql -U supabase_admin -d postgres <<'EOF'
-- Enable realtime for countries table (example)
ALTER PUBLICATION supabase_realtime ADD TABLE public.countries;

-- Enable realtime for cities table (example)
ALTER PUBLICATION supabase_realtime ADD TABLE public.cities;

-- Verify publication tables
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
EOF
```

## Step 4: Create Configuration File

Create `.env.realtime` in your project root:

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=supabase_realtime_admin
DB_PASSWORD=postgres
DB_SSL=false

# Realtime server settings
PORT=4000
SECURE_CHANNELS=false

# JWT settings (must match GOTRUE_JWT_SECRET)
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
JWT_CLAIM_VALIDATORS={}

# Replication settings
REPLICATION_MODE=RLS
REPLICATION_POLL_INTERVAL=100
SUBSCRIPTION_SYNC_INTERVAL=60000

# Tenant settings (for single-tenant local dev)
REALTIME_TENANT_ID=realtime-dev
REALTIME_IP_VERSION=IPv4

# Slot name for logical replication
SLOT_NAME=supabase_realtime_rls

# API settings
API_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long

# Log level
LOG_LEVEL=debug

# Secret key base (for Phoenix sessions)
SECRET_KEY_BASE=UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq

# ERL settings
ERL_AFLAGS=-proto_dist inet_tcp
```

## Step 5: Start Realtime Server

```bash
set -a && source .env.realtime && set +a && ./realtime
```

Or run in background:
```bash
set -a && source .env.realtime && set +a && ./realtime > realtime.log 2>&1 &
```

**Verify it's running:**
```bash
curl -s http://localhost:4000/health
# Should return: {"status":"healthy"}
```

## Step 6: Connect from Client

### Using JavaScript/TypeScript

Install the Supabase client:
```bash
npm install @supabase/supabase-js
```

Create a realtime subscription:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:4000',  // Realtime URL
  'your-anon-key',          // JWT with 'anon' role
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
)

// Subscribe to all changes on countries table
const channel = supabase
  .channel('public:countries')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'countries' },
    (payload) => {
      console.log('Change received!', payload)
    }
  )
  .subscribe()

// Subscribe to INSERT only
const insertChannel = supabase
  .channel('public:countries:inserts')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'countries' },
    (payload) => {
      console.log('New country added!', payload.new)
    }
  )
  .subscribe()

// Unsubscribe when done
// supabase.removeChannel(channel)
```

### Using WebSocket Directly

Connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('ws://localhost:4000/socket/websocket')

ws.onopen = () => {
  // Join a channel
  ws.send(JSON.stringify({
    topic: 'realtime:public:countries',
    event: 'phx_join',
    payload: {
      config: {
        postgres_changes: [
          { event: '*', schema: 'public', table: 'countries' }
        ]
      }
    },
    ref: '1'
  }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Received:', message)
}
```

## Step 7: Test Realtime Changes

In one terminal, start a subscription (using the JavaScript client above), then in another terminal trigger a database change:

```bash
psql -U supabase_admin -d postgres -c "INSERT INTO public.countries (name, iso2, continent) VALUES ('Test Country', 'TC', 'Europe');"
```

You should see the change broadcast to your client.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/socket/websocket` | WebSocket | WebSocket connection endpoint |
| `/api/tenants` | GET | List tenants (admin) |
| `/api/channels` | GET | List active channels |

## Event Types

Realtime supports these PostgreSQL change events:

| Event | Description |
|-------|-------------|
| `INSERT` | New row added |
| `UPDATE` | Row modified |
| `DELETE` | Row removed |
| `*` | All events |

## Payload Structure

```json
{
  "schema": "public",
  "table": "countries",
  "commit_timestamp": "2024-01-15T10:30:00Z",
  "eventType": "INSERT",
  "new": {
    "id": 1,
    "name": "Test Country",
    "iso2": "TC"
  },
  "old": {},
  "errors": null
}
```

## Row Level Security (RLS)

Realtime respects PostgreSQL RLS policies. To enable RLS-based filtering:

1. Enable RLS on the table:
```sql
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
```

2. Create policies:
```sql
-- Allow authenticated users to see all countries
CREATE POLICY "Allow authenticated read" ON public.countries
  FOR SELECT TO authenticated USING (true);
```

3. Connect with an authenticated JWT to receive only authorized changes.

## Troubleshooting

### "publication does not exist"
Create the publication:
```bash
psql -U supabase_admin -d postgres -c "CREATE PUBLICATION supabase_realtime;"
```

### "replication slot does not exist"
The slot is created automatically on first connection. Ensure the user has REPLICATION privilege:
```bash
psql -U supabase_admin -d postgres -c "ALTER USER supabase_realtime_admin WITH REPLICATION;"
```

### No changes being received
1. Verify the table is added to the publication:
   ```bash
   psql -U supabase_admin -d postgres -c "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
   ```

2. Check wal_level is set to logical:
   ```bash
   psql -U supabase_admin -d postgres -c "SHOW wal_level;"
   ```

3. Check Realtime logs for errors:
   ```bash
   cat realtime.log
   ```

### WebSocket connection refused
- Check if Realtime is running: `pgrep -f realtime`
- Verify PORT is set correctly in `.env.realtime`
- Check logs: `cat realtime.log`

### JWT authentication errors
- Ensure JWT is signed with the same secret as `JWT_SECRET`
- Verify JWT hasn't expired
- Check that the user role has SELECT permission on the table

## Stopping Realtime

```bash
pkill -f "./realtime"
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | Required |
| `DB_USER` | Database user | Required |
| `DB_PASSWORD` | Database password | Required |
| `PORT` | HTTP/WebSocket server port | `4000` |
| `JWT_SECRET` | Secret for verifying JWTs | Required |
| `SLOT_NAME` | Logical replication slot name | `supabase_realtime_rls` |
| `REPLICATION_MODE` | `RLS` for row-level security mode | `RLS` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `SECRET_KEY_BASE` | Phoenix secret key | Required |

## Broadcast and Presence Features

Supabase Realtime also supports:

### Broadcast
Send messages between clients without database changes:

```typescript
const channel = supabase.channel('room-1')

// Listen to broadcasts
channel.on('broadcast', { event: 'cursor-pos' }, (payload) => {
  console.log('Cursor position:', payload)
})

// Send a broadcast
channel.send({
  type: 'broadcast',
  event: 'cursor-pos',
  payload: { x: 100, y: 200 }
})
```

### Presence
Track online users and their state:

```typescript
const channel = supabase.channel('room-1')

// Track presence
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState()
  console.log('Online users:', state)
})

// Join with user data
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({
      user_id: 'user-1',
      username: 'Alice'
    })
  }
})
```

## Reference

- Supabase Realtime: https://github.com/supabase/realtime
- Realtime Releases: https://github.com/supabase/realtime/releases
- Supabase Realtime Docs: https://supabase.com/docs/guides/realtime
- Phoenix Channels: https://hexdocs.pm/phoenix/channels.html
