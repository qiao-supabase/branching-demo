// Supabase Edge Function: hello-world
// Runtime: Deno 2.1+ (Edge Runtime v1.70.1)
// Docs: https://supabase.com/docs/guides/functions

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface RequestBody {
  name?: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
      },
    })
  }

  try {
    let name = "World"

    // Parse JSON body for POST requests
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        const body: RequestBody = await req.json()
        if (body.name) {
          name = body.name
        }
      }
    }

    // Check for name in query params (GET requests)
    const url = new URL(req.url)
    const queryName = url.searchParams.get("name")
    if (queryName) {
      name = queryName
    }

    const data = {
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
      runtime: "Supabase Edge Runtime v1.70.1 (Deno 2.1+)",
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }
})
