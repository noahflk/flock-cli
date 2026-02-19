import { describe, expect, it } from "bun:test";
import { parseGitHubSlug } from "../../src/lib/git.ts";
import { FlockError } from "../../src/lib/types.ts";

describe("parseGitHubSlug", () => {
  it("parses owner/repo input", () => {
    expect(parseGitHubSlug("acme/widget")).toEqual({
      slug: "acme/widget",
      name: "widget",
    });
  });

  it("strips .git suffix from the repo name", () => {
    expect(parseGitHubSlug("acme/widget.git")).toEqual({
      slug: "acme/widget",
      name: "widget",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseGitHubSlug("  acme/widget  ")).toEqual({
      slug: "acme/widget",
      name: "widget",
    });
  });

  it("throws INVALID_REPO_INPUT for empty input", () => {
    expect(() => parseGitHubSlug("   ")).toThrow(FlockError);

    try {
      parseGitHubSlug("   ");
      throw new Error("Expected parseGitHubSlug to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_REPO_INPUT");
    }
  });

  it("throws INVALID_REPO_INPUT for non-slug input", () => {
    const input = "https://github.com/acme/widget";
    expect(() => parseGitHubSlug(input)).toThrow(FlockError);

    try {
      parseGitHubSlug(input);
      throw new Error("Expected parseGitHubSlug to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_REPO_INPUT");
      expect((error as FlockError).message).toContain(input);
    }
  });
});
