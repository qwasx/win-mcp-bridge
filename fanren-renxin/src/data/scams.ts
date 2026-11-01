// 第四十七步：人心 · 骗局与假象的文本库
// —— 世界上所有"说出来的话"都可能有两张脸：表里、假心声、假消息、骗局钩子
// 这里只放数据，判定与流程在 world/deceit.ts

export type ScamId = 'coop' | 'pill' | 'borrow' | 'beauty' | 'seize';

export interface ScamDef {
  id: ScamId;
  name: string;          // 骗局名（阅历册里用）
  weight: number;        // 在骗局池里的权重
  minRealm: number;      // 玩家大境界下限（低于此不出现）
  hook: string;          // 神识中看到的开场
  trap: string;          // 中招后的阅历条目
}

/** 已上线的骗局（2.3 #1/#2/#3/#4/#5） */
export const SCAM_DEFS: ScamDef[] = [
  { id: 'coop', name: '合作探宝，分赃翻脸', weight: 22, minRealm: 1, hook: '神识中：一个散修正蹲在一处裂谷边，朝你这边张望。', trap: '曾与人合作探宝，在宝箱前被同伙翻脸背刺' },
  { id: 'pill', name: '假丹药', weight: 20, minRealm: 0, hook: '神识中：一个行脚药商在路边支了个摊，正冲你招手。', trap: '曾在坊市地摊买过染色假丹' },
  { id: 'borrow', name: '借刀杀人', weight: 20, minRealm: 1, hook: '神识中：一个浑身带伤的修士跌跌撞撞朝你跑来。', trap: '曾被人当刀使，替人报了私仇' },
  { id: 'beauty', name: '美人局', weight: 16, minRealm: 1, hook: '神识中：一名衣衫单薄的女修扶着树干，似是受了伤。', trap: '曾被扮柔弱的女修夜里摄魂' },
  { id: 'seize', name: '夺舍老魔', weight: 22, minRealm: 1, hook: '神识中：一个重伤昏迷的老者倒在路旁，气若游丝。', trap: '曾被垂死前辈借渡灵力之名行夺舍之实' },
];

/** 江湖上流传、尚未撞上的其余手法（2.3 #6–#12）：作为坊间传闻进入阅历册 */
export const SCAM_LORE: string[] = [
  '拍卖会上有托——抬价的是卖家自己人。',
  '榜上悬赏的"妖修"，有时只是得罪了贴榜人的正派散修。',
  '主动求结拜的"义兄"，看上的多半是你的功法、本命法宝。',
  '求你护法的人，劫云里可能混着他雇来的杀手——你才是真正目标。',
  '牙人口中的"上品灵脉洞府"，住进去才发现灵脉早被抽干。',
  '报酬高得反常的商队，箱子里装的可能是魔道的货。',
  '荒野里小孩子的哭声，未必是小孩子。',
];

// ---------------------------------------------------------------- 表里：假心声
/** 表演心声——看着越热络，心里未必越干净 */
export const FAKE_MIND_WARM = [
  '这位道友好生面善。',
  '今日天朗气清，正宜论道。',
  '难得遇上投缘的人。',
  '一会儿定要请他喝杯灵茶。',
  '出门靠朋友，这位可得结交好了。',
];
export const FAKE_MIND_FLAT = [
  '这一带灵气稀薄。',
  '什么时候才能结丹……',
  '师父闭关前说的话，是什么意思？',
  '那本残卷上的符文……',
  '山中无甲子，寒尽不知年。',
];
export const FAKE_MIND_COLD = [
  '井水不犯河水便好。',
  '莫要多管闲事。',
  '今日不宜久留。',
  '少说两句，各自赶路。',
  '与我无关。',
];

/** 有阅历的人，偶尔能从假心里听出一丝不对 */
export const MIND_TELL = [
  '（他笑得有些过于热络了。）',
  '（这句客套，说得太快。）',
  '（他的眼神，一直没离开你的储物袋。）',
  '（话是热的，手是冷的。）',
];

// ---------------------------------------------------------------- 谎言与情报
export interface RumorTpl { text: string; truth: 0 | 0.5 | 1; tag: 'treasure' | 'foe' | 'bounty' | 'pill' | 'sect'; }

/** 打听消息时可能听到的说法——七真三假 */
export const RUMOR_POOL: RumorTpl[] = [
  { text: '{place}一带近日宝光隐现，怕是有天材地宝出世。', truth: 0.5, tag: 'treasure' },
  { text: '有人在{place}见着一株三百年以上的灵草，没敢独采。', truth: 1, tag: 'treasure' },
  { text: '{place}那座废府里藏着前人遗宝，图在我手里，你要不要？', truth: 0, tag: 'treasure' },
  { text: '{name}最近手头紧得很，见着富态的散修就眼红。', truth: 1, tag: 'foe' },
  { text: '{name}在背后说你坏话，说你身上有见不得人的东西。', truth: 0.5, tag: 'foe' },
  { text: '{name}是魔道安插在正道的暗子，我亲眼见他夜里出城。', truth: 0, tag: 'foe' },
  { text: '悬赏榜上那笔买卖，正主儿可不好惹，去的人十个剩不下三个。', truth: 1, tag: 'bounty' },
  { text: '听说坊市东头新来了一批三折的筑基丹，晚了可就没了。', truth: 0, tag: 'pill' },
  { text: '{place}的灵泉今年格外旺，打坐事半功倍。', truth: 1, tag: 'sect' },
  { text: '上面要清查外门弟子的来历，你这种来路不明的，早走为妙。', truth: 0, tag: 'sect' },
  { text: '{name}前些日子得了一件异宝，正愁没人护送他回山。', truth: 0.5, tag: 'treasure' },
  { text: '有人出大价钱，要{place}某个修士的项上人头。', truth: 0.5, tag: 'bounty' },
];

/** 谣言的口气修饰——谁在说、图什么 */
export const MOTIVE_LINE: Record<string, string> = {
  honest: '他说得恳切，眼神不闪不避。',
  bait: '他说完便低头喝茶，不看你的眼睛。',
  smear: '他压低了声音，像是生怕别人听见。',
  proxy: '他自己也说不清来路，只道"也是听人说的"。',
};

// ---------------------------------------------------------------- 玩家的骗术
export const FAKE_SECT_LINES = [
  '「黄枫谷执法堂办事，闲人回避！」',
  '「掩月宗巡山弟子在此，报上名来！」',
  '「化刀坞外务执事，奉命缉拿要犯！」',
];
