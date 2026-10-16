# 凡人修仙传 · 全量美术资产交付说明 (`art/full`)

- 当前进度：第 1–12 批全量完成：A 地面全部 + B 妖兽/动物/灵宠/召唤物全部 + C 建筑全部 + D 小物件遗迹全部 + E 27处名地全部 + F 法宝全部 + G 特效序列帧全部 + H 物品与法术图标全部 + 11 张合成预览图
- 累计交付 PNG 资产数：**1119** 张（另含地面 `_tile3x3.jpg` 拼铺验证图与特效 `_preview.gif`）
- 视觉规范：严格遵循 `art/round1b` 宋代水墨淡彩规范（左上 45° 光源、低饱和矿物淡彩、无投地硬阴影、直通 Alpha 通道、无文字水印）。
- 生产集群：5 台 NVIDIA L20 (48GB) `Qwen-Image-2.1-Turbo` 创空间多线程并发生产 + 自动化后处理流水线。

全量交付完成

## Rework Batch R1 — 建筑全部重画 (`buildings/` 142 张 + 5 张建筑排布预览图)
- **保留 1b 通过资产**：`B01_sect_hall.png`、`B02_house.png`、`B03_shop.png`、`B04_sect_gate.png`、`B05_citywall.png`。
- **严格正面 + 俯视 30° 平行投影**：全部 137 张新增建筑（C1 城镇 29 张、C2 通用宗门附属 17 张 + 11 个门派风格家族 43 张、C3 乱星海 17 张、C4 大晋 22 张、C5 草原 9 张）均采用单张独立生成（废除 2×2 拼图），屋脊与台基前沿 100% 水平、正立面平行于画面、无 45° 等轴斜角。
- **编号与内容 100% 对号**：`B06` 宗门偏殿、`B14` 小院民居、`B17` 客栈、`X01` 中式星宫主殿、`X12` 极阴岛中式黑石大殿、`T01` 草原西域白石圆顶圣殿等全部按 `ALL_ASSETS.md` 逐行核对，无匾额文字，四周仅留 28px 透明边。

## Rework Batch R2 — 妖兽、灵宠、召唤物、环境生物 (`beasts/`、`pets/`、`summons/`、`ambient/`)
- **清理全部假动作帧**：删除全部程序仿射缩放生成的假 `*_attack.png` 与 `amb_*_walk.png`（仅保留 1b 原生 `wolf_attack.png`、`mojiao_attack.png`、`yinhun_attack.png`），删除不在任务书附录 B 中的自造 ID。
- **重画 12 只错画妖兽 + 3 只灵宠/召唤物**：将原金色 `dujiao_idle.png` 改名为 `python_idle.png`（金冠巨蟒），全新绘制紫黑色 `dujiao_idle.png`（独角蟒）、`icebear_idle.png`（冰原白熊）、`mangshou_idle.png`（莽兽）、`spider_idle.png`（赤火蛛）、`centipede_idle.png`（百足魔蚣）、`bloodbat_idle.png`（血蝠）、`yinchi_idle.png`（银翅夜叉）、`fengxi_idle.png`（风希裂风兽）、`shuanggong_idle.png`（双首白玉蜈蚣）、`guijiang_idle.png`（鬼将）、`mo_soul_idle.png`（魔魂）、`yu_soul_idle.png`（元婴残魂），以及 `pet_ape_idle.png`（啼魂小猴）、`sum_tihun_idle.png`（啼魂三目巨猿）、`sum_xuanwu_idle.png`（玄武龟蛇虚影）。
- **补齐附录 B 全部 42 个缺号妖兽**：B.1 凡兽与山精 9 只（`boar`~`horned_wolf`）、B.2 天南妖兽 12 只（`tiebei`~`heisha_guard`）、B.3 乱星海海兽 11 只（`iron_crab`~`huajing_shark`）、B.4 大晋与北冥 10 只（`snow_wolf`~`true_demon`）。
