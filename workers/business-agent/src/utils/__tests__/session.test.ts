import { describe, expect, it, vi } from "vitest";
import { getVerifiedSessionFromRequest } from "../session";

function createDatabase(row: Record<string, unknown> | null): D1Database {
  const first = vi.fn(async () => row);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare } as unknown as D1Database;
}

describe("getVerifiedSessionFromRequest", () => {
  it("rejects a forged cookie when the session is absent from D1", async () => {
    const request = new Request("https://agent.example/", {
      headers: { Cookie: "admin_session=forged-session" }
    });

    await expect(
      getVerifiedSessionFromRequest(request, createDatabase(null))
    ).resolves.toBeNull();
  });

  it("accepts a current D1-backed session", async () => {
    const request = new Request("https://agent.example/", {
      headers: { Cookie: "admin_session=verified-session" }
    });
    const database = createDatabase({
      id: "verified-session",
      user_email: "admin@example.com",
      expires_at: Math.floor(Date.now() / 1000) + 300,
      last_activity: 1
    });

    await expect(
      getVerifiedSessionFromRequest(request, database)
    ).resolves.toEqual({
      sessionId: "verified-session",
      ownerId: "admin@example.com",
      expiresAt: expect.any(Number),
      lastActivity: 1
    });
  });
});
