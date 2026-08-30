import { describe, expect, it } from "vitest";
import { getMessageCreatedAt } from "../message-metadata";

describe("getMessageCreatedAt", () => {
  it("parses valid persisted timestamps", () => {
    expect(
      getMessageCreatedAt({ createdAt: "2026-08-28T12:00:00.000Z" })?.toISOString()
    ).toBe("2026-08-28T12:00:00.000Z");
  });

  it("rejects missing and invalid timestamps", () => {
    expect(getMessageCreatedAt({})).toBeUndefined();
    expect(getMessageCreatedAt({ createdAt: "not-a-date" })).toBeUndefined();
    expect(getMessageCreatedAt(null)).toBeUndefined();
  });
});
