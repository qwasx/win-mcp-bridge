# v053 生产笔记（NOTES.md）

按 `V053_ASSETS.md` 任务书生产。**每轮对话生产 10 张**，生产完立刻推 GitHub（沙箱会重置，进度以本文件 + `PROGRESS.md` 为准）。

## 已交付（Batch 1 · P0 · A 类灵力化形）

| 文件 | id | 底 | 尺寸 |
|---|---|---|---|
| `huaxing/hx_long_idle.png` | hx_long / idle | 黑 | 1536×864 |
| `huaxing/hx_long_attack.png` | hx_long / attack | 黑 | 1536×864 |
| `huaxing/hx_feng_idle.png` | hx_feng / idle | 黑 | 1280×832 |
| `huaxing/hx_feng_attack.png` | hx_feng / attack | 黑 | 1280×832 |
| `huaxing/hx_hu_idle.png` | hx_hu / idle | 黑 | 1024×672 |
| `huaxing/hx_hu_attack.png` | hx_hu / attack | 黑 | 1024×672 |
| `huaxing/hx_gui_idle.png` | hx_gui / idle | 黑 | 1024×704 |
| `huaxing/hx_gui_attack.png` | hx_gui / attack | 黑 | 1024×704 |
| `huaxing/hx_gather.png` | hx_gather | 黑 | 1024×1024 |
| `huaxing/hx_dissolve.png` | hx_dissolve | 黑 | 1024×1024 |

`style_key_long.png` = `huaxing/hx_long_idle.png` 的副本（风格定调图，A 类）。
`preview/huaxing.png` = 本目录拼图预览（黑底）。

## 后处理（脚本 `/home/user/tools/v053_norm.py`，沙箱重置后需重建，逻辑已记录如下）

1. 亮度取 R/G/B 最大值；**亮度 ≤ 8/255（约 3%）的像素压成纯 `#000000`**，避免底色发灰。
2. 按亮度阈值取内容包围盒 → 裁切 → 缩放居中贴到规定画布上，**主体占最长边 88%，四周留边 ≥6%**，光晕在画布内自然衰减到黑，不被边缘切断。
3. 同一灵兽的两个姿态**共用同一个缩放系数和同一画幅**，保证切换姿态时体量不跳变。
4. 输出 PNG24 RGB（无 alpha，程序只看亮度），逐张 300～800 KB。

## 假设（按任务书「默认做法」处理，未停下等回复）

- **未使用 `ref_v053/` 参考图**（沙箱内不存在，且负责人明确要求不参考垫图，直接按第 1/2/3 节的文字规范生成）。
- `center` 一律写画幅几何中心 `[W/2, H/2]`：出图时已把主体居中，程序按此点移动/旋转即可；若需要更精确的重心，后续可逐张手工标注。
- 灵兽「最长边」按任务表取值，画布长宽比按姿态的实际包围盒取整到 32 的倍数，不强制裁切主体。
- 全部【黑】类图未画任何深色勾线/墨色阴影，暗部一律靠降低亮度表达。
- 图中无文字、无水印、无边框；符纹类一律用抽象几何纹/云雷纹/卦爻。
- 生成工具：Arena 内置文生图模型（单模型、不出选项，一次 10 张）。

## Batch 2 · P0（10 张，已推送）

`yuanying/yy_fly` `yy_cast` `yy_out`(512×1024) `yy_shell`｜`zhenfa/circle/zf_kun`(4旗) `zf_gengjin`(8旗) `zf_xuanwu`(4旗) `zf_juling`(4旗) `zf_gujin`(9旗)｜`zhenfa/dome/zf_dome`(1024×768)
另：`style_key_zhenfa.png` = `zf_gengjin` 副本。后处理：【黑】压纯黑底；阵纹圆盘按包围盒重新居中并放大到**直径 94%**（任务书 5.2）；元婴/光罩按原构图等比缩放进画布（不裁切、不放大）。`zf_dome_crack` 下一张将以 `zf_dome` 的实际包围盒为准生成，保证位置与尺寸完全重合。

## 自评 · 待修（返修批，尽量塞在每批的空余名额里）

1. `hx_feng_idle` / `hx_feng_attack`：偏「一团火」，任务书要求火焰感只出现在羽尖、身体必须是半透明灵光且鸟的解剖清楚（头冠/长颈/双翼飞羽/四根长尾羽）。**重做**。
2. `hx_gui_attack`：与 idle 的差异不够大，蛇首前探吐信、龟甲六边形光纹暴亮这两点要加强。**重做**。
3. `hx_dissolve`：颗粒偏细、笔触状光丝不够明显，希望更「飞白撕扯」的质感。**微调重做**。
4. 青龙四爪在攻击姿态下略挤，若程序表现无碍可不动。

## 后续批次计划（P0 剩余 → P1 → P2，共 98 张）

- **Batch 2（10）**：修 3（feng×2 / gui_attack / dissolve 取 3）+ `yy_fly` `yy_cast` `yy_out` `yy_shell` + `zf_kun` `zf_gengjin`（含 `style_key_zhenfa.png`）。
- **Batch 3（10）**：`zf_xuanwu` `zf_juling` `zf_gujin` `zf_dome` `zf_activate` `zf_break` `ui_board` + `ui_node_jin` `ui_node_mu`。
- **Batch 4（10）**：`ui_node_shui` `ui_node_huo` `ui_node_tu` `ui_node_trap` `ui_node_broken` + `zf_flag_jin/mu/shui/huo/tu/mo` + `zf_eye_stone`。
- **Batch 5+**：其余灵兽（鹏/麒麟/魔猿）、`hx_trail` `hx_aura`、其余阵纹圆盘、分层素材、光幕/裂纹/碎裂、阵中特效、道具、迷雾，最后 P2 全部图标。
