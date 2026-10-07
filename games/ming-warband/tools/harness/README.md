# 无头截图工具（开发用）

在没有浏览器的环境里，用 jsdom + @napi-rs/canvas 跑真实的 Phaser.CANVAS 渲染并截图。

```sh
mkdir -p /tmp/t && cd /tmp/t && npm init -y && npm pkg set type=module
npm i tsx @napi-rs/canvas jsdom
mkdir -p node_modules/phaser3spectorjs && echo "module.exports={}" > node_modules/phaser3spectorjs/index.js
# 回到仓库
games/ming-warband/tools/harness/run.sh                 # 大地图截图 /tmp/t/shot_world.png
games/ming-warband/tools/harness/run.sh s_battle.ts     # 战斗截图
```
脚本导出 `default async (ctx)`，ctx 含 `game, ws, S, snap(file), wait(ms)`。
