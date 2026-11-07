# v053 进度表（沙箱会重置，以本文件为唯一进度依据）

规则：每轮对话生产 10 张；【黑】=纯黑底发光（程序按亮度抠透明），【透】=RGBA 透明底实物；一律不参考 ref 图、不出选项、不画文字；生成后立即 commit + push 到 `arena/87a507dd-win-mcp-bridge`。

图例：`[x]` 已交付 `[~]` 已交付但需返修 `[ ]` 未开始

## 风格定调

- [x] `style_key_long.png`（= hx_long_idle 副本）
- [ ] `style_key_zhenfa.png`（= zf_gengjin 副本，Batch 2 一起交）

## A · 灵力化形（26）

- [x] `hx_long_idle` `hx_long_attack`（1536）
- [~] `hx_feng_idle` `hx_feng_attack`（1280）← 偏火球，待重画
- [x] `hx_hu_idle` `hx_hu_attack`（1024）
- [~] `hx_gui_idle` `hx_gui_attack`（1024）← attack 差异不足，待重画
- [ ] `hx_peng_idle` `hx_peng_attack`（1280，紫金 #b090ff + 金白电芯，翼缘水墨折线电弧）
- [ ] `hx_qilin_idle` `hx_qilin_attack`（1024，赭金 #ffcf6a + 暖白，龙首鹿身独角马蹄牛尾，蹄下祥云）
- [ ] `hx_yuan_idle` `hx_yuan_attack`（1024，赤铜 #ff6a4a + 暗金，巨猿法相、赤目、不可萌态）
- [~] `hx_gather` `hx_dissolve`（1024²，白色）← dissolve 待微调
- [ ] `hx_trail`（1024×256）`hx_aura`（1024²）
- [ ] 图标 8：`skill_huaxing` `form_long` `form_feng` `form_hu` `form_gui` `form_peng` `form_qilin` `form_yuan`（【透】256²，R6 样式）

## B · 元婴出窍（10）

- [ ] `yy_fly`（1024²）`yy_cast`（1024²）`yy_out`（512×1024）`yy_in`（512×1024）
- [ ] `yy_shell`（1024²）`yy_blink`（1024×512）`yy_wave`（1024²）
- [ ] 图标 3：`skill_yuanying` `skill_yy_blink` `skill_yy_return`（【透】256²）
- 造型锚点（无 R1 图时的文字锚）：一尺高婴孩、头顶单发髻、眉心一点灵光、半睁、神情宁静威严、金色带紫蓝流光半透明身体、身周淡光晕

## C · 阵法禁制（70）

阵纹圆盘（【黑】1024²，正俯视、居中、旋转对称、直径 94%、笔意线条、阵旗光点数）：

- [ ] `zf_kun` 4 旗 青 `#60d8d0` · [ ] `zf_mizong` 6 银灰白 · [ ] `zf_wuxing` 5 五色
- [ ] `zf_gengjin` 8 金白 `#fff0b0` · [ ] `zf_wulei` 5 紫白 · [ ] `zf_dihuo` 6 赤橙
- [ ] `zf_xuanwu` 4 青金+金 · [ ] `zf_liangyi` 2 黑白（阴面用淡蓝灰，禁黑）
- [ ] `zf_juling` 4 白绿 · [ ] `zf_huichun` 6 翠绿 · [ ] `zf_lianxi` 4 淡紫（整体偏暗）
- [ ] `zf_gujin` 9 暗紫+古金（饕餮/云雷纹，可残缺） · [ ] `zf_hushan` 12 金青+金（最宏大）

分层（【黑】1024²，纯白）：[ ] `zf_layer_outer` `zf_layer_band` `zf_layer_bagua` `zf_layer_core`

光罩/光幕：[ ] `zf_dome`(1024×768) `zf_dome_crack`(同位同尺寸) `zf_shatter`(1024²) `zf_curtain`(512²左右无缝) `zf_link`(1024×128左右无缝)

阵中特效：[ ] `zf_activate` `zf_break` `zf_pillar`(256×1024) `zf_eye`(512²) `zf_sword`(256×768 剑尖朝下) `zf_fire`(512×768) `zf_lightning`(256×1024)
【透】：[ ] `zf_fog`(768² 淡墨灰雾，中心约 60% alpha)

实物（【透】，正面略俯视 30°，person_px=215，manifest 写 anchor）：
[ ] `zf_flag_jin` `zf_flag_mu` `zf_flag_shui` `zf_flag_huo` `zf_flag_tu` `zf_flag_mo` `zf_eye_stone` `zf_eye_stone_ancient` `zf_stake` `zf_disc_ground`

物品图标（【透】256²，R7 商品图风）：
[ ] `icon_zhenpan_1..4` `icon_zhenqi_low` `icon_zhenqi_high` `icon_zhentu_low` `icon_zhentu_high` `icon_mat_zhenyu` `icon_mat_lingmo` `icon_mat_qimu` `icon_pojin_zhui`

阵法图标（【透】256²，R6 圆底）：
[ ] `zs_mizong` `zs_gengjin` `zs_wulei` `zs_dihuo` `zs_xuanwu` `zs_liangyi` `zs_huichun` `zs_lianxi` `zs_gujin` `zs_hushan`

破禁小游戏：
[ ] `ui_board`(1024²，比 zf_gujin 暗一半、无节点) · [ ] `ui_node_jin` `ui_node_mu` `ui_node_shui` `ui_node_huo` `ui_node_tu` `ui_node_trap` `ui_node_broken`（256²，形状即可区分：棱角/叶/涡/焰/方）

## 交付

- [x] `manifest.json`（Batch 1 已写 10 条，后续每批追加）
- [ ] 各目录 `preview/` 拼图（[x] huaxing）；阵纹圆盘另需一张压扁 45% 贴草地色 `#5d7a50` 的效果图
- [ ] 全部完成后 zip
