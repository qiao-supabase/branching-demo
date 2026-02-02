#!/usr/bin/env npx tsx

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Default local Supabase configuration
export const SUPABASE_URL =
  process.env.SUPABASE_URL || "http://localhost:54321";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Check if we're using standalone GoTrue (no /auth/v1 prefix)
async function isStandaloneGoTrue(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      return data.name === "GoTrue";
    }
  } catch {
    // Not standalone GoTrue
  }
  return false;
}

let _isStandalone: boolean | null = null;

async function checkStandalone(): Promise<boolean> {
  if (_isStandalone === null) {
    _isStandalone = await isStandaloneGoTrue();
  }
  return _isStandalone;
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface User {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  created_at?: string;
  [key: string]: unknown;
}

async function adminRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const isStandalone = await checkStandalone();
  const basePath = isStandalone ? "" : "/auth/v1";

  return fetch(`${SUPABASE_URL}${basePath}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      ...options.headers,
    },
  });
}

export async function createUser(
  email: string,
  password: string
): Promise<User> {
  const response = await adminRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error || "Failed to create user");
  }

  return data;
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await adminRequest(`/admin/users/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.msg || data.error || "Failed to delete user");
  }
}

export async function getUser(userId: string): Promise<User> {
  const response = await adminRequest(`/admin/users/${userId}`, {
    method: "GET",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error || "User not found");
  }

  return data;
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ user: User; access_token: string }> {
  const isStandalone = await checkStandalone();
  const basePath = isStandalone ? "" : "/auth/v1";

  const response = await fetch(`${SUPABASE_URL}${basePath}/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error || "Failed to sign in");
  }

  return { user: data.user, access_token: data.access_token };
}

function printUsage() {
  console.log(`
Usage: npm run create-user -- <email> <password>

Creates a new user in local Supabase.

Arguments:
  email     User's email address
  password  User's password (min 6 characters)

Environment Variables:
  SUPABASE_URL              Supabase API URL (default: http://localhost:54321)
  SUPABASE_SERVICE_ROLE_KEY Service role key for admin operations

Examples:
  npm run create-user -- user@example.com mypassword123
  npm run create-user -- test@test.com secretpass
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  if (args.length < 2) {
    console.error("Error: Both email and password are required.\n");
    printUsage();
    process.exit(1);
  }

  const [email, password] = args;

  if (!email.includes("@")) {
    console.error("Error: Invalid email address.");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Error: Password must be at least 6 characters.");
    process.exit(1);
  }

  try {
    console.log(`Creating user: ${email}`);
    console.log(`Supabase URL: ${SUPABASE_URL}`);

    const user = await createUser(email, password);

    console.log("\nUser created successfully!");
    console.log("User ID:", user.id);
    console.log("Email:", user.email);
    console.log("Created at:", user.created_at);
  } catch (error) {
    console.error("Error creating user:", (error as Error).message);
    process.exit(1);
  }
}

// Only run main if this is the entry point
const isMain = process.argv[1]?.includes("create-user");
if (isMain) {
  main();
}
