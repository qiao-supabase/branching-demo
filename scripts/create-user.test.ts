import { describe, it, expect, afterEach, beforeAll } from "vitest";
import {
  createUser,
  deleteUser,
  getUser,
  getSupabaseAdmin,
  SUPABASE_URL,
} from "./create-user";

async function isSupabaseRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}

describe("create-user", () => {
  const createdUserIds: string[] = [];
  let supabaseRunning = false;

  beforeAll(async () => {
    supabaseRunning = await isSupabaseRunning();
    if (!supabaseRunning) {
      console.warn(
        "\n⚠️  Local Supabase is not running. Skipping integration tests."
      );
      console.warn("   Run `supabase start` to enable these tests.\n");
    }
  });

  afterEach(async () => {
    // Clean up created users after each test
    for (const userId of createdUserIds) {
      try {
        await deleteUser(userId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdUserIds.length = 0;
  });

  it("should create a user with valid email and password", async ({
    skip,
  }) => {
    if (!supabaseRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);
    createdUserIds.push(user.id);

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe(email);
    expect(user.email_confirmed_at).toBeDefined();
  });

  it("should retrieve a created user by ID", async ({ skip }) => {
    if (!supabaseRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const createdUser = await createUser(email, password);
    createdUserIds.push(createdUser.id);

    const retrievedUser = await getUser(createdUser.id);

    expect(retrievedUser.id).toBe(createdUser.id);
    expect(retrievedUser.email).toBe(email);
  });

  it("should fail to create a user with duplicate email", async ({ skip }) => {
    if (!supabaseRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);
    createdUserIds.push(user.id);

    await expect(createUser(email, password)).rejects.toThrow();
  });

  it("should allow signing in with created user credentials", async ({
    skip,
  }) => {
    if (!supabaseRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);
    createdUserIds.push(user.id);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(email);
  });

  it("should delete a user successfully", async ({ skip }) => {
    if (!supabaseRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);

    await deleteUser(user.id);

    await expect(getUser(user.id)).rejects.toThrow();
  });
});
