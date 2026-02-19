import { describe, expect, it } from "bun:test";
import { parseRepoInput } from "../../src/lib/git.ts";
import { FlockError } from "../../src/lib/types.ts";

describe("parseRepoInput", () => {
  it("parses owner/repo shorthand into a GitHub URL", () => {
    expect(parseRepoInput("acme/widget")).toEqual({
      url: "https://github.com/acme/widget",
      name: "widget",
    });
  });

  it("strips .git from shorthand repo names", () => {
    expect(parseRepoInput("acme/widget.git")).toEqual({
      url: "https://github.com/acme/widget.git",
      name: "widget",
    });
  });

  it("parses HTTPS URLs and trims whitespace", () => {
    expect(parseRepoInput("  https://github.com/acme/widget.git  ")).toEqual({
      url: "https://github.com/acme/widget.git",
      name: "widget",
    });
  });

  it("parses SSH URLs", () => {
    expect(parseRepoInput("git@github.com:acme/widget.git")).toEqual({
      url: "git@github.com:acme/widget.git",
      name: "widget",
    });
  });

  it("throws INVALID_REPO_INPUT for empty input", () => {
    expect(() => parseRepoInput("   ")).toThrow(FlockError);

    try {
      parseRepoInput("   ");
      throw new Error("Expected parseRepoInput to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_REPO_INPUT");
    }
  });

  it("throws INVALID_REPO_INPUT for unparseable inputs", () => {
    const input = "not a valid repo input";
    expect(() => parseRepoInput(input)).toThrow(FlockError);

    try {
      parseRepoInput(input);
      throw new Error("Expected parseRepoInput to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(FlockError);
      expect((error as FlockError).code).toBe("INVALID_REPO_INPUT");
      expect((error as FlockError).message).toContain(input);
    }
  });
});
