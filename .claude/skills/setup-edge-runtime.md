# Setting Up Supabase Edge Runtime

## Overview
Supabase Edge Runtime is a Deno-based runtime for running serverless Edge Functions. This skill describes how to configure and run Edge Functions locally for development.

**Latest Version:** v1.70.1 (February 2026)
**Deno Version:** 2.1+

## Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Docker (for running local Supabase stack)
- OR: Deno 2.1+ installed (for standalone development)

## Project Structure

```
supabase/
├── config.toml           # Supabase configuration (includes edge_runtime settings)
├── functions/
│   ├── deno.json         # Shared Deno configuration for all functions
│   └── hello-world/      # Individual function directory
│       └── index.ts      # Function entry point
└── migrations/
```

## Step 1: Configure Edge Runtime

Add the following to `supabase/config.toml`:

```toml
# Edge Runtime configuration for Edge Functions
[edge_runtime]
enabled = true
# Request handling policy: "oneshot" for development (hot reload), "per_worker" for load testing
policy = "oneshot"
# Port for Chrome DevTools inspector debugging
inspector_port = 8083

# Individual function configurations
[functions.hello-world]
verify_jwt = false  # Set to true to require JWT authentication
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable Edge Runtime service |
| `policy` | `"oneshot"` | `"oneshot"` for dev (hot reload), `"per_worker"` for load testing |
| `inspector_port` | `8083` | Chrome DevTools debugging port |

### Function-specific Options

| Option | Default | Description |
|--------|---------|-------------|
| `verify_jwt` | `true` | Require valid JWT in Authorization header |
| `import_map` | auto | Custom import map path |
| `entrypoint` | `index.ts` | Custom entry point file |
| `enabled` | `true` | Enable/disable function deployment |
| `static_files` | `[]` | Array of static files to bundle (supports globs) |

## Step 2: Create Deno Configuration

Create `supabase/functions/deno.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "lib": ["deno.window", "deno.unstable"]
  },
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@^2.47.0",
    "@std/http": "jsr:@std/http@^1.0.0",
    "@std/assert": "jsr:@std/assert@^1.0.0"
  }
}
```

## Step 3: Create an Edge Function

Create `supabase/functions/hello-world/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  const { name } = await req.json()
  const data = {
    message: `Hello, ${name || 'World'}!`,
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  })
})
```

## Step 4: Run Locally

### Option A: With Supabase CLI (Recommended)

```bash
# Start all Supabase services (including Edge Runtime)
supabase start

# Serve a specific function with hot reload
supabase functions serve hello-world

# The function is available at:
# http://localhost:54321/functions/v1/hello-world
```

### Option B: Download Edge Runtime Binary (Standalone)

```bash
# Download the latest edge-runtime binary
curl -L https://github.com/supabase/edge-runtime/releases/download/v1.70.1/edge-runtime-v1.70.1-x86_64-unknown-linux-gnu.tar.gz -o edge-runtime.tar.gz
tar -xzf edge-runtime.tar.gz
rm edge-runtime.tar.gz
chmod +x edge-runtime

# Run edge runtime
./edge-runtime start --main-service ./supabase/functions/hello-world/index.ts
```

**Check latest releases:** https://github.com/supabase/edge-runtime/releases

## Step 5: Test the Function

### Using curl

```bash
# GET request
curl http://localhost:54321/functions/v1/hello-world

# POST request with JSON body
curl -X POST http://localhost:54321/functions/v1/hello-world \
  -H "Content-Type: application/json" \
  -d '{"name": "Developer"}'
```

### With JWT Authentication (when verify_jwt = true)

```bash
curl http://localhost:54321/functions/v1/hello-world \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Step 6: Deploy to Production

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy a single function
supabase functions deploy hello-world

# Deploy all functions
supabase functions deploy
```

## Advanced: Environment Variables and Secrets

### Local Development

Create `.env.local` in your project root:

```bash
MY_SECRET_KEY=local-secret-value
```

Then serve with:

```bash
supabase functions serve --env-file .env.local
```

### Production Secrets

```bash
# Set a secret
supabase secrets set MY_SECRET_KEY=production-secret-value

# List secrets
supabase secrets list

# Unset a secret
supabase secrets unset MY_SECRET_KEY
```

Access in your function:

```typescript
const secretKey = Deno.env.get("MY_SECRET_KEY")
```

## Advanced: Using Supabase Client in Edge Functions

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  )

  const { data, error } = await supabase.from("users").select("*")

  return new Response(JSON.stringify({ data, error }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

## Debugging with Chrome DevTools

1. Start functions with inspector enabled:
   ```bash
   supabase functions serve --inspect
   ```

2. Open Chrome and navigate to `chrome://inspect`

3. Click "Configure" and add `localhost:8083`

4. Your function will appear under "Remote Target"

## Troubleshooting

### Function not found (404)
- Ensure the function directory name matches what you're calling
- Check that `supabase/functions/<name>/index.ts` exists
- Verify the function is enabled in `config.toml`

### JWT verification failed (401)
- Set `verify_jwt = false` in config.toml for testing
- Or provide a valid JWT in the Authorization header

### Import errors
- Check that imports use JSR format: `jsr:@package/name@version`
- Ensure `deno.json` has the correct import mappings
- Run `deno cache supabase/functions/hello-world/index.ts` to pre-cache deps

### CORS issues
- Add CORS headers to your response
- Handle OPTIONS preflight requests

### Cold start performance
- Keep functions small and focused
- Lazy-load heavy dependencies
- Use global scope for reusable connections

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Edge Runtime GitHub](https://github.com/supabase/edge-runtime)
- [Deno Documentation](https://docs.deno.com/)
- [JSR Package Registry](https://jsr.io/)
