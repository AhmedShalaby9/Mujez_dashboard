#!/usr/bin/env bash
set -Eeuo pipefail
releases=${1:?Releases path required}
release_id=${2:?Release ID required}
dashboard_url=${3:?Dashboard URL required}
[[ "$releases" =~ ^/var/www/[a-zA-Z0-9_/-]+/releases$ ]] || exit 2
[[ "$release_id" =~ ^[a-zA-Z0-9-]+$ ]] || exit 2
[[ "$dashboard_url" =~ ^https://[a-zA-Z0-9.-]+$ ]] || exit 2
exec 9>/var/lock/mujez-staging-dashboard.lock
flock -w 600 9
release="$releases/$release_id"
current="$(dirname "$releases")/current"
test ! -e "$release"
test -L "$current"
previous=$(readlink -f "$current")
install -d -m 755 "$release"
tar -xzf "/tmp/mujez-dashboard-$release_id/dashboard.tar.gz" -C "$release"
test -s "$release/index.html"
test -s "$release/runtime-config.json"
printf '%s\n' "$release_id" > "$release/deployment-version.txt"
chmod -R a+rX "$release"
ln -s "$release" "$current-next-$release_id"
mv -Tf "$current-next-$release_id" "$current"
host=${dashboard_url#https://}
if ! version=$(curl --fail --silent --show-error --max-time 15 \
    --resolve "$host:443:127.0.0.1" "$dashboard_url/deployment-version.txt") || [[ "$version" != "$release_id" ]]; then
  ln -s "$previous" "$current-rollback-$release_id"
  mv -Tf "$current-rollback-$release_id" "$current"
  echo 'Dashboard verification failed; previous release restored.' >&2
  exit 1
fi
echo "Dashboard release $release_id deployed"
