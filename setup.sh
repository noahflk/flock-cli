#!/usr/bin/env bash
set -euo pipefail

FLOCK_REPO="https://github.com/noahflk/flock-cli.git"
FLOCK_DIR="$HOME/flock-cli"
FLOCK_CONFIG_DIR="$HOME/.flock"
FLOCK_PORT=3000

# --- System dependencies ---
if ! command -v unzip &>/dev/null; then
  echo "=== Installing system dependencies ==="
  sudo apt-get update -y && sudo apt-get install -y unzip
else
  echo "=== System dependencies already installed, skipping ==="
fi

# --- nvm + Node.js ---
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

# --- Bun ---
if ! command -v bun &>/dev/null; then
  echo "=== Installing Bun ==="
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
else
  echo "=== Bun already installed, skipping ==="
fi

# --- Claude CLI ---
if ! command -v claude &>/dev/null; then
  echo "=== Installing Claude CLI ==="
  curl -fsSL https://claude.ai/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
else
  echo "=== Claude CLI already installed, skipping ==="
fi
if ! grep -q 'export PATH="\$HOME/.local/bin:\$PATH"' "$HOME/.bashrc" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
fi

# --- Codex CLI ---
if ! command -v codex &>/dev/null; then
  echo "=== Installing Codex CLI ==="
  npm i -g @openai/codex
else
  echo "=== Codex CLI already installed, skipping ==="
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
if [ ! -f "$FLOCK_CONFIG_DIR/server-config.json" ]; then
  echo "=== Creating server config ==="
  SECRET=$(openssl rand -hex 32)
  cat > "$FLOCK_CONFIG_DIR/server-config.json" <<EOF
{
  "secret": "$SECRET",
  "port": $FLOCK_PORT
}
EOF
  echo "Generated secret: $SECRET"
  echo "Config written to $FLOCK_CONFIG_DIR/server-config.json"
else
  echo "=== Server config already exists, skipping ==="
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
echo "  1. Log in to your AI providers:"
echo "     $ claude    # authenticate with Anthropic"
echo "     $ codex     # authenticate with OpenAI"
echo ""
echo "  2. Start the server:"
echo "     $ sudo systemctl start flock"
echo ""
echo "  The API will be available at http://<your-ip>:$FLOCK_PORT"
echo "  Authenticate with header: x-flock-secret: <your-secret>"
echo ""
