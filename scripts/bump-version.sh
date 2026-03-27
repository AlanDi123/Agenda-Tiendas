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
# Convertir versión a versionCode (matemáticamente para evitar octales con ceros a la izquierda)
NEW_CODE=$(echo "$NEW_VERSION" | awk -F. '{print $1 * 10000 + $2 * 100 + $3}')

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
