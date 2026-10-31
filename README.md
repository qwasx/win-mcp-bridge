# 活世界 · 凡人修仙传 v0.43

基于用户提供的 `fanren-v042-renwu-source.zip` 修改。原游戏完整源码保留在 `game/`，地图、战斗、人物绘制、换装等系统未被替换；新增的“活世界”引擎同时接入原游戏与 Next.js 观测台。

## 这次改了什么

- **真实储物袋**：每个 NPC 持有自己的灵石与物品。采药入袋、闭关耗丹、买卖钱货两清；身故后遗物交给家人。原版 NPC 商店不再按月凭空刷货。
- **功法与修炼**：每人有功法、修为、熟练度。闭关积累修为，丹药加速修炼，瓶颈时尝试突破。
- **门派事务**：宗门有库藏，门人完成事务领取报酬，不再只是名字标签。
- **家庭与社交**：亲缘、道侣、师徒、友人关系可追溯；探亲访友改变信任，写入记忆。
- **仇恨因果**：劫掠产生具体仇怨（谁、为何、何时、哪件事），家人可能追查；可出面调解。
- **不再无故召唤玩家**：旧版围绕玩家随机生成劫修/追杀/求救的入口已停用。事件由世界中真实人物发起，只在人物确实位于附近时显现。邀请可接受/拒绝，过期自行结束，不强制传送。
- **观测台**：世界地图、众生图鉴、关系网络、功法门派、因果事件、世界纪事；可关注人物、问候、赠礼、交易、调解、介入事件、推进时间、导出存档。
- **持久化**：观测台世界保存在 PostgreSQL（Drizzle ORM）。原游戏仍使用浏览器本地存档，并兼容旧档补齐新字段。

## 运行

```bash
npm install
cp .env.example .env
npx drizzle-kit push
npm run dev
```

观测台：`http://localhost:3000`

原游戏静态版已构建到 `public/game/`，可直接从观测台“进入活世界”打开，也可访问 `/game/index.html?auto=new`。

重新构建原游戏：

```bash
npx vite build game
```

## 测试

```bash
npx tsx tests/living.test.ts
npm exec tsc -- -p game/tsconfig.json --noEmit
npx next typegen
npm exec tsc -- --noEmit
npm run build
```

## 结构

- `game/`：原 v0.42 游戏源码与本次接入修改。
- `game/src/world/living-bridge.ts`：原游戏与活世界引擎的同步桥。
- `src/world/living.ts`：共享的自主 NPC / 因果事件引擎。
- `src/world/roster.json`：从原版名册导出的 944 位人物初始数据。
- `src/components/`：观测台、地图、人物抽屉、事件卡片。
- `src/db/schema.ts`、`src/lib/world-store.ts`：PostgreSQL 世界存档。
- `tests/living.test.ts`：资源守恒、交易、邀请过期、仇怨与长期演算测试。

## 说明

观测台与原游戏浏览器存档是两个入口：观测台用于持续演算和观察同一套规则下的世界；原游戏保留本地即时战斗体验。两者共享引擎与初始名册，但不会互相覆盖存档。

原项目为《凡人修仙传》同人作品，人物与世界观版权归原作者及相关权利方所有。本仓库仅保留原源码中的署名与说明，不新增任何第三方素材授权承诺。
