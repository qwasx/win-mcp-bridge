# 凡人修仙传 · 全体 NPC 立绘一次性完整交付说明 (`art/portraits`)

## 1. 交付总览（共 156 张立绘 + 14 张分组对比拼图）

严格按照 `fanren/docs/art-brief/PORTRAITS.md`（提交 `dc4d529`）完成全量 156 张人物半身立绘（`1080 × 1440` RGB PNG，不透明宣纸底）：

### 一、专属立绘 (`named/npc_<id>.png`，共 100 张)
- **4.1 黄枫谷（14 张）**：`lihuayuan`, `linghu`, `leiwanhe`, `hongfu`, `zhongweiniang`, `zhonglingdao`, `mashibo`, `wufeng`, `yeshishu`, `liujing`, `lushixiong`, `murong`, `o_luqingya`, `o_zhaowuji`
- **4.2 七玄门（6 张，凡人江湖无灵光）**：`modaifu`, `lifeiyu`, `wangjuechu`, `zhangtie`, `jiatianlong`, `sunergou`
- **4.3 越国其他正道宗门（16 张）**：`nichang`, `qionglaoguai`, `duobaonv`, `zhaoshimei`, `fuyunzi`, `hantianya`, `xiaoer`, `liyingning`, `fengyue`, `mayunlong`, `wuchi`, `zhongwu`, `lvtianmeng`, `hanyunzhi`, `yanruyan`, `yanlaozu`
- **4.4 魔道六宗（15 张）**：`wangchan`, `wangtiangu`, `wangtiansheng`, `suihun`, `guilao`, `tonglao`, `hehuanlaomo`, `yunlu`, `ju_m`, `ju_f`, `dongmentu`, `tiansha`, `weizhanglao`, `luzhanglao`, `fujia`
- **4.5 天道盟、天南散修、其他天南人物（18 张）**：`chengtiankun`, `lvluo`, `jiangyun`, `changzheng`, `xiangzhili`, `nanlonghou`, `wanxiaoshan`, `qiyunxiao`, `xinruyin`, `meng_m`, `meng_f`, `jinguang`, `yuzitong`, `ouyang`, `tianlan_saint`, `mulan_shi`, `caomengrong`, `wuchou`
- **4.6 原创角色（8 张）**：`o_mengtieyi`, `o_mengtieshan`, `o_huiming`, `o_gusonghe`, `o_leijiu`, `o_liusanniang`, `o_baixiao`, `o_ayu`
- **4.7 乱星海（10 张）**：`jiyin`, `xuangu`, `wuchou_jy`, `manhuzi`, `wentianren`, `liudao`, `qingyi`, `fanfuren`, `zhuoruting`, `miaohe`
- **4.8 大晋（9 张）**：`qianlaomo`, `fangzongzhu`, `tianku`, `lufuren`, `xuanqingzi`, `qimiao`, `hanli_ji`, `baiyaoyi`, `chelaoyao`
- **4.9 化形妖王、妖物（4 张）**：`fengxi`, `jinjiaowang`, `yinchi`, `dujiao`

### 二、通用立绘池 (`generic/gen_<id>.png`，共 56 张)
- **5.1 正道宗门弟子与长老（13 张）**：`sect_m1` ~ `sect_m7`, `sect_e1`, `sect_e2`, `sect_f1` ~ `sect_f4`
- **5.2 魔道修士（10 张）**：`demon_m1` ~ `demon_m6`, `demon_e1`, `demon_f1` ~ `demon_f3`
- **5.3 散修与劫修（8 张）**：`rogue_m1` ~ `rogue_m6`, `rogue_f1`, `rogue_f2`
- **5.4 商人（3 张）**：`merchant_m1`, `merchant_m2`, `merchant_f1`
- **5.5 凡人（13 张，无灵光无仙气）**：`farmer_m1`, `farmer_m2`, `scholar_m1`, `scholar_m2`, `guard_m1`, `guard_m2`, `mortal_f1` ~ `mortal_f3`, `elder_m1`, `elder_f1`, `child_m1`, `child_f1`
- **5.6 佛门（2 张）**：`monk_1`, `monk_2`
- **5.7 地域特色（7 张）**：`sea_m1`, `sea_m2`, `sea_f1`, `mulan_m1`, `mulan_f1`, `jin_m1`, `jin_f1`

### 三、缩略对比拼图 (`sheets/sheet_*.jpg`，共 14 张，第一格固定为 `hanli.webp` 基准)
- `sheet_huangfeng.jpg`, `sheet_qixuan.jpg`, `sheet_yue_sects.jpg`, `sheet_modao.jpg`, `sheet_tiannan.jpg`, `sheet_original.jpg`, `sheet_luanxinghai.jpg`, `sheet_dajin.jpg`, `sheet_yaowang.jpg`, `sheet_gen_sect.jpg`, `sheet_gen_demon.jpg`, `sheet_gen_rogue_merch.jpg`, `sheet_gen_mortal.jpg`, `sheet_gen_special.jpg`

## 2. 自检清单核验结果
- **画风统一**：全员对齐 `hanli.webp` 2D 国风淡彩工笔水彩插画。
- **比例与留白**：全员 `1080 × 1440` RGB PNG，头顶距上边缘 `9.5%–10.5%`，七头身修长比例，左右留出对应阵营的宣纸淡墨背景。
- **唯一性校验**：156 张 PNG 经 MD5 校验，0 重复、0 缺失、0 透明通道异常。
