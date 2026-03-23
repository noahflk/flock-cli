import { describe, expect, it } from "bun:test";
import { formatUpdateMessage } from "../../src/commands/update.ts";

describe("formatUpdateMessage", () => {
  it("renders a success message with the pull summary", () => {
    expect(formatUpdateMessage(true, "Updating cd24815..d80c4ed")).toBe(
      "Flock updated successfully.\nUpdating cd24815..d80c4ed",
    );
  });

  it("renders an already-up-to-date message without raw git output", () => {
    expect(formatUpdateMessage(false, "Already up to date.")).toBe(
      "Flock is already up to date.",
    );
  });
});
