#!/usr/bin/env bash
set -euo pipefail

FLOCK_REPO="https://github.com/noahflk/flock-cli.git"
FLOCK_DIR="$HOME/flock-cli"
FLOCK_CONFIG_DIR="$HOME/.flock"
FLOCK_PORT=3000

echo "=== Installing nvm + Node.js 24 ==="
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
\. "$HOME/.nvm/nvm.sh"
nvm install 24

echo "=== Installing Bun ==="
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "=== Installing Claude CLI ==="
curl -fsSL https://claude.ai/install.sh | bash
export PATH="$HOME/.claude/local/bin:$PATH"

echo "=== Installing Codex CLI ==="
npm i -g @openai/codex

echo "=== Cloning flock-cli ==="
if [ -d "$FLOCK_DIR" ]; then
  echo "Directory $FLOCK_DIR already exists, pulling latest..."
  git -C "$FLOCK_DIR" pull
else
  git clone "$FLOCK_REPO" "$FLOCK_DIR"
fi

echo "=== Installing dependencies ==="
cd "$FLOCK_DIR"
bun install

echo "=== Creating server config ==="
mkdir -p "$FLOCK_CONFIG_DIR"
if [ ! -f "$FLOCK_CONFIG_DIR/server-config.json" ]; then
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
  echo "Config already exists at $FLOCK_CONFIG_DIR/server-config.json, skipping."
fi

echo ""
echo "=== Setup complete ==="
echo "Start the server with:"
echo "  cd $FLOCK_DIR && bun run serve"
echo ""
echo "The API will be available at http://<your-ip>:$FLOCK_PORT"
echo "Authenticate with header: x-flock-secret: <your-secret>"
