#!/bin/sh
# 用法: tools/harness/run.sh [脚本.ts]   （依赖安装在 /tmp/t，见 README）
H=$(cd "$(dirname "$0")" && pwd)
cp "$H"/*.ts "$H"/*.mjs /tmp/t/ 2>/dev/null
if [ ! -f /tmp/t/node_modules/phaser3spectorjs/index.js ]; then mkdir -p /tmp/t/node_modules/phaser3spectorjs && echo "module.exports={};" > /tmp/t/node_modules/phaser3spectorjs/index.js; fi
cd /tmp/t && NODE_PATH=/tmp/t/node_modules NODE_OPTIONS="--import /tmp/t/jpg-reg.mjs" npx tsx shot.ts ${1:+/tmp/t/$(basename "$1")} 2>&1 | grep -v "focus()" | grep -v "^\s*at "
