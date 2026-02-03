# Setting Up Kong (API Gateway)

## Overview
Kong is the API gateway used by Supabase to route requests to backend services (GoTrue, PostgREST, Storage, Realtime). This skill describes how to download, configure, and run Kong locally to front GoTrue and other services.

## Prerequisites
- GoTrue running (see [setup-gotrue.md](setup-gotrue.md))
- PostgREST running (optional, see [setup-postgrest.md](setup-postgrest.md))

## Step 1: Download Kong Binary

Download Kong using the official distribution:

**Ubuntu/Debian:**
```bash
curl -Lo kong.deb "https://packages.konghq.com/public/gateway-37/deb/ubuntu/pool/jammy/main/k/ko/kong_3.7.1_amd64.deb"
sudo dpkg -i kong.deb
rm kong.deb
```

**macOS:**
```bash
brew install kong
```

**Docker (Alternative):**
```bash
docker pull kong:3.7
```

**Check latest releases:**
https://docs.konghq.com/gateway/latest/install/

## Step 2: Create Kong Configuration

Create `kong.yml` in your project root with declarative configuration:

```yaml
_format_version: "3.0"
_transform: true

services:
  # GoTrue (Auth) Service
  - name: auth-v1
    url: http://localhost:9999
    routes:
      - name: auth-v1-route
        strip_path: true
        paths:
          - /auth/v1
    plugins:
      - name: cors
        config:
          origins:
            - "*"
          methods:
            - GET
            - POST
            - PUT
            - PATCH
            - DELETE
            - OPTIONS
          headers:
            - Accept
            - Authorization
            - Content-Type
            - apikey
            - x-client-info
          exposed_headers:
            - X-Total-Count
          credentials: true
          max_age: 3600

  # PostgREST (REST API) Service
  - name: rest-v1
    url: http://localhost:3000
    routes:
      - name: rest-v1-route
        strip_path: true
        paths:
          - /rest/v1
    plugins:
      - name: cors
        config:
          origins:
            - "*"
          methods:
            - GET
            - POST
            - PUT
            - PATCH
            - DELETE
            - OPTIONS
          headers:
            - Accept
            - Authorization
            - Content-Type
            - apikey
            - Prefer
            - Range
            - x-client-info
          exposed_headers:
            - Content-Range
            - X-Total-Count
          credentials: true
          max_age: 3600
      - name: key-auth
        config:
          key_names:
            - apikey
          key_in_body: false
          hide_credentials: false

consumers:
  - username: anon
    keyauth_credentials:
      - key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
  - username: service_role
    keyauth_credentials:
      - key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## Step 3: Create Environment Configuration

Create `.env.kong` in your project root:

```bash
# Kong configuration
KONG_DATABASE=off
KONG_DECLARATIVE_CONFIG=/path/to/your/kong.yml
KONG_PROXY_LISTEN=0.0.0.0:8000
KONG_ADMIN_LISTEN=0.0.0.0:8001
KONG_LOG_LEVEL=info

# Disable admin API in production
# KONG_ADMIN_LISTEN=off
```

## Step 4: Start Kong Server

**Using installed binary:**
```bash
# Set environment and start Kong
export KONG_DATABASE=off
export KONG_DECLARATIVE_CONFIG=$(pwd)/kong.yml
export KONG_PROXY_LISTEN="0.0.0.0:8000"
export KONG_ADMIN_LISTEN="0.0.0.0:8001"
export KONG_LOG_LEVEL=info

kong start
```

**Using Docker:**
```bash
docker run -d --name kong \
  --network host \
  -e "KONG_DATABASE=off" \
  -e "KONG_DECLARATIVE_CONFIG=/kong/kong.yml" \
  -e "KONG_PROXY_LISTEN=0.0.0.0:8000" \
  -e "KONG_ADMIN_LISTEN=0.0.0.0:8001" \
  -v "$(pwd)/kong.yml:/kong/kong.yml:ro" \
  kong:3.7
```

**Verify it's running:**
```bash
# Check Kong admin API
curl -s http://localhost:8001/status
# Should return Kong status JSON

# Check proxy is routing
curl -s http://localhost:8000/auth/v1/health
# Should return GoTrue health check response
```

## Step 5: Configure Environment for Supabase Client

With Kong as the API gateway, update your environment variables:

```bash
export SUPABASE_URL="http://localhost:8000"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
```

## API Routes

Kong routes requests to backend services:

| Route | Backend | Description |
|-------|---------|-------------|
| `/auth/v1/*` | GoTrue (port 9999) | Authentication endpoints |
| `/rest/v1/*` | PostgREST (port 3000) | REST API for database |
| `/storage/v1/*` | Storage (port 5000) | File storage (if configured) |
| `/realtime/v1/*` | Realtime (port 4000) | WebSocket connections (if configured) |

## API Usage Examples

### Auth Endpoints via Kong

```bash
# Health check
curl http://localhost:8000/auth/v1/health

# Sign up a new user
curl -X POST http://localhost:8000/auth/v1/signup \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Sign in
curl -X POST "http://localhost:8000/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Get user (with access token)
curl http://localhost:8000/auth/v1/user \
  -H "Authorization: Bearer <access_token>" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Admin: List users (with service role key)
curl http://localhost:8000/auth/v1/admin/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
```

### REST Endpoints via Kong

```bash
# Query data (anonymous)
curl http://localhost:8000/rest/v1/countries \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Insert data (authenticated)
curl -X POST http://localhost:8000/rest/v1/countries \
  -H "Authorization: Bearer <access_token>" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "New Country", "iso2": "NC"}'
```

## Troubleshooting

### "error loading declarative config"
- Check YAML syntax in `kong.yml`
- Validate with: `kong config parse kong.yml`
- Ensure paths are absolute in `KONG_DECLARATIVE_CONFIG`

### Connection refused on port 8000
```bash
# Check if Kong is running
pgrep -f kong

# Check Kong logs
kong logs

# Check if port is in use
lsof -i :8000
```

### "no Route matched with those values"
- Verify service URLs are correct (GoTrue on 9999, PostgREST on 3000)
- Check route paths match your requests
- Ensure `strip_path: true` is set if backend expects paths without prefix

### CORS errors
- Verify CORS plugin is configured in `kong.yml`
- Check that your origin is in the allowed origins list
- For development, use `origins: ["*"]`

### Backend service unavailable
```bash
# Verify GoTrue is running
curl http://localhost:9999/health

# Verify PostgREST is running
curl http://localhost:3000/
```

## Stopping Kong

**Using installed binary:**
```bash
kong stop
```

**Using Docker:**
```bash
docker stop kong
docker rm kong
```

## Configuration Reference

### Kong Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KONG_DATABASE` | Database mode (off for declarative) | `postgres` |
| `KONG_DECLARATIVE_CONFIG` | Path to declarative config file | None |
| `KONG_PROXY_LISTEN` | Proxy listener address | `0.0.0.0:8000` |
| `KONG_ADMIN_LISTEN` | Admin API listener address | `0.0.0.0:8001` |
| `KONG_LOG_LEVEL` | Logging verbosity | `notice` |

### Service Ports Summary

| Service | Direct Port | Via Kong |
|---------|-------------|----------|
| GoTrue | 9999 | 8000/auth/v1 |
| PostgREST | 3000 | 8000/rest/v1 |
| Storage | 5000 | 8000/storage/v1 |
| Realtime | 4000 | 8000/realtime/v1 |
| Kong Proxy | 8000 | - |
| Kong Admin | 8001 | - |

## References

- Kong Documentation: https://docs.konghq.com/
- Kong Declarative Configuration: https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/
- Supabase Self-Hosting: https://supabase.com/docs/guides/self-hosting
