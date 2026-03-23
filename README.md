# Flock CLI

Manage headless Claude and Codex AI sessions across multiple repositories and workspaces. Designed to run on a Linux server and orchestrate coding agents at scale.

## Deploy

Install the prerequisites first:

- [git](https://git-scm.com/downloads)
- [gh](https://cli.github.com) (GitHub CLI)
- [claude](https://claude.ai/download) (Claude Code)
- [codex](https://www.npmjs.com/package/@openai/codex) (`npm i -g @openai/codex`)

Then run the setup script:

```bash
curl -fsSL https://raw.githubusercontent.com/noahflk/flock-cli/main/setup.sh | bash
```

This installs Bun and Node.js, clones the repo to `~/flock-cli`, generates a server config, and sets up a systemd service. The script will fail early if any prerequisites are missing.

Then start the server:

```bash
sudo systemctl start flock
```

The API will be available at `http://<your-ip>:3000`. Your secret is in `~/.flock/server-config.json`.

The generated `~/.flock/server-config.json` also stores the absolute paths detected by `command -v` for `claude`, `codex`, and `gh`. That keeps the API server working under `systemd` even when the service `PATH` is minimal.

Example:

```json
{
  "secret": "...",
  "port": 3000,
  "claudePath": "<output of command -v claude>",
  "codexPath": "<output of command -v codex>",
  "ghPath": "/usr/bin/gh"
}
```

## CLI Commands

### `flock clone <repo>`

Clone a repository into `~/repos`. Accepts a GitHub slug (`owner/repo`) or a full URL.

```bash
flock clone acme/my-app
```

### `flock new <repo>`

Create a new workspace as a git worktree for the given repo.

```bash
flock new my-app
```

### `flock send <repo> <message> [--model claude|codex]`

Send a prompt to a repo. Defaults to Claude.

```bash
flock send my-app "fix the failing tests"
```

### `flock send workspace <workspace> <message> [--model claude|codex]`

Send a prompt to a specific workspace instead of the main repo.

```bash
flock send workspace my-app/fix-bug "add error handling to the parser"
```

### `flock pr <repo> <workspace>`

Send a PR request prompt to the workspace session's AI, including the current branch and uncommitted change count.

```bash
flock pr my-app fix-bug
```

### `flock archive <repo> <workspace>`

Archive a workspace by removing its git worktree.

```bash
flock archive my-app fix-bug
```

### `flock list repos [--all]`

List cloned repos. Use `--all` to include repos without a GitHub origin.

### `flock list workspaces [repo]`

List all workspaces, optionally filtered by repo name.

### `flock update`

Pull the latest version, reinstall dependencies, and restart `flock.service` when new code is installed.

## API

All routes except `/health` require the `x-flock-secret` header. See [api.md](api.md) for full documentation.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/health` | Health check (no auth) |
| `GET` | `/repos` | List cloned repos |
| `POST` | `/repos` | Clone a repo by GitHub slug |
| `GET` | `/sessions` | List sessions |
| `POST` | `/sessions` | Create a session |
| `DELETE` | `/sessions/:id` | Archive a session |
| `GET` | `/sessions/:id/messages` | Get messages |
| `POST` | `/sessions/:id/messages` | Send a message |
| `POST` | `/sessions/:id/cancel` | Cancel a running message |
| `POST` | `/workspaces/:repo/:workspace/pr` | Ask a workspace session to create a PR |

## Development

```bash
bun install
bun run check    # typecheck + lint + test
bun run serve    # start API server locally
```
