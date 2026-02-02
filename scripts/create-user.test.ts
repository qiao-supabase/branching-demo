import { describe, it, expect, afterEach, beforeAll } from "vitest";
import {
  createUser,
  deleteUser,
  getUser,
  signInWithPassword,
  SUPABASE_URL,
} from "./create-user";

async function isAuthServiceRunning(): Promise<boolean> {
  // Try both endpoints: /health for standalone GoTrue, /auth/v1/health for full Supabase
  const endpoints = [
    `${SUPABASE_URL}/health`,
    `${SUPABASE_URL}/auth/v1/health`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return true;
    } catch {
      // Try next endpoint
    }
  }
  return false;
}

describe("create-user", () => {
  const createdUserIds: string[] = [];
  let authServiceRunning = false;

  beforeAll(async () => {
    authServiceRunning = await isAuthServiceRunning();
    if (!authServiceRunning) {
      console.warn(
        "\n⚠️  Auth service is not running. Skipping integration tests."
      );
      console.warn(
        "   Run `supabase start` or start GoTrue standalone to enable these tests.\n"
      );
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
    if (!authServiceRunning) skip();

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
    if (!authServiceRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const createdUser = await createUser(email, password);
    createdUserIds.push(createdUser.id);

    const retrievedUser = await getUser(createdUser.id);

    expect(retrievedUser.id).toBe(createdUser.id);
    expect(retrievedUser.email).toBe(email);
  });

  it("should fail to create a user with duplicate email", async ({ skip }) => {
    if (!authServiceRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);
    createdUserIds.push(user.id);

    await expect(createUser(email, password)).rejects.toThrow();
  });

  it("should allow signing in with created user credentials", async ({
    skip,
  }) => {
    if (!authServiceRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);
    createdUserIds.push(user.id);

    const { user: signedInUser, access_token } = await signInWithPassword(
      email,
      password
    );

    expect(access_token).toBeDefined();
    expect(signedInUser).toBeDefined();
    expect(signedInUser?.email).toBe(email);
  });

  it("should delete a user successfully", async ({ skip }) => {
    if (!authServiceRunning) skip();

    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";

    const user = await createUser(email, password);

    await deleteUser(user.id);

    await expect(getUser(user.id)).rejects.toThrow();
  });
});
