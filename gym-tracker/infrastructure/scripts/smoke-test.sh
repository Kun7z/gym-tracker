#!/usr/bin/env bash
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT/backend"

pkill -f "dist/main.js" 2>/dev/null
sleep 1
LOG=/tmp/gymtracker-backend.log
setsid nohup node dist/main.js > "$LOG" 2>&1 < /dev/null &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT
echo "server pid: $SERVER_PID"

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/v1/health 2>/dev/null || true)
  if [ "$code" = "200" ]; then echo "health ok (${i}s)"; break; fi
  sleep 1
done

EMAIL="sync-test-$(date +%s)@example.com"
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"senha-secreta-123\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")
echo "usuário registrado: $EMAIL"
AUTH="Authorization: Bearer $TOKEN"

DONE=""
for i in $(seq 1 24); do
  LAST=$(curl -s http://127.0.0.1:3000/api/v1/catalog/sync/status -H "$AUTH" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('lastSyncedAt') or '')" 2>/dev/null || true)
  if [ -n "$LAST" ]; then DONE="boot"; break; fi
  sleep 5
done
if [ -z "$DONE" ]; then
  echo "== boot sync não concluiu em 120s; disparando sync manual =="
  curl -s -m 240 -X POST http://127.0.0.1:3000/api/v1/catalog/sync -H "$AUTH" | python3 -m json.tool
fi

echo "== status do sync =="
curl -s http://127.0.0.1:3000/api/v1/catalog/sync/status -H "$AUTH" | python3 -m json.tool

echo "== total de exercícios no catálogo =="
curl -s "http://127.0.0.1:3000/api/v1/catalog/exercises?limit=1" -H "$AUTH" \
  | python3 -c "import json,sys; print('total:', json.load(sys.stdin)['total'])"

echo "== busca 'leg press' =="
curl -s "http://127.0.0.1:3000/api/v1/catalog/exercises?q=leg%20press&limit=5" -H "$AUTH" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); [print(' -', e['name'], '|', e['nameEn'], '|', e['category']['name'], '| equip:', [eq['name'] for eq in e['equipment']]) for e in d['items']]"

echo "== busca 'agachamento' (tradução pt) =="
curl -s "http://127.0.0.1:3000/api/v1/catalog/exercises?q=agachamento&limit=5" -H "$AUTH" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); [print(' -', e['name'], '|', e['nameEn']) for e in d['items']]"

EXID=$(curl -s "http://127.0.0.1:3000/api/v1/catalog/exercises?q=leg%20press&limit=1" -H "$AUTH" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['items'][0]['id'])")
echo "== registrando séries no exercício $EXID =="
curl -s -X POST http://127.0.0.1:3000/api/v1/sets -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"sets\":[{\"clientUuid\":\"$(cat /proc/sys/kernel/random/uuid)\",\"exerciseId\":\"$EXID\",\"weightKg\":100,\"reps\":12,\"performedAt\":\"2026-08-01T10:00:00.000Z\"},{\"clientUuid\":\"$(cat /proc/sys/kernel/random/uuid)\",\"exerciseId\":\"$EXID\",\"weightKg\":120,\"reps\":10,\"performedAt\":\"2026-08-01T11:00:00.000Z\"}]}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('sets criadas:', len(d['sets']))"

echo "== history (fuso America/Sao_Paulo) =="
curl -s "http://127.0.0.1:3000/api/v1/exercises/$EXID/history?tz=America/Sao_Paulo" -H "$AUTH" | python3 -m json.tool

echo "== summary =="
curl -s "http://127.0.0.1:3000/api/v1/exercises/$EXID/summary" -H "$AUTH" | python3 -m json.tool

echo "== fim (servidor será encerrado) =="
