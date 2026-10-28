# 第 6 阶段（分支 s6-vfx）：特效全面升级

## 改了什么（玩家看得到的）

- **随手放十门法术，各不相同**：70 门攻击 / 区域法术都有了专属「特效配方」，共 76 种配方。按出手方式 × 五行分：
  - **弹头 + 拖尾**：火弹（火团裹焰、焰羽四溅）、火蛇（摆尾的火身、鳞羽、两点蛇眼）、火鸦（振翅火羽、羽毛飘落）、青阳魔火（中空青焰拖黑烟）、冰锥（冰棱 + 旋转雪花）、冰魄神针（银丝 + 星芒）、水箭（水滴 + 气泡）、水龙卷、风刃（三道风弧 + 落叶）、三元斩（青 / 白 / 金三色月牙轮换）、旋风、飞石（翻滚碎岩 + 尘）、藤缚（藤蔓长叶、梅花打头）、乙木剑气（柳叶飞刃）、御剑（真正的飞剑剪影：剑身、剑脊、护手、剑柄）、金刃 / 分金（金色月牙轮）、奔雷剑（飞剑缠电）、青蟠剑阵（剑串成龙）、寒魄冰龙（雪花为鳞）、火球符（符纸翻飞再燃成火团）、定身符（金符）、惊神刺（神识之眼 + 涟漪）、噬魂鬼爪、鬼火（中空鬼焰 + 鬼面）、气劲掌（掌印推出）……
  - **命中爆开**：各配方自带爆开——火莲绽放、雪花冰壳、涟漪水花、交叉剑痕、鬼面升起、掌印压地、星野迸散、粉雾花瓣……
  - **天降 / 落点**：炎爆（火莲 + 碎石）、流火（预警时就有流星从天斜坠）、圣魔驭日（空中一轮烈日压下）、玄冰封印（冰晶簇破土）、引雷（预警时头顶劫云翻滚，落下竖劈雷）、九天雷殛 / 万雷天牢（劫云 + 光柱 + 双雷）、天雷符（悬空符纸燃尽引雷）、山河破（山影从天而降砸地，水墨冲击圈）、大五行擒仙手（五色巨掌按下）。
  - **持续场**：火海（地上火莲 + 火羽升腾）、天火燎原（空中烈日 + 火流星坠落）、紫罗极火（紫焰 + 篆印）、九幽冥火（幽蓝鬼焰 + 鬼面浮现）、玄冰天狱（冰晶围城 + 雪落）、雷网（雷纹阵 + 竖劈雷）、流沙（沙漩）、飞沙走石、春黎剑阵（飞剑如雨 + 落英）、困阵（符文环 + 四方镇印光柱）、颠倒五行阵（太极 + 五色光柱）、聚灵阵（涟漪 + 灵光内聚）。
  - **锥形 / 光柱 / 锁链**：弄焰（火羽扇面）、天都尸火（尸青鬼焰）、青元剑芒（三重月牙）、眨眼剑法（连闪 X 字剑痕）、清风掌、阴风爪；乾蓝冰焰（蓝焰光柱沿途结冰晶）、北极元光（三色极光摆动 + 落雪）、地刺（一路土刺破土）、血炼神光、金雷竹、巨剑术（巨剑剪影）；雷光指、阴魂丝（三股鬼丝绞缠 + 鬼火珠）、五鬼锁神（五个鬼面沿链扑去）、辟邪神雷（另加天雷法印压下）。
- **出手印记**：每次出手，施法者身前一闪本配方的图样（火莲、雪花、飞剑、鬼面、掌印、神识之眼……），扇形十几发只闪一次。
- **宗门色系**（`src/data/sectfx.ts`，28 个门派全覆盖）：NPC 宗门修士施法自动套用本门主色 + 招牌形态 + 标志点缀。
  - 黄枫谷青色剑光（飞剑配方，枫叶随剑）；掩月宗月白寒霜（冰招改为「月华寒霜」：小月轮 + 雪花环绕）；鬼灵门绿色鬼火（鬼面隐现）；星宫星芒（金招改为星芒弹）；合欢宗粉色迷雾（毒招改为粉雾花瓣）；天阙堡厚土金黄；灵兽山灵虫毒瘴（毒招改为虫群）；落云宗祥云青木（落叶飞刃）；御灵宗紫色灵魂；清虚门清虚紫雷；化刀坞血色刀芒；妙音门音波涟漪；极阴岛幽蓝玄冰……
- **大场面**（`src/gl/bigfx.ts`）：天劫雷（劫云漩涡压顶、连劈五道粗雷）、法相（法相金身期间身后显化巨大金身 + 佛光 + 莲台）、大庚剑阵叠一层「周天星斗」阵图 + 十二道剑幕光帘 + 立剑、辟邪神雷每跳一次就有天雷法印从空中压下、明王诀脚下金莲、乾蓝冰焰 / 北极元光见上。
- **包体**：特效关键图（1.7 MB）和 CC0 粒子图集（88 KB）不再 `?inline` 内联进脚本，改为独立资源文件按需下载。主脚本 35,084 KB → 32,9xx KB（见下表）。新图样全部着色器生成，**零字节**。

## 改动的文件

- 新增
  - `src/gl/vfxlib.ts`：特效库（76 种配方、烘焙图样粒子、负载限流、弹道结束检测、对外接口）
  - `src/gl/bigfx.ts`：大场面（8 种）
  - `src/data/vfxstyles.ts`：法术 → 配方 + 色板（换外观只改这张表）
  - `src/data/sectfx.ts`：宗门色系表
  - `src/world/vfxhook.ts`：世界侧接口（施法打标、`bigfx()` 请求、`sectCol()`）
  - `tools/test-vfx.ts`、`tools/fxshots.py`（检查图连拍）、`tools/fxperf.py`（压力测试）、`tools/fxbakesheet.py`（烘焙图样检视）
  - `docs/素材许可清单.md`
- 修改（归本分支）
  - `src/gl/fxbake.ts`：烘焙图样 32 → 64 格（新增 46 种原创图样，模式 18–63）
  - `src/gl/fx.ts`：烘焙队列 1024 → 2048
  - `src/gl/combatgl.ts`：接入特效库（配方接管的不再画旧特效）、大场面
  - `src/gl/atlas.ts`：CC0 图集按需加载；双击 index.html（file://）时图集会污染画布，先试画探测，失败就退回代码格
  - `src/gl/fxAtlasData.ts`、`src/gfx/vfxData.ts`、`tools/vfxconvert.ts`：`?inline` → `?url`
  - `src/world/combatfx.ts`：配方接管的弹道 / 光效不再叠外部 AI 关键图
- 公共文件（最小接入）
  - `src/world/combat.ts`：`cast()` 里 `vfxMark` / `vfxTag` 两行；天降打击转光效时带上 `skill`（1 处）
  - `src/world/foeskills.ts`：NPC 弹道 / 落点带上 `sect`，颜色走 `sectCol()`（import 1 行 + 3 处）

## 特效库接口（给其他分支）

### 1. 给一门法术换外观 / 新法术配外观

在 `src/data/vfxstyles.ts` 的 `ART_VFX` 里加一行即可，**不用写渲染代码**：

```ts
hulu_fire: { r: 'fireSnake', pal: PAL.purpleFire },      // 葫芦喷火：用火蛇配方 + 紫焰色板
san_rain:  { r: 'springSword', pal: ['255,255,255', '140,220,255', '20,60,120'] },
```

法术只要走 `Combat.cast()`，新生的弹道 / 光效 / 区域 / 天降打击会自动打上 `skill: 法术id`，渲染时查表绘制；不在表里的照旧。

可用配方（按法术 `cast` 选）：

| cast | 配方 |
|---|---|
| bolt / fan（弹道） | fireOrb fireSnake fireBird demonFire iceSpike iceNeedle waterArrow waterSpout moonFrost windBlade triCrescent whirlwind rockShot vineBind leafBlade flyingSword goldBlade thunderSword swordDragon iceDragon talismanFire talismanSeal mindSpike ghostFire ghostClaw bloodShot palmShot starShot petalMist bugShot soundWave thunderBolt goldThunderShot |
| burst / strike（落点） | fireBurst meteor sunFire frostSeal thunderStrike heavenStrike talismanThunder mountainCrush giantPalm |
| nova | thunderNova sandNova roarNova mindNova |
| cone | fireCone corpseFire swordCrescent crossSlash windPalm ghostClawCone |
| beam | icefire aurora earthSpikeLine bloodBeam goldThunderBeam；巨剑（bigsword）用 giantSword |
| chain | bixie thunderChain ghostChain fiveGhosts |
| field | blaze skyfire purpleFire netherFire frostField thunderField quicksand sandStorm springSword arrayTrap arrayFive arrayGather |

色板 `pal: [亮芯, 主色, 暗边]`（"r,g,b"），常用的在 `PAL` 里（fire / blueFire / purpleFire / ice / water / thunder / goldThunder / jade / cyan / gold / ghost / blood / pink / star……）。

### 2. 自己写出手动画时直接调用（`import ... from '../gl/vfxlib'`，在 `glow(F, t, dt)` 之类的 GL 回调里用）

```ts
drawTreasure(F, 'gourd', x, y, 90, '255,180,80');        // 发光法宝剪影：gourd 葫芦 / umbrella 伞 / pagoda 宝塔 / stamp 大印 / lamp 灯 / bell 金钟 / sword / fu 符纸 / mountain / palm / taiji / eye
vfxBurst(F, 'frostSeal', x, y, 1.2, '160,220,255');       // 在某点放一次任意配方的命中爆开
vfxProjAs(F, 'bugShot', pr, t, dt, trailPts, '200,220,60'); // 用某配方画任意飞行物（虫群、葫芦里飞出的东西……）
bp(K.PetalH, x, y, { vx, vy, life: 1, s0: 16, c: [1, 0.6, 0.8] });  // 烘焙图样粒子（K 见 fxbake.ts 的 64 种图样）
```

### 3. 大型特效（突破 / 天劫 / 剧情演出用，逻辑层直接调，不依赖 WebGL）

```ts
import { bigfx } from '../world/vfxhook';
bigfx('tribulation', { x, y, power: 2 });                  // 天劫雷：劫云压顶，3+2×power 道粗雷连劈，最后一道正中落点
bigfx('vortex', { x, y, r: 260, dur: 3 });                 // 灵气漩涡：地面双层螺旋，灵光向心收拢（突破吸纳灵气）
bigfx('pillar', { x, y, r: 100, color: '255,236,190' });   // 光柱冲天（突破成功）
bigfx('inkshock', { x, y, r: 320 });                       // 水墨冲击波：三重飞白墨环 + 墨点飞溅（突破 / 大招收尾）
bigfx('dharma', { x, y, follow: () => alive ? { x: p.x, y: p.y } : null });  // 法相：身后巨大金身，follow 返回 null 时淡出
bigfx('lotus', { x, y, r: 140, dur: 3 });                  // 脚下金莲绽开
bigfx('heavenSeal', { x, y, r: 120 });                     // 天雷法印从空中压下
bigfx('swordArray', { x, y, r: 300, dur: 6 });             // 剑阵阵图 + 剑幕光帘
```

通用参数：`r` 规模、`dur` 秒数、`color` / `color2` 主副色、`follow` 跟随、`power` 强度（0.5–3）。
同时最多 5 个场面、同类最多 2 个（多了顶掉最早的）；粒子高负载时自动减量。浏览器控制台可用 `__bigfx('tribulation', {x, y})` 试看。

### 4. NPC 宗门色系

`sectCol(sect, 默认色)` 给出本门主色；弹道 / 光效对象上带 `sect: 门派id` 就会按 `SECT_FX` 的色板、招牌配方（`sig`）和标志点缀（`any`）绘制。新门派在 `src/data/sectfx.ts` 加一行。

## 测试

见回报。

## 已知问题

- Canvas2D 后备模式（没有 WebGL 的机器）不走特效库，仍是原来的画法（宗门修士的颜色会变成本门主色）。
- 法相金身是叠在画面最上层的半透明发光体（特效层没有深度），主角会被淡淡罩住；已把透明度压低。
- 双击 index.html（file://）打开时，浏览器不让外部图片进 WebGL：CC0 图集自动退回代码格，外部 AI 关键图仍能在 Canvas 层显示，不影响特效库。
