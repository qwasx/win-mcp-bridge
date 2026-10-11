#!/bin/sh
# 《铁血大明》联机服务器启动脚本：崩溃后 2 秒自动重启；收到 SIGTERM 时先存盘再退出。
# 用法：sh start-server.sh            （默认端口 8090）
#       PORT=9000 DATA_DIR=/workspace/ming-data sh start-server.sh
# 需要 Node.js 22.5 以上（内置 node:sqlite）。目录结构：dist/（网页） + dist-server/server.mjs（服务器）
cd "$(dirname "$0")"
export PORT="${PORT:-8090}"
if [ -z "$DATA_DIR" ]; then
  if [ -d /workspace ]; then DATA_DIR=/workspace/ming-data; else DATA_DIR="$(pwd)/data"; fi
fi
export DATA_DIR
child=""
trap 'echo "[supervisor] stopping"; [ -n "$child" ] && kill -TERM "$child" 2>/dev/null; wait "$child" 2>/dev/null; exit 0' TERM INT
while true; do
  node --no-warnings dist-server/server.mjs &
  child=$!
  wait "$child"
  code=$?
  echo "[supervisor] server exited with code $code; restarting in 2s"
  sleep 2
done
