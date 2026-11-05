#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: ./install.sh /caminho/do/vault"
  exit 1
fi

VAULT="$1"
PLUGIN_ID="webview-text-selector"
DEST="$VAULT/.obsidian/plugins/$PLUGIN_ID"

if [ ! -d "$VAULT/.obsidian" ]; then
  echo "Erro: '$VAULT' não parece ser um vault do Obsidian (pasta .obsidian não encontrada)."
  exit 1
fi

cd "$(dirname "$0")"
npm run build

mkdir -p "$DEST"
cp main.js manifest.json "$DEST/"

echo "Plugin instalado em: $DEST"
echo "Ative-o em Configurações → Plugins da comunidade dentro do Obsidian."
