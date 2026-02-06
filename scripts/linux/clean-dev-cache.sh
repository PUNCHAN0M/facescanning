#!/bin/bash

# Clean React Nest Template Development Cache
# * chmod +x scripts/linux/clean-dev-cache.sh
# * ./scripts/linux/clean-dev-cache.sh

echo "🧹 Cleaning React Nest Template Development Cache..."
echo

# Navigate to project root
PROJECT_ROOT="$(dirname "$0")/../.."
cd "$PROJECT_ROOT"

# --- PNPM ---
if command -v pnpm >/dev/null 2>&1; then
  STORE_PATH=$(pnpm store path)
  echo "PNPM STORE_PATH is \"$STORE_PATH\""

  echo "Pruning PNPM store..."
  pnpm store prune

  if [ -d "$STORE_PATH" ]; then
    echo "Removing PNPM store at \"$STORE_PATH\""
    rm -rf "$STORE_PATH"
    if [ -d "$STORE_PATH" ]; then
      echo "Failed to remove PNPM store folder."
    else
      echo "PNPM store folder removed successfully."
    fi
  else
    echo "PNPM store folder not found, skipping removal."
  fi
else
  echo "PNPM not found, skipping..."
fi
echo "--- Passed PNPM ---"
echo

# --- NPM ---
if command -v npm >/dev/null 2>&1; then
  echo "Cleaning NPM cache..."
  npm cache verify
  echo "NPM cache verified."
else
  echo "NPM not found, skipping..."
fi
echo "--- Passed NPM ---"
echo

# --- NPX cache ---
NPX_CACHE="$HOME/Library/Caches/npm/_npx"
echo "Checking NPX cache at \"$NPX_CACHE\""
if [ -d "$NPX_CACHE" ]; then
  echo "Removing NPX cache..."
  rm -rf "$NPX_CACHE"
  if [ -d "$NPX_CACHE" ]; then
    echo "Failed to remove NPX cache."
  else
    echo "NPX cache removed successfully."
  fi
else
  echo "NPX cache not found."
fi
echo "--- Passed NPX ---"
echo

# --- Python pip cache ---
PIP_CACHE="$HOME/Library/Caches/pip"
echo "Checking pip cache at \"$PIP_CACHE\""
if [ -d "$PIP_CACHE" ]; then
  echo "Removing pip cache..."
  rm -rf "$PIP_CACHE"
  if [ -d "$PIP_CACHE" ]; then
    echo "Failed to remove pip cache."
  else
    echo "pip cache removed successfully."
  fi
else
  echo "pip cache not found."
fi
echo "--- Passed PIP ---"
echo

# --- Yarn ---
if command -v yarn >/dev/null 2>&1; then
  echo "Cleaning Yarn cache..."
  yarn cache clean
  echo "Yarn cache cleaned."
else
  echo "Yarn not found, skipping..."
fi
echo "--- Passed Yarn ---"
echo

echo "All caches cleaned successfully."
