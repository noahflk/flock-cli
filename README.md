# Flock CLI

Manage headless Claude and Codex AI sessions across multiple repositories and workspaces.

Flock provides both a CLI and an API server for creating sessions, sending messages, and managing repos — designed to run on a Linux server and orchestrate coding agents at scale.

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

## Development

```bash
bun install
bun run check    # typecheck + lint + test
bun run serve    # start API server locally
```
