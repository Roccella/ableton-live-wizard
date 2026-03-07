#!/bin/zsh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_file="$repo_root/support/AbletonMCP/__init__.py"
target_dir="$HOME/Music/Ableton/User Library/Remote Scripts/AbletonMCP"
target_file="$target_dir/__init__.py"

mkdir -p "$target_dir"

if [[ -f "$target_file" ]]; then
  backup_path="$target_file.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$target_file" "$backup_path"
  echo "Backed up existing Remote Script to:"
  echo "  $backup_path"
fi

cp "$source_file" "$target_file"

echo "Installed AbletonMCP Remote Script:"
echo "  source: $source_file"
echo "  target: $target_file"
echo
echo "Next steps in Ableton Live:"
echo "  Preferences > Link, Tempo & MIDI"
echo "  Control Surface: AbletonMCP"
echo "  Input: None"
echo "  Output: None"
