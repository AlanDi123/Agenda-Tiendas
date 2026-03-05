#!/bin/bash

# ============================================
# bump-version.sh
# 
# Script para actualizar versiones automáticamente
# - Actualiza package.json
# - Actualiza android/app/build.gradle
# - Crea commit
# - Crea tag vX.X.X
# ============================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para mostrar uso
usage() {
    echo "Uso: $0 [major|minor|patch|<version>]"
    echo ""
    echo "Ejemplos:"
    echo "  $0 patch    # Incrementa 1.0.0 -> 1.0.1"
    echo "  $0 minor    # Incrementa 1.0.0 -> 1.1.0"
    echo "  $0 major    # Incrementa 1.0.0 -> 2.0.0"
    echo "  $0 1.2.3    # Establece versión específica"
    exit 1
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json no encontrado${NC}"
    echo "Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Obtener versión actual
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
echo -e "${YELLOW}Versión actual: ${CURRENT_VERSION}${NC}"

# Determinar nueva versión
if [ -z "$1" ]; then
    usage
fi

case "$1" in
    major)
        NEW_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{print ($1+1)".0.0"}')
        ;;
    minor)
        NEW_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{print $1".(" $2+1)".0"}')
        ;;
    patch)
        NEW_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{print $1"."$2".("$3+1)}')
        ;;
    *)
        # Validar formato de versión
        if ! [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo -e "${RED}Error: Formato de versión inválido${NC}"
            echo "Usa formato X.Y.Z (ej: 1.2.3)"
            exit 1
        fi
        NEW_VERSION="$1"
        ;;
esac

echo -e "${GREEN}Nueva versión: ${NEW_VERSION}${NC}"

# Convertir versión a versionCode (ej: 1.2.3 -> 10203)
VERSION_CODE=$(echo "$NEW_VERSION" | awk -F. '{printf "%d%02d%02d", $1, $2, $3}')

# Actualizar package.json
echo -e "${YELLOW}Actualizando package.json...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

# Actualizar android/app/build.gradle
if [ -f "android/app/build.gradle" ]; then
    echo -e "${YELLOW}Actualizando android/app/build.gradle...${NC}"
    
    # Actualizar versionName
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
        sed -i '' "s/versionCode [0-9]*/versionCode $VERSION_CODE/" android/app/build.gradle
    else
        sed -i "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
        sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/" android/app/build.gradle
    fi
    
    echo -e "${GREEN}✓ build.gradle actualizado (versionName: $NEW_VERSION, versionCode: $VERSION_CODE)${NC}"
else
    echo -e "${YELLOW}⚠ android/app/build.gradle no encontrado, saltando...${NC}"
fi

# Commit
echo -e "${YELLOW}Creando commit...${NC}"
git add package.json android/app/build.gradle 2>/dev/null || true
git commit -m "chore: bump version to $NEW_VERSION" || echo -e "${YELLOW}⚠ No hay cambios para commitear${NC}"

# Tag
echo -e "${YELLOW}Creando tag v$NEW_VERSION...${NC}"
git tag "v$NEW_VERSION"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✓ Versión actualizada exitosamente${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "${YELLOW}Versión: ${NEW_VERSION} (${VERSION_CODE})${NC}"
echo ""
echo -e "${YELLOW}Para push, ejecuta:${NC}"
echo "  git push origin main && git push origin v$NEW_VERSION"
echo ""
echo -e "${YELLOW}O usa el atajo:${NC}"
echo "  git push origin main --tags"
