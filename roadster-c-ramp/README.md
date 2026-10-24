# Roadster C-Ramp — 夜间实拍风格动画（Three.js + SVG）

夜间户外直播画面：得州 SpaceX 试验场，强工业聚光灯下，一辆白色第二代 Tesla Roadster
高速冲上巨型金属 **C 形弧形坡道**，在顶点 **180° 完全倒挂**（车底吸附风扇锁定），
1 秒余后脱离轨道 —— **车底反推冷气**缓慢减速 → **四道冷气脉冲**完成 180° 横滚回正
（无明火）→ 近地**高压雾化缓冲** → 四轮柔和接地、悬架压缩回弹。
手持长焦跟拍、8K 写实物理感、真实夜间光学眩光。

## 运行

```bash
npm install
npm run build     # esbuild 打包 -> app.js
npm run serve     # http://localhost:8020
```

`app.js` 已随仓库提交，任何静态服务器指向本目录即可直接播放。

## 技术分工

| 层 | 技术 | 内容 |
|---|---|---|
| 3D 世界 | **Three.js** (WebGL2) | C 形坡道（程序化扫掠几何）、Roadster 车模、4 座工业灯塔（真实 SpotLight + 体积光束锥 + 地面光池）、PMREM 环境反射、粒子系统（GPU 点精灵：冷气射流/雾化/尘土/火花）、ACES 色调映射、软阴影 |
| 物理时间线 | 纯函数 `js/timeline.js` | 进场 → 坡道加速/磁制动 → 倒挂锁定晃动 → 释放自由落体 → 反推减速（分段推力曲线）→ 180° 横滚 → 着陆缓冲 → 悬架弹簧，可在 node 中数值验证 |
| 直播 HUD | **SVG** | LIVE 徽标/时间码、遥测面板（速度/高度/载荷/横滚 + 实时速度曲线）、相位字幕、目标跟踪框（世界坐标投影）、机位切换白闪、REPLAY 徽标、渐晕 |
| 镜头眩光 | **SVG**（`mix-blend-mode: screen`） | 每个明亮光源生成核心光斑、变形横向拉丝、4 组沿光轴分布的鬼影圆环，随强度闪烁 |
| 质感 | CSS/canvas | 胶片颗粒（feTurbulence 风格噪点 dataURL）、扫描线、渐晕 |

## 运镜

5 个机位硬切（全景长焦 → 爬升特写 → 顶点倒挂 → 降落跟踪 → 接地），
全部带多频正弦叠加的**手持摄影噪声**；角噪声按焦距放大（长焦抖动更明显），
视线目标带速度提前量模拟长焦跟摇。横滚段有 0.78× 轻微升格。

## 快捷键

`SPACE` 暂停 · `R` 重播 · `C` 自由视角（OrbitControls）

## 测试

```bash
npm test                      # 时间线数值验证（物理节点/事件顺序/穿地检测）
node test/headless-smoke.mjs  # 无 GPU 冒烟测试（真实场景图跑完整循环）
node test/shoot.mjs           # 可选：headless Chromium 离屏截图（需系统浏览器依赖）
```

## 结构

```
index.html          页面壳（canvas + SVG 层 + 扫描线 + UI）
app.js              构建产物（three 已打包）
js/timeline.js      纯物理时间线（无 three 依赖）
js/director.js      导演：状态应用、多机位、粒子发射、事件
js/car.js           Roadster 程序化建模（车身/喷口/风扇/悬架）
js/world.js         夜景世界（坡道/灯塔/光束/着陆坪/储罐/星空/环境反射）
js/particles.js     GPU 点精灵粒子池
js/overlay.js       SVG 直播 HUD + SVG 镜头眩光
js/util.js          数学工具 + 程序化纹理
```
