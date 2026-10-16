# 《凡人修仙传》2D 同人游戏 · 第 1 轮美术样品交付说明 (Round 1)

## 1. 风格基准与调色盘
- **唯一风格锚点**：严格对标 `fanren/docs/art-brief/ref/01-good-mountains-keep.jpg`（水墨淡彩 / 小青绿山水 + 宋代界画 + 《山海经》工笔重彩带写意水墨笔触）。
- **核心色板**：宣纸暖米底 `#e9dfc6`、石青 `#2f6470`、石绿 `#5d9478`、淡赭 `#cdb98e`、浓墨 `#1f2a28`、屋瓦冷灰 `#7d8288`、沉稳朱砂 `#a8432f`、苔藓墨绿 `#1d3a2c`。
- **绝对比例尺**：以 `ref/scale-person-215px.png`（1 成年人高 = `215 px`，2x 规格）为唯一比例基准。

## 2. 交付资产清单与自检结果
- **全局风格定调图**：`style_key.png`
- **地面贴图（`ground/`）**：5 张 `1024×1024` 四边无缝 90° 纯正交俯视贴图（`G01_grass_a/b`、`G04_dirtpath`、`G06_gravel`、`G15_flagstone`）+ 5 张 `*_tile3x3.jpg` 自检图 + 6 张 32-bit RGBA 贴花（`D01`～`D06`）+ `mockup_ground.png`（`2048×1280`）。
- **建筑精灵（`buildings/`）**：5 张正面+俯视30°平行投影 32-bit RGBA 透明底建筑（`B01_sect_hall`、`B02_house`、`B03_shop`、`B04_sect_gate`、`B05_citywall`），匾额/招幌全部留白无字，底部带石阶/青苔/草丛，无投射阴影 + `mockup_buildings.png`（`2560×1600`）。
- **灵兽 / 妖兽（`beasts/`）**：8 张侧面+20°俯视、统一面朝右 32-bit RGBA 透明底双姿态精灵（`M01_wolf`、`M02_huochan`、`M03_mojiao`、`M04_yinhun` 各含 `idle` + `attack`）+ `mockup_beasts.png`（`2048×1280`）。
