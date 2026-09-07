#!/bin/sh
set -eu
image=${1:?usage: test-image.sh IMAGE}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
run_id="estoma-front-smoke-$$"
cleanup() {
  docker rm -f "$run_id-web" "$run_id-bff" >/dev/null 2>&1 || true
  docker network rm "$run_id" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker network create --internal "$run_id" >/dev/null
docker run -d --name "$run_id-bff" --network "$run_id" \
  --network-alias platform-bff.develop.svc.cluster.local --memory 128m --cpus .5 \
  -v "$script_dir:/checks:ro" python:3.12-slim python /checks/mock-bff.py >/dev/null
docker run -d --name "$run_id-web" --network "$run_id" --network-alias frontend \
  --user 101:101 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges --memory 128m --cpus .5 "$image" >/dev/null
if ! docker exec "$run_id-bff" python /checks/assert-image.py; then
  docker logs "$run_id-web"
  exit 1
fi
