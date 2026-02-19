# Flock CLI

## Architecture

- `core/` = pure logic: typed inputs → typed outputs, no CLI I/O. Designed so a future API server can import `core/` directly.
- `commands/` = thin CLI wrappers: parse args → call core → `printResult`.
- `lib/` = shared utilities.
- Errors are `FlockError` with typed error codes.

## After Every Change

Run `bun run check` (typecheck + lint + tests) after every code change and fix any errors before moving on.

```
bun run check
```

## Testing Philosophy

- Prioritize behavior with the highest risk and business impact, not raw coverage percentage.
- Prefer deterministic unit tests for parsing, validation, and state transitions.
- Add integration-style tests only where module boundaries matter (filesystem, git, CLI flow).
- Assert observable outcomes (return values, errors, output), not internal implementation details.
- Cover happy paths plus a focused set of failure/edge cases that are likely in real usage.
- Keep tests fast, isolated, and readable so they are trusted and maintained over time.
