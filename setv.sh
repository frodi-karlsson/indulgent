# Replaces the versions in all nested package.json files with the input version
# Usage: ./setv.sh <version>
if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION="$1"

find . -name "package.json" -exec sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" {} \;
echo "Set version to $VERSION in all package.json files"