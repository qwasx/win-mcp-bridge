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

## Rework Batch R3 — 法宝与飞行器 (`artifacts/` 48 张)
- **保留 6 张通过法宝**：`art_qingzhu.png`（已按要求旋转为水平剑尖朝右）、`art_wuxing.png`、`art_shenfeng.png`、`art_shenfeng_ride.png`、`art_yinzhong.png`、`art_zhangtian.png`。
- **重画其余全部 42 张法宝**：逐一对照任务书 F1~F3 表格绘制（`art_xutian` 三足两耳虚天鼎、`art_jinguangzhuan` 金光砖、`art_wuguang_arrow` 乌光箭、`art_huergu/ziren` 金蚨子母刃、`art_dayan` 傀儡核、`art_huazhen` 颠倒五行阵盘、`art_zhenqi` 无字通用阵旗等），彻底消除重复凑数文件，所有飞剑/刀/枪/戟/针/箭/尺统一水平横放尖端朝右并在 `manifest.json` 标注 `orient`。

## Rework Batch R4 — 原著独有名地构件 (`landmarks/` 35 张)
- **严格按任务书表 E 全部重画**：`E01_platform` 升仙大会比武高台、`E02_gate_pillar` 血色禁地入口双石柱、`E03_altar_broken` 上古残坛、`E04/E04b` 古传送阵（完好/残破）、`E05` 虚天殿铁索桥段、`E06` 冰火道、`E07` 虚天殿内殿三层青白玉圆台、`E08` 韩立高台、`E09` 灵石矿洞口、`E10` 越京皇宫禁制塔、`E11a/b/c` 上古盘龙柱、`E12a` 昆吾山镇魔锁石柱（无字）、`E12b` 昆吾剑亭、`E13` 坠魔谷残碑（只画裂纹无字）、`E14` 昆吾镇魔碑（古符纹无汉字）、`E15` 古魔封印台、`E16` 灵眼之泉、`E17` 地火口、`E18a~d` 洞府四件、`E19` 灵眼之玉、`E20` 灵眼之树、`E21` 海蚀巨石迷阵、`E22` 海眼石环、`E23` 碧灵岛矿脉露头、`E24` 慕兰圣火坛、`E25` 黑暗祭坛、`E26a/b` 海船（小渔船/跨海楼船）、`E27` 北冥冰缝栈道。
- **统一正面 + 俯视 30° 视角**：除 `E20` 灵眼之树外绝不画山、树、瀑布，只画人工/特殊名地构件本体。

## Rework Batch R5 — 地面底图与大贴片返工 (`ground/G*`、`ground/L*`)
- **重画 28 张 G 系列无缝底图**：解决灰度标准差过低（`std <= 4`）的纯色平涂问题（重画后全部 `std > 7.5`），改用 2D 余弦环面保方差无缝合成消除 50% 偏移中心十字接缝；`G08_shoal_a/b` 改为四边统一浅水底无海岸线；`G17_lava_a/b` 压低饱和度为 `#3a2018` 黑褐玄武岩 + `#b5562a` 暗赭红火纹；`G21_miasma_a/b` 改为纯俯视紫黑腐殖泥地与毒水洼（无山峰剪影）。
- **重画 3 张 L 大贴片 + 去除全部 L 贴片外圈深色/米黄光晕边**：重画 `L05_quarry_pit.png`（白石阶梯采石场）、`L15_demon_lake.png`（坠魔谷碧绿魔湖）、`L17_battlefield_scar.png`（古战场阵纹断剑焦痕），并对全部 L 系列大贴片使用距离场余弦羽化去除外圈残留深色/米黄边。

## Rework Batch R6 — 战斗与法术特效关键形态部件图 (`vfx/` 64 张 `512×512` 透明底 PNG)
- **废除假缩放序列帧，改为交付真正独立绘制的关键形态部件图**：按 `FEEDBACK_FULL.md` 第 5.4 节要求，删除全部 27 张缩放拼凑的假序列帧表，为全部 27 个特效（G1 投射物 10 项、G2 爆发与范围法术 9 项、G3 护盾与光环 8 项）独立绘制 `512×512` 透明底关键图（`_head` 水平朝右弹头主体、`_trail` 左淡右浓水平拖尾纹理、`_burst` 中心命中最大爆发态、`_ring` 护盾球/地面阵环），共 64 张。

## Rework Batch R7 — 地面点缀 `D*`、摆件 `P15/S02/S03`、符箓与卷轴图标 `tal_*/scroll_*`
- **重画 18 组共 36 张地面点缀 (`ground/D*`)**：`D03`、`D04`、`D05`（去黑边浅水洼）、`D08`~`D13`、`D15`~`D17`、`D19`、`D21`~`D23`、`D25`、`D26` 每组独立绘制 `_1.png`、`_2.png` 两张真正不同的水墨淡彩变体，删除全部重复拷贝的 `_a.png`/`_3.png`。
- **重画 3 件不符摆件 (`props/`)**：`P15_cart.png`（带篷木轮马车/牛车）、`S02_beast_nest.png`（带发光兽卵的妖兽巢）、`S03_spirit_ore.png`（嵌青蓝灵石结晶的灵脉矿露头）。
- **重画全部 9 张符箓 (`tal_*`) 与 17 张功法卷轴 (`scroll_*`)**：统一改为朱砂/金线抽象几何云雷纹与十四流派属性徽记，彻底去除模糊汉字。
- **全包 MD5 唯一性校验**：全包 804 张图像文件（761 项正式资产 + 预览图）实现 **0 重复 MD5**。
