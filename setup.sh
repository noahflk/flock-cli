#!/usr/bin/env bash
set -euo pipefail

FLOCK_REPO="https://github.com/noahflk/flock-cli.git"
FLOCK_DIR="$HOME/flock-cli"
FLOCK_CONFIG_DIR="$HOME/.flock"
FLOCK_PORT=3000

# --- Check prerequisites ---
MISSING=()
command -v git &>/dev/null   || MISSING+=("git       — https://git-scm.com/downloads")
command -v gh &>/dev/null    || MISSING+=("gh        — https://cli.github.com")
command -v claude &>/dev/null || MISSING+=("claude    — https://claude.ai/download")
command -v codex &>/dev/null || MISSING+=("codex     — npm i -g @openai/codex")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Error: the following required tools are not installed:"
  echo ""
  for tool in "${MISSING[@]}"; do
    echo "  • $tool"
  done
  echo ""
  echo "Install them and re-run this script."
  exit 1
fi

GH_PATH="$(command -v gh)"
CLAUDE_PATH="$(command -v claude)"
CODEX_PATH="$(command -v codex)"

# --- System dependencies ---
if ! command -v unzip &>/dev/null; then
  echo "=== Installing system dependencies ==="
  sudo apt-get update -y && sudo apt-get install -y unzip
else
  echo "=== System dependencies already installed, skipping ==="
fi

# --- Node.js (skip nvm if node >= 20 already available) ---
if command -v node &>/dev/null && [ "$(node -v | sed 's/v//' | cut -d. -f1)" -ge 20 ]; then
  echo "=== Node.js $(node -v) already installed, skipping nvm ==="
else
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    echo "=== Installing nvm ==="
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  else
    echo "=== nvm already installed, skipping ==="
  fi
  \. "$NVM_DIR/nvm.sh"
  if ! nvm ls 24 &>/dev/null; then
    echo "=== Installing Node.js 24 ==="
    nvm install 24
  else
    echo "=== Node.js 24 already installed, skipping ==="
    nvm use 24
  fi
fi

# --- Bun ---
if ! command -v bun &>/dev/null; then
  echo "=== Installing Bun ==="
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
else
  echo "=== Bun already installed, skipping ==="
fi

# --- Clone/update repo ---
echo "=== Updating flock-cli ==="
if [ -d "$FLOCK_DIR" ]; then
  git -C "$FLOCK_DIR" pull
else
  git clone "$FLOCK_REPO" "$FLOCK_DIR"
fi

# --- Install dependencies ---
echo "=== Installing dependencies ==="
cd "$FLOCK_DIR"
bun install

# --- Server config ---
mkdir -p "$FLOCK_CONFIG_DIR"
CONFIG_PATH="$FLOCK_CONFIG_DIR/server-config.json"
CONFIG_ALREADY_EXISTS=0

if [ -f "$CONFIG_PATH" ]; then
  CONFIG_ALREADY_EXISTS=1
fi

echo "=== Syncing server config ==="
FLOCK_SERVER_CONFIG_TARGET="$CONFIG_PATH" \
FLOCK_SERVER_DEFAULT_PORT="$FLOCK_PORT" \
GH_PATH="$GH_PATH" \
CLAUDE_PATH="$CLAUDE_PATH" \
CODEX_PATH="$CODEX_PATH" \
node <<'EOF'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const configPath = process.env.FLOCK_SERVER_CONFIG_TARGET;
const defaultPort = Number(process.env.FLOCK_SERVER_DEFAULT_PORT);

let existing = {};

if (configPath && fs.existsSync(configPath)) {
  existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const parsedPort = Number(existing.port);
const port =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : defaultPort;

const secret =
  typeof existing.secret === "string" && existing.secret.trim().length > 0
    ? existing.secret.trim()
    : crypto.randomBytes(32).toString("hex");

const next = {
  ...existing,
  secret,
  port,
  claudePath: process.env.CLAUDE_PATH,
  codexPath: process.env.CODEX_PATH,
  ghPath: process.env.GH_PATH,
};

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
EOF

if [ "$CONFIG_ALREADY_EXISTS" -eq 0 ]; then
  echo "Config written to $CONFIG_PATH"
else
  echo "Config updated at $CONFIG_PATH"
fi

# --- Systemd service (Debian/Ubuntu only) ---
if [ -d /run/systemd/system ] && command -v systemctl &>/dev/null; then
  SERVICE_FILE="/etc/systemd/system/flock.service"
  if [ ! -f "$SERVICE_FILE" ]; then
    echo "=== Setting up systemd service ==="
    sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Flock API Server
After=network.target

[Service]
User=$USER
WorkingDirectory=$FLOCK_DIR
ExecStart=$HOME/.bun/bin/bun run serve
Restart=always
Environment=PATH=$HOME/.bun/bin:$HOME/.nvm/versions/node/$(node -v)/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable flock
    echo "Systemd service installed and enabled."
    echo "Start it with: sudo systemctl start flock"
  else
    echo "=== Systemd service already exists, skipping ==="
  fi
else
  echo "=== Systemd not detected, skipping service setup ==="
fi

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Authenticate (if not already done):"
echo "     $ claude          # Anthropic"
echo "     $ codex           # OpenAI"
echo "     $ gh auth login   # GitHub"
echo ""
echo "  2. Start the server:"
echo "     $ sudo systemctl start flock"
echo ""
echo "  The API will be available at http://<your-ip>:$FLOCK_PORT"
echo "  Authenticate with header: x-flock-secret: <your-secret>"
echo ""
