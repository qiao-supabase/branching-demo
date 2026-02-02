#!/usr/bin/env npx tsx

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Default local Supabase configuration
export const SUPABASE_URL =
  process.env.SUPABASE_URL || "http://localhost:54321";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createUser(email: string, password: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function deleteUser(userId: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getUser(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
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
