#!/usr/bin/env bash
# End-to-end smoke test: the whole Compose stack on regtest. Mines blocks containing a
# real spend, then checks the API serves them. Runs as its own Compose project with its
# own containers, volumes and port, so the signet stack is never touched.
# Needs Docker or Podman with Compose v2.24+, curl and jq, and a .env (cp .env.example .env).
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v docker >/dev/null 2>&1; then engine=docker; else engine=podman; fi
API="http://127.0.0.1:${SMOKE_API_PORT:-18080}"
compose() { "$engine" compose -p yabe-smoke -f compose.yaml -f compose.smoke.yaml "$@"; }
cli() { compose exec -T bitcoind bitcoin-cli -regtest -rpcport=38332 -datadir=/home/bitcoin/.bitcoin "$@"; }

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    echo "smoke test failed; recent logs:" >&2
    compose logs --no-color --tail=100 >&2 || true
  fi
  # --rmi local: also remove the images this project built (Compose names them per project).
  compose down -v --remove-orphans --rmi local >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

# wait_for <what> <command...>: retry once a second for up to 120 s.
wait_for() {
  local what=$1
  shift
  for _ in $(seq 1 120); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $what" >&2
  return 1
}

echo "starting the stack on regtest (project yabe-smoke)"
compose up -d --build

wait_for "bitcoind" cli getblockchaininfo
cli createwallet smoke >/dev/null
address=$(cli getnewaddress)
cli generatetoaddress 101 "$address" >/dev/null # coinbase outputs mature after 100 blocks
txid=$(cli sendtoaddress "$address" 1)
cli generatetoaddress 1 "$address" >/dev/null
tip=$(cli getblockcount)

tip_is() { [ "$(curl -fsS "$API/v1/status" | jq -r '.tip.height')" = "$1" ]; }
wait_for "the API to serve height $tip" tip_is "$tip"

curl -fsS "$API/ready" | jq -e '.status == "ok"' >/dev/null
curl -fsS "$API/v1/blocks?limit=1" | jq -e --argjson tip "$tip" '.blocks[0].height == $tip' >/dev/null
curl -fsS "$API/v1/transactions/$txid" |
  jq -e '.isCoinbase == false and .feeSat > 0 and .inputs[0].valueSat > 0 and .confirmations == 1' >/dev/null
curl -fsS "$API/v1/search?q=$txid" | jq -e --arg txid "$txid" '.type == "transaction" and .txid == $txid' >/dev/null

echo "smoke test passed: $tip blocks indexed, spend $txid served by the API"
