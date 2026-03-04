#!/bin/bash
# Version Bumping Script
# Updates version in package.json, Android build.gradle, and creates git tag
#
# Usage:
#   ./scripts/bump-version.sh [major|minor|patch|version]
#
# Examples:
#   ./scripts/bump-version.sh major    # 1.4.2 -> 2.0.0
#   ./scripts/bump-version.sh minor    # 1.4.2 -> 1.5.0
#   ./scripts/bump-version.sh patch    # 1.4.2 -> 1.4.3
#   ./scripts/bump-version.sh 2.1.0    # Set specific version

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Determine new version
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please specify version bump type (major|minor|patch) or specific version${NC}"
    exit 1
fi

case "$1" in
    major)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{printf "%d.0.0", $1+1}')
        ;;
    minor)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{printf "%d.%d.0", $1, $2+1}')
        ;;
    patch)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}')
        ;;
    *)
        # Validate semver format
        if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo -e "${RED}Error: Invalid version format. Use semantic versioning (e.g., 1.4.2)${NC}"
            exit 1
        fi
        NEW_VERSION="$1"
        ;;
esac

# Calculate version code (e.g., 1.4.2 -> 10402)
VERSION_CODE=$(echo "$NEW_VERSION" | awk -F. '{ printf "%d%02d%02d", $1, $2, $3 }')

echo -e "${YELLOW}New version: ${NEW_VERSION} (${VERSION_CODE})${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted${NC}"
    exit 1
fi

# Update package.json
echo -e "${GREEN}Updating package.json...${NC}"
npm version "$NEW_VERSION" --no-git-tag-version

# Update Android build.gradle
echo -e "${GREEN}Updating Android build.gradle...${NC}"
if [ -f "android/app/build.gradle" ]; then
    # Update versionName
    sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
    # Update versionCode
    sed -i.bak "s/versionCode [0-9]*/versionCode $VERSION_CODE/" android/app/build.gradle
    # Remove backup file
    rm -f android/app/build.gradle.bak
    echo -e "${GREEN}Android build.gradle updated${NC}"
else
    echo -e "${YELLOW}Warning: android/app/build.gradle not found${NC}"
fi

# Update capacitor.config.ts if exists
if [ -f "capacitor.config.ts" ]; then
    echo -e "${GREEN}capacitor.config.ts found (no version update needed)${NC}"
fi

# Create git commit
echo -e "${GREEN}Creating git commit...${NC}"
git add package.json package-lock.json android/app/build.gradle
git commit -m "chore: bump version to $NEW_VERSION ($VERSION_CODE)" || echo "No changes to commit"

# Create git tag
echo -e "${GREEN}Creating git tag v${NEW_VERSION}...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo -e "${GREEN}✓ Version bumped successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Push changes: git push origin main"
echo "  2. Push tag: git push origin v$NEW_VERSION"
echo "  3. GitHub Actions will automatically build and release APK"
echo ""
echo -e "${YELLOW}Or to push everything:${NC}"
echo "  git push origin main && git push origin v$NEW_VERSION"
