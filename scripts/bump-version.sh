#!/usr/bin/env bash
# bump-version.sh — Incrementa la versión del proyecto y crea un git tag
# Uso: bash scripts/bump-version.sh [patch|minor|major]
set -euo pipefail

BUMP_TYPE="${1:-patch}"

# ─── Leer versión actual desde package.json ───────────────────────────────────
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  *) echo "Tipo inválido: $BUMP_TYPE. Usar patch, minor o major."; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
# versionCode como entero concatenado (ej. 1.0.2 → 10002)
NEW_CODE=$(printf "%d%02d%02d" "$MAJOR" "$MINOR" "$PATCH")

echo "🔖 Bumping: $CURRENT → $NEW_VERSION (versionCode: $NEW_CODE)"

# ─── Actualizar package.json ─────────────────────────────────────────────────
npm version "$NEW_VERSION" --no-git-tag-version

# ─── Actualizar android/app/build.gradle ─────────────────────────────────────
GRADLE="android/app/build.gradle"
sed -i "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" "$GRADLE"
sed -i "s/versionCode [0-9]*/versionCode $NEW_CODE/" "$GRADLE"
echo "✅ build.gradle actualizado"

# ─── Commit y tag ────────────────────────────────────────────────────────────
git add package.json package-lock.json "$GRADLE"
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "🚀 Listo. Ejecutando: git push origin main --tags"
