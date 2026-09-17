#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$PROJECT_ROOT/src-tauri/target"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

du_safe() {
  du -sh "$1" 2>/dev/null | cut -f1 || echo "0"
}

echo "=== Tauri cleanup: $PROJECT_NAME ==="
echo ""

if [ ! -d "$TARGET_DIR" ]; then
  echo "target/ не найден — нечего чистить."
  exit 0
fi

BEFORE=$(du_safe "$TARGET_DIR")
echo "target до очистки: $BEFORE"
echo ""

echo "Удаление тяжёлых артефактов..."
rm -rf "$TARGET_DIR/debug"
rm -rf "$TARGET_DIR/release/build"
rm -rf "$TARGET_DIR/release/deps"
rm -rf "$TARGET_DIR/release/.fingerprint"
rm -rf "$TARGET_DIR/release/incremental"
rm -rf "$TARGET_DIR/release/examples"
rm -rf "$TARGET_DIR/release/.cargo-lock"
rm -rf "$TARGET_DIR/tmp"
rm -rf "$TARGET_DIR/doc"

find "$TARGET_DIR/release" -maxdepth 1 -name "*.d" -delete 2>/dev/null || true
find "$TARGET_DIR/release" -maxdepth 1 -name "*.rlib" -delete 2>/dev/null || true
find "$TARGET_DIR/release" -maxdepth 1 -name "*.rmeta" -delete 2>/dev/null || true
find "$TARGET_DIR/release" -maxdepth 1 -name "*.pdb" -delete 2>/dev/null || true
find "$TARGET_DIR/release" -maxdepth 1 -name "*.exp" -delete 2>/dev/null || true
find "$TARGET_DIR/release" -maxdepth 1 -name "*.lib" -delete 2>/dev/null || true

AFTER=$(du_safe "$TARGET_DIR")

echo ""
echo "target до очистки:  $BEFORE"
echo "target после:       $AFTER"
echo ""
echo "Установщики сохранены в: src-tauri/target/release/bundle/"
echo "=== Готово! ==="
