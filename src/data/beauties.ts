// 第五步：红颜（立绘 + 代码绘制的精致面容 + 专属剧情线）
// 自由发展：遵照原著性格与身世，但命运由你的选择决定
import { withFace, type Look } from '../gfx/character';
import type { Pers, Faction } from '../world/npc';

export interface Chapter {
  id: string;
  title: string;
  /** 解锁条件 */
  req: { favor?: number; realm?: number; flag?: string; notFlag?: string; item?: string; year?: number };
  hint: string;                              // 红颜录中的提示
  text: string;                              // 正文（\n 分段）
  choices: { label: string; favor: number; flag?: string; reply: string; give?: { id: string; n: number }; take?: { id: string; n: number }; tone?: 'love' | 'good' | 'bad' | 'gold'; exp?: number; end?: 'companion' | 'part' }[];
}
export interface BeautyDef {
  id: string; name: string; title: string; portrait: string;
  home: string; realm: number; stage: number; faction: Faction; pers: Pers; age: number;
  color: string;                 // 助战法术光色 'r,g,b'
  intro: string;                 // 红颜录简介
  likes: string[];               // 偏爱的礼物（物品 id / 类型）
  greet: string[];               // 日常问候（按好感由低到高）
  follow: string;                // 同行时的台词
  bonus: { kind: 'atk' | 'def' | 'regen' | 'sense' | 'exp' | 'luck'; v: number; text: string };
  look: Look;
  chapters: Chapter[];
}

const base = (o: Partial<Look>): Look => ({
  sex: 'f', height: 0.97, build: 0.88, skin: '#f6e2d0', hair: '#15110f', hairStyle: 'long', bangs: false,
  robe: '#e8e8f0', inner: '#f8f4ee', trim: '#9aa0b0', belt: '#6a6a80', pants: '#d8d8e4', boots: '#6a5a5a',
  robeLen: 'long', sleeve: 'wide', back: 'none', waist: 'jade', hand: 'none', lash: true, lip: '#c84a5a', eyeTint: '#5a3a2a',
  swordColor: '#bfe8ff', ...o,
});

export const BEAUTIES: BeautyDef[] = [
  {
    id: 'nangongwan', name: '南宫婉', title: '掩月宗结丹修士', portrait: './art/nangongwan.webp',
    home: 'yanyue', realm: 3, stage: 0, faction: 'sect', pers: 'cautious', age: 210, color: '255,150,90',
    intro: '掩月宗长老，修《素女轮回功》，容颜如少女，性子清冷，心思却极细。原著中韩立一生的道侣。',
    likes: ['pill_dingyan', 'herb_xuelian', 'art_zhuque', 'pill_yanghun'],
    greet: ['（她淡淡看了你一眼）有事？', '……是你啊。近来修为可有长进？', '（她唇角微不可察地扬了一下）你来了。', '你来了。这几日……我常想起禁地里的事。'],
    follow: '走吧。若遇强敌，你我联手便是。',
    bonus: { kind: 'atk', v: 0.12, text: '同行时法术威力 +12%（朱雀环火海助战）' },
    look: withFace(base({ robe: '#eef2f8', trim: '#8aa4c8', inner: '#ffffff', shawl: '#d4e4f4', hairStyle: 'feixian', pin: 'jade', ribbon: '#9ab8e0', lip: '#c4424e', earring: '#bfe0ff', swordColor: '#ffb27a', height: 1.0 }), 'nangongwan'),
    chapters: [
      { id: 'n0', title: '禁地初逢', req: {}, hint: '前往掩月宗附近寻她',
        text: '远处一道赤红火光冲天而起，一名白衣女子被三名魔修围在中间。她足下朱雀环轮转如火，护体灵光却已摇摇欲坠——显是旧伤未愈，强撑至今。\n\n她瞥见你，眸中闪过一丝警惕：「这位道友，若无意插手，还请速速离去。」\n\n话音未落，一道血光已向她背心袭去。',
        choices: [
          { label: '祭出法器，替她挡下这一击', favor: 22, flag: 'n_saved', tone: 'good', reply: '血光撞在你的护体灵光上，震得你气血翻涌。魔修见来了帮手，骂了一声，化作血遁逃去。\n\n她收起朱雀环，静静看了你片刻：「……掩月宗南宫婉。这份人情，我记下了。」\n\n说罢，她转身离去，衣袂翻飞间，一缕极淡的幽香留在了风里。' },
          { label: '远远观望，伺机而动', favor: 4, reply: '你敛息藏于暗处。片刻后，她以秘术强催朱雀环，火海翻卷，将三名魔修逼退，自己却喷出一口鲜血。\n\n「出来吧。」她拭去唇边血迹，声音冷淡，「藏头露尾，算什么修士。」' },
          { label: '转身离开，此事与我无关', favor: -10, reply: '你转身离去。身后火光渐熄，不知结果如何。' },
        ] },
      { id: 'n1', title: '三日护法', req: { favor: 25, realm: 1 }, hint: '好感 25 以上再去寻她',
        text: '再见她时，她独自坐在一处山洞里，脸色潮红，气息紊乱。\n\n「我中了一种奇毒……需闭关三日逼出。」她咬着唇，似是极不愿开口，「这三日我毫无还手之力。你……可愿替我护法？」\n\n洞外，隐隐有魔修的神识在搜寻。',
        choices: [
          { label: '守在洞口，三日三夜寸步不离', favor: 25, flag: 'n_guard', tone: 'love', exp: 0.08, reply: '三日里，你斩退了两拨搜山的魔修，自己也挂了彩。第三日黄昏，洞中灵光一敛，她缓步走出，看见你肩上的伤，怔了一怔。\n\n「……傻子。」\n\n她取出一枚丹药塞进你手里，指尖有些凉。转身时，你分明看见她耳根微红。' },
          { label: '设下阵旗，自己在附近修炼', favor: 8, exp: 0.05, reply: '你布下阵旗，在不远处打坐。三日后她出关，看了看阵旗，又看了看你：「心思倒是缜密。」语气里听不出喜怒。' },
        ] },
      { id: 'n2', title: '定颜', req: { favor: 45, realm: 2 }, hint: '筑基之后，好感 45 以上',
        text: '月色下，她递给你一个小小的玉瓶。\n\n「定颜丹。修仙之人寿元悠长，容貌却终会老去。」她顿了顿，望向远山，「我修素女轮回功，容颜不改……可我见过太多同门，一年年老去、坐化。」\n\n「你若能结丹，便来掩月宗找我。我有话……想当面问你。」',
        choices: [
          { label: '「我一定会来。」', favor: 15, flag: 'n_promise', tone: 'love', give: { id: 'pill_dingyan', n: 1 }, reply: '她没有回头，只轻轻「嗯」了一声。\n\n那一夜的月光很亮，你却一直记得她转身时，发间那支白玉簪轻轻晃动的样子。' },
          { label: '「仙路漫漫，你我各自珍重。」', favor: -5, give: { id: 'pill_dingyan', n: 1 }, reply: '她握着玉瓶的手指紧了紧，旋即松开：「……也好。」\n\n她把定颜丹放在石上，化作一道白光远去。' },
        ] },
      { id: 'n3', title: '掩月风波', req: { favor: 60, realm: 3 }, hint: '结丹之后，好感 60 以上',
        text: '你如约来到掩月宗，却见山门外魔气冲天——鬼灵门趁掩月宗大比之际突袭，南宫婉正带着几名弟子死守山门。\n\n看见你，她清冷的眼中亮起一点光：「你……真的来了。」\n\n魔修首领狞笑：「南宫婉，交出素女轮回功，饶你同门一命！」',
        choices: [
          { label: '与她并肩而立：「要动她，先过我这一关。」', favor: 20, flag: 'n_fight', tone: 'love', exp: 0.1, reply: '剑光与火海交织，一炷香后，魔修溃退。\n\n她收起朱雀环，第一次在人前主动握住了你的手。\n\n「你问我想问你什么……」她低声说，「我想问，你愿不愿意，和我一起走这条路。」' },
          { label: '劝她暂避锋芒，保全性命要紧', favor: 4, reply: '她摇头：「掩月宗是我的师门。」最终你们杀退了魔修，她却受了伤，看你的眼神里多了几分复杂。' },
        ] },
      { id: 'n4', title: '结为道侣', req: { favor: 85, realm: 3, flag: 'n_promise' }, hint: '好感 85 以上，且许下过诺言',
        text: '桂花树下，她换下了一贯的白衣，着一袭浅绯长裙。\n\n「修仙界的道侣，大多是为了双修互利。」她看着你，目光很静，「我不要那些。我只要你答应我一件事——」\n\n「无论将来你走到哪一界，都不许丢下我一个人。」',
        choices: [
          { label: '「此生此世，生死相随。」', favor: 15, flag: 'n_wed', tone: 'love', end: 'companion', give: { id: 'pill_yanshou', n: 1 }, reply: '她笑了。那是你第一次见她真正地笑，像冰雪初融，春水微澜。\n\n从此天南多了一对神仙眷侣。\n\n（南宫婉成为你的道侣，可随时同行助战）' },
          { label: '「大道无情，我给不了这个承诺。」', favor: -30, end: 'part', reply: '她沉默良久，轻声道：「我明白了。」\n\n此后，掩月宗南宫婉闭关不出，再未与你相见。' },
        ] },
    ],
  },
  {
    id: 'dongxuaner', name: '董萱儿', title: '黄枫谷红拂之徒', portrait: './art/dongxuaner.webp',
    home: 'huangfeng', realm: 1, stage: 8, faction: 'sect', pers: 'arrogant', age: 19, color: '255,120,170',
    intro: '黄枫谷红拂真人的爱徒，娇俏任性，修有媚术，引得谷中男弟子争风吃醋。真心如何，无人知晓。',
    likes: ['pill_dingyan', 'herb_nichang', 'tal_tishen', 'pill_zhuji'],
    greet: ['哟，这不是那个闷葫芦吗？', '师兄今日倒是有空来找我？', '（她眨眨眼）你是不是想我了？', '你来啦！我等你好久了。'],
    follow: '本姑娘陪你走一趟，你可得护好我！',
    bonus: { kind: 'luck', v: 0.15, text: '同行时坊市购物 -15%，掉落略增' },
    look: withFace(base({ robe: '#f0a8bc', trim: '#c05070', inner: '#fff0f4', shawl: '#ffd8e4', hairStyle: 'shuanghuan', bangs: true, ribbon: '#e03050', pin: 'flower', huadian: '#e03050', lip: '#e04a6a', eyeTint: '#6a3a3a', height: 0.94, earring: '#ff9ab8', swordColor: '#ff9ac8' }), 'dongxuaner'),
    chapters: [
      { id: 'd0', title: '桃花劫', req: {}, hint: '在黄枫谷能遇见她',
        text: '一名粉衣少女拦住你的去路，歪着头打量你，身后跟着两个满脸妒色的男弟子。\n\n「你就是那个新来的？听说你炼丹很厉害呀。」她笑盈盈地凑近，身上带着甜腻的花香，「师兄……能不能送我几颗聚气丹？」\n\n你察觉到，她的笑容里带着一丝媚术的灵力波动。',
        choices: [
          { label: '运转心法，不为所动：「师妹请自重。」', favor: 12, flag: 'd_cold', reply: '媚术落空，她愣了愣，随即咯咯笑起来：「有意思！你是第一个不吃这一套的。」\n\n她转身走了，却回头冲你做了个鬼脸。' },
          { label: '送她两颗丹药', favor: 6, take: { id: 'pill_juqi', n: 1 }, reply: '她接过丹药，笑得眉眼弯弯：「师兄真好！」\n\n转身时，那笑容就淡了。身后的男弟子瞪着你，像要吃人。' },
          { label: '「想要丹药？自己去炼。」', favor: -4, reply: '「哼，不解风情！」她跺跺脚走了。' },
        ] },
      { id: 'd1', title: '筑基丹', req: { favor: 25 }, hint: '好感 25 以上',
        text: '她深夜来访，眼圈红红的。\n\n「师父说我这次升仙大会若再拿不到筑基丹，就……」她咬着唇，「我知道你手里有门路。我不白要，我……我可以拿东西换。」\n\n你注意到，她的媚术这一次没有用。',
        choices: [
          { label: '答应帮她留意筑基丹的消息', favor: 15, flag: 'd_help', reply: '「真的？」她破涕为笑，又别过脸，「……谢谢。」\n\n临走前她回过头：「我以前是骗过很多人。但这次，我没骗你。」' },
          { label: '把自己的筑基丹给她', favor: 35, flag: 'd_gift', take: { id: 'pill_zhuji', n: 1 }, tone: 'love', reply: '她捧着那枚丹药，愣愣地看了你许久。\n\n「你……你知不知道这是什么？」她的声音有些发颤，「你就这么给我了？」\n\n她忽然扑进你怀里，又飞快地退开，脸红到了耳根，一溜烟跑了。' },
          { label: '「你那些手段，对我没用。」', favor: -8, reply: '她脸色一白，冷笑一声：「好，算我看错了你。」' },
        ] },
      { id: 'd2', title: '红拂', req: { favor: 50, realm: 2 }, hint: '筑基之后，好感 50 以上',
        text: '红拂真人找上门来，冷冷地看着你：「萱儿那丫头近来茶饭不思，修为也停滞了。你给我说清楚，你们是什么关系？」\n\n躲在师父身后的董萱儿拼命冲你使眼色。',
        choices: [
          { label: '「晚辈对萱儿师妹，是真心的。」', favor: 22, flag: 'd_true', tone: 'love', reply: '红拂盯着你看了半晌，哼了一声：「若敢负她，本座亲手废了你。」\n\n师父走后，董萱儿揪着你的袖子，声音低得几乎听不见：「……你刚才说的，是真的吗？」' },
          { label: '「只是同门之谊。」', favor: -10, reply: '红拂点点头走了。董萱儿站在原地，第一次没有笑。' },
        ] },
      { id: 'd3', title: '洗尽铅华', req: { favor: 75, flag: 'd_true' }, hint: '好感 75，并在红拂面前表明心意',
        text: '她卸去了脂粉，素着一张脸来见你。\n\n「我以前用媚术，是因为我灵根差，只能靠别人。」她低着头，「可是遇见你以后，我不想再那样了。我想……靠自己修上去，配得上你。」\n\n她伸出手，掌心是一枚亲手炼制的、歪歪扭扭的平安符。',
        choices: [
          { label: '握住她的手：「以后，我陪你一起修。」', favor: 20, end: 'companion', tone: 'love', give: { id: 'tal_tishen', n: 1 }, reply: '她「哇」地哭出来，又笑，鼻涕眼泪糊了你一身。\n\n（董萱儿愿与你同行）' },
          { label: '收下平安符，郑重道谢', favor: 8, give: { id: 'tal_tishen', n: 1 }, reply: '她看着你收好平安符，笑了笑：「那……就这样吧。」' },
        ] },
    ],
  },
  {
    id: 'chenqiaoqian', name: '陈巧倩', title: '黄枫谷女弟子', portrait: './art/chenqiaoqian.webp',
    home: 'huangfeng', realm: 1, stage: 10, faction: 'sect', pers: 'kind', age: 22, color: '160,230,170',
    intro: '黄枫谷陈家女子，温婉内敛。原著中暗恋韩立而不得言，最终香消玉殒。这一次，结局或许不同。',
    likes: ['herb_lingzhi', 'pill_liaoshang', 'herb_tianling', 'pill_huiqi'],
    greet: ['韩、韩师兄……', '师兄今日也去采药吗？', '（她低头绞着衣角）师兄，我做了些点心……', '你来了。我就知道你会来。'],
    follow: '我……我会照顾好师兄的伤。',
    bonus: { kind: 'regen', v: 0.5, text: '同行时脱战回复速度 +50%（回春术）' },
    look: withFace(base({ robe: '#b8d4b0', trim: '#5a8a5a', inner: '#f8fff4', shawl: '#e8f4e0', hairStyle: 'chuihuan', pin: 'jade', ribbon: '#7aa87a', lip: '#c8646e', height: 0.95 }), 'chenqiaoqian'),
    chapters: [
      { id: 'c0', title: '药园偶遇', req: {}, hint: '在黄枫谷药园附近',
        text: '药园里，一名绿衣女子正蹲在地上，小心地给一株灵草松土。她额角沁着细汗，听见脚步声，慌忙站起来，却踩到裙角险些摔倒。\n\n「啊……这位师兄，对不住，我挡了你的路。」她红着脸让开。',
        choices: [
          { label: '扶住她，帮她一起照料灵草', favor: 15, reply: '你们一起干了一下午的活。她话不多，却会在你手被叶刺划破时，悄悄递来一方手帕。\n\n「我叫陈巧倩。」分别时她小声说，「师兄……明天还来吗？」' },
          { label: '点头示意，径自离开', favor: 2, reply: '她目送你远去，过了很久，才继续低头松土。' },
        ] },
      { id: 'c1', title: '心事', req: { favor: 30 }, hint: '好感 30 以上',
        text: '她托同门转交给你一个食盒，里面是几块桂花糕，和一张折得很小的纸条。\n\n纸上只有一行娟秀的小字：「山中风大，师兄采药时多添件衣裳。」\n\n没有落款。',
        choices: [
          { label: '亲自去道谢', favor: 18, flag: 'c_thanks', tone: 'love', reply: '她看见你时，脸一下子红透了，手足无措地说不出话。\n\n你说桂花糕很好吃。她低着头笑了，笑得像药园里刚开的花。' },
          { label: '收下，回赠一株灵草', favor: 10, take: { id: 'herb_huangjing', n: 1 }, reply: '同门回来说，她捧着那株黄精发了好一会儿呆，后来种在了自己的小药圃里。' },
        ] },
      { id: 'c2', title: '劫数', req: { favor: 50, realm: 2 }, hint: '筑基之后，好感 50 以上',
        text: '你收到一枚传音符，是她的声音，急促而微弱：「师兄……燕家堡……有埋伏……别来……」\n\n传音戛然而止。\n\n原著里，她就是在这样的乱局中，悄无声息地死去。',
        choices: [
          { label: '立刻赶往燕家堡', favor: 30, flag: 'c_saved', tone: 'love', exp: 0.06, reply: '你在一片狼藉中找到她时，她护着几个年幼的同门，浑身是血，却还在掐诀。\n\n看见你，她手中的法诀一松，整个人软了下去：「我说了……别来的……」\n\n你抱起她，她靠在你肩头，轻轻地笑了：「……可是你来了。」\n\n（你改写了她的命运）' },
          { label: '她叫你别去……你犹豫了', favor: -40, flag: 'c_dead', reply: '三日后，黄枫谷传来消息：陈巧倩在燕家堡之变中陨落，年仅二十余岁。\n\n她的遗物里，有一张没有寄出的纸条。' },
        ] },
      { id: 'c3', title: '长相守', req: { favor: 80, flag: 'c_saved' }, hint: '救下她之后，好感 80 以上',
        text: '伤愈之后，她第一次主动来找你，站在你洞府门口，深吸了一口气。\n\n「师兄，我……我喜欢你。从药园那天起就喜欢。」\n\n她说完就闭上了眼睛，睫毛轻轻颤着，像在等一个判决。',
        choices: [
          { label: '轻轻抱住她', favor: 20, end: 'companion', tone: 'love', reply: '她在你怀里哭了很久。\n\n「我以为……我这辈子都说不出口了。」\n\n（陈巧倩愿与你同行）' },
          { label: '「巧倩，你值得更好的人。」', favor: -10, end: 'part', reply: '她睁开眼，笑着点了点头，眼泪却一颗颗掉下来。\n\n「嗯。谢谢你，师兄。」' },
        ] },
    ],
  },
  {
    id: 'mocaihuan', name: '墨彩环', title: '嘉元城墨府小姐', portrait: './art/mocaihuan.webp',
    home: 'jiayuan', realm: 0, stage: 0, faction: 'mortal', pers: 'kind', age: 16, color: '255,210,140',
    intro: '墨大夫之女，天真烂漫的凡人少女。墨府在嘉元城势大，却也树敌颇多。凡人与修士，终究是两个世界。',
    likes: ['pill_dingyan', 'pill_yanshou', 'herb_huangjing', 'mat_lingshi'],
    greet: ['你是谁呀？怎么进的墨府？', '韩大哥！你又来看我啦？', '韩大哥，我新学了一首曲子，弹给你听好不好？', '（她扑过来）你终于来了！'],
    follow: '真的可以带我去看仙人的世界吗？',
    bonus: { kind: 'exp', v: 0.08, text: '同行时修为获取 +8%（心境安宁）' },
    look: withFace(base({ robe: '#d4bce0', trim: '#8a6aa0', inner: '#fff8ff', hairStyle: 'twin', bangs: true, pin: 'flower', ribbon: '#e0a0c0', lip: '#d86a7a', height: 0.92, skin: '#f8e6d6', sleeve: 'narrow' }), 'mocaihuan'),
    chapters: [
      { id: 'm0', title: '墨府', req: {}, hint: '在嘉元城',
        text: '墨府后院，一个鹅黄衫子的少女正踮着脚够树上的风筝，一抬头看见墙头上的你，吓得「呀」了一声。\n\n「你、你是贼吗？」她攥着裙角，又好奇地眨眼，「贼会飞吗？你刚才是飞上来的吧！」',
        choices: [
          { label: '纵身取下风筝递给她', favor: 18, reply: '她接过风筝，眼睛亮晶晶的：「你果然会飞！你是仙人对不对？」\n\n「我叫墨彩环。」她压低声音，「你下次还来好不好？我不告诉别人。」' },
          { label: '「在下只是路过。」', favor: 5, reply: '「路过墙头？」她噗嗤一声笑出来，「好吧，路过的仙人，再见啦。」' },
        ] },
      { id: 'm1', title: '欧阳飞天', req: { favor: 25 }, hint: '好感 25 以上',
        text: '你再来墨府时，正撞见一伙江湖人围住了大门，为首的是嘉元城一霸欧阳飞天。\n\n「墨居仁那老东西死了，墨府这块肥肉，也该换个主人了！」\n\n墨彩环站在母亲身后，脸色发白，却挺直了脊背。',
        choices: [
          { label: '出手赶走欧阳飞天', favor: 25, flag: 'm_save', tone: 'good', reply: '凡人武功在修士面前不堪一击。欧阳飞天连滚带爬地逃了。\n\n那天晚上，她坐在台阶上，抱着膝盖小声说：「韩大哥，我爹……真的死了吗？」\n\n你没有回答。她靠在你肩上，哭着睡着了。' },
          { label: '暗中出手，不露身份', favor: 15, flag: 'm_save', reply: '欧阳飞天莫名其妙地被打成重伤，从此再不敢踏进墨府半步。\n\n墨彩环望着空荡荡的墙头，若有所思。' },
        ] },
      { id: 'm2', title: '凡人与仙', req: { favor: 50, realm: 2 }, hint: '筑基之后，好感 50 以上',
        text: '她已经长成了大姑娘，来提亲的人踏破了门槛。\n\n「娘让我嫁人。」她望着你，「韩大哥，你是仙人，能活好几百年。等我老了，变丑了，你还会记得我吗？」\n\n凡人与修士，寿元天差地别。',
        choices: [
          { label: '送她一枚定颜丹', favor: 25, take: { id: 'pill_dingyan', n: 1 }, flag: 'm_dingyan', tone: 'love', reply: '「这是……让人不会老的药？」她捧着玉瓶，眼眶红了，「我不要不老。我只要……你记得我。」\n\n但她还是珍重地收了起来。' },
          { label: '「去过你自己的日子吧，彩环。」', favor: 0, flag: 'm_marry', end: 'part', reply: '一年后，墨彩环嫁给了一位书生。听说日子过得很好。\n\n她出嫁那天，你远远地站在城外山头上，看着花轿走远。' },
        ] },
      { id: 'm3', title: '一生', req: { favor: 75, flag: 'm_dingyan' }, hint: '赠过定颜丹，好感 75 以上',
        text: '「我想好了。」她说，「我不嫁人。我想跟着你，去看看你的世界——哪怕只能看几十年。」\n\n「就算有一天我老得走不动了，你把我留在某个开满花的山谷里就好。」',
        choices: [
          { label: '「那我便陪你看遍人间。」', favor: 20, end: 'companion', tone: 'love', reply: '她笑着擦掉眼泪，像小时候那样拉住你的袖子。\n\n（墨彩环愿与你同行。凡人之躯，请护她周全）' },
        ] },
    ],
  },
  {
    id: 'mupeiling', name: '慕沛灵', title: '落云宗女修', portrait: './art/mupeiling.webp',
    home: 'luoyun', realm: 2, stage: 0, faction: 'sect', pers: 'cautious', age: 60, color: '120,200,230',
    intro: '落云宗弟子，曾被宗门当作“赏赐”许配给强者为侍妾，心中苦楚不足为外人道。外柔内刚。',
    likes: ['pill_juling', 'herb_bingpo', 'pill_dingyan', 'art_languang'],
    greet: ['……前辈。', '前辈有何吩咐？', '（她给你斟了一杯茶）你今天来得早。', '你来了。我煮了你爱喝的灵茶。'],
    follow: '我随你去。这一次，是我自己选的。',
    bonus: { kind: 'def', v: 0.12, text: '同行时受到伤害 -12%（冰魄护身）' },
    look: withFace(base({ robe: '#6aa4b4', trim: '#2a5a6a', inner: '#f0f8fa', shawl: '#c8e4ec', hairStyle: 'halfup', pin: 'gold', lip: '#c05866', height: 0.97, earring: '#e0c070' }), 'mupeiling'),
    chapters: [
      { id: 'p0', title: '赏赐', req: {}, hint: '在落云宗',
        text: '落云宗长老笑呵呵地将一名女修推到你面前：「道友为我宗出力良多，这是我宗弟子慕沛灵，便送与道友做个侍妾，端茶递水也好。」\n\n女修垂着眼，一言不发，指节却攥得发白。',
        choices: [
          { label: '「修士不是物件，在下不收。」', favor: 25, flag: 'p_free', tone: 'good', reply: '长老讪讪而去。慕沛灵抬起头，第一次正眼看你，眼中满是不敢置信。\n\n「……多谢前辈。」她深深一拜，声音发哽。' },
          { label: '收下，但以礼相待', favor: 12, flag: 'p_kept', reply: '她跟你回了洞府，安静地做着侍女的事。你从不使唤她，她却总把一切收拾得井井有条。' },
        ] },
      { id: 'p1', title: '冰心', req: { favor: 35 }, hint: '好感 35 以上',
        text: '她在你洞府外跪了一夜。\n\n「我修的冰魄诀卡在瓶颈十年了。」她低声道，「我知道不该开口……可我不想一辈子任人摆布。我想变强。」',
        choices: [
          { label: '指点她修行，赠她聚灵丹', favor: 22, take: { id: 'pill_juling', n: 1 }, tone: 'good', reply: '一个月后，她破关而出，冰魄灵光映得满室生寒。\n\n她站在你面前，挺直了脊背：「从今往后，没有人能再把我当物件送人。」\n\n她说这话时看着你，眼睛里有光。' },
          { label: '「瓶颈需自己参悟。」', favor: 3, reply: '她点点头，起身离去。背影很直。' },
        ] },
      { id: 'p2', title: '同心', req: { favor: 70, realm: 2 }, hint: '好感 70 以上',
        text: '「从前我恨宗门把我当赏赐。」她替你整理衣襟，动作很轻，「可现在想来，若不是那样，我也遇不到你。」\n\n「我不要做你的侍妾。我要做——能和你并肩的人。」',
        choices: [
          { label: '「那便并肩。」', favor: 20, end: 'companion', tone: 'love', reply: '她笑了，眼角有泪光：「一言为定。」\n\n（慕沛灵愿与你同行）' },
        ] },
    ],
  },
  {
    id: 'ziling', name: '紫灵', title: '妙音门门主', portrait: './art/ziling.webp',
    home: 'miaoyin', realm: 2, stage: 2, faction: 'sect', pers: 'aloof', age: 80, color: '200,140,255',
    intro: '乱星海妙音门之主，绝色倾城，心机深沉。身负血仇，周旋于群狼之间，所求不过一方安身之地。',
    likes: ['art_tianyang', 'pill_dingyan', 'herb_xuejing', 'mat_yaodan5'],
    greet: ['（她以扇掩面，眸光流转）道友有何指教？', '韩道友，又见面了。', '你来了。今日不谈生意，陪我喝杯酒吧。', '（她靠过来）我就知道，你会来找我。'],
    follow: '妙音门的事，我已安排妥当。往后，我的路由我自己选。',
    bonus: { kind: 'sense', v: 0.2, text: '同行时神识范围 +20%（妙音传讯）' },
    look: withFace(base({ robe: '#8a5ab4', trim: '#4a2a6a', inner: '#f4ecff', shawl: '#e4ccf4', hairStyle: 'liuyun', pin: 'gold', huadian: '#c040a0', lip: '#d03e6a', eyeTint: '#5a3a6a', earring: '#f0d080', height: 1.0, hand: 'fan', swordColor: '#d8a8ff' }), 'ziling'),
    chapters: [
      { id: 'z0', title: '天星城', req: {}, hint: '在乱星海妙音门一带',
        text: '天星城拍卖会后，一名紫衣女子拦住了你。她容色之盛，让周围的修士都看直了眼。\n\n「道友方才拍下的那件东西……妙音门愿出三倍价钱。」她笑意盈盈，眼底却冷静得像深海，「当然，若道友另有所求，也可以谈。」',
        choices: [
          { label: '「东西可以给你。我想知道，你为何要它。」', favor: 18, flag: 'z_honest', reply: '她怔了一下，笑意淡了几分：「……六道极圣的儿子要它。我若拿不到，妙音门便要换主人了。」\n\n这是她第一次对外人说真话。' },
          { label: '「三倍？成交。」', favor: 8, give: { id: 'mat_lingshi', n: 300 }, reply: '「爽快。」她付了灵石，转身时回眸一笑，「韩道友，后会有期。」' },
        ] },
      { id: 'z1', title: '温天仁', req: { favor: 30, realm: 2 }, hint: '好感 30 以上',
        text: '温天仁带人包围了妙音门。\n\n「紫灵仙子，」他摇着折扇，「做我的侍妾，妙音门可保无虞。」\n\n紫灵脸色苍白，袖中玉指扣着一枚同归于尽的雷珠。她看见了人群外的你。',
        choices: [
          { label: '现身：「仙子已与在下有约。」', favor: 30, flag: 'z_stand', tone: 'love', reply: '温天仁眯起眼：「你是什么东西？」\n\n一场恶战后，温天仁冷笑离去：「好，我记住你了。」\n\n紫灵收起雷珠，手还在抖：「你知不知道，你得罪的是谁？」\n\n「知道。」你说。\n\n她看着你，许久，忽然笑了——不是那种算计的笑。' },
          { label: '暗中传音，教她脱身之计', favor: 14, reply: '她依计行事，借乱星海各方势力的牵制暂时脱了困。事后她派人送来一封信，只有两个字：「多谢。」' },
        ] },
      { id: 'z2', title: '卸下面具', req: { favor: 65 }, hint: '好感 65 以上',
        text: '月下，她卸去了钗环，像个寻常女子一样坐在礁石上，赤足拨着海水。\n\n「我这一生，处处算计，从不敢信任何人。」她仰头看你，「可你总让我算不准。」\n\n「韩立，我累了。你愿不愿意……让我不必再算计？」',
        choices: [
          { label: '在她身边坐下：「有我在。」', favor: 20, end: 'companion', tone: 'love', reply: '她靠在你肩上，海风吹乱了她的发。\n\n「那就说好了。」她轻声说，「我把后半生，押在你身上。」\n\n（紫灵愿与你同行）' },
        ] },
    ],
  },
  {
    id: 'yuanyao', name: '元瑶', title: '乱星海女修', portrait: './art/yuanyao.webp',
    home: 'kuixing', realm: 2, stage: 0, faction: 'rogue', pers: 'kind', age: 50, color: '160,140,255',
    intro: '乱星海散修，重情重义。挚友妍丽被魔头所害，魂魄将散，她四处奔走只求一线生机。',
    likes: ['mat_yanghunmu', 'pill_yanghun', 'pill_dingyan', 'herb_jiuqu'],
    greet: ['道友……可曾听说过养魂木的消息？', '韩道友！上次多谢你了。', '（她浅浅一笑）今日妍丽的魂魄好些了。', '你来啦。我一直在等你。'],
    follow: '这一程，换我护着你。',
    bonus: { kind: 'def', v: 0.08, text: '同行时受到伤害 -8%，鬼物伤害 +' },
    look: withFace(base({ robe: '#4a3e5e', trim: '#2a2238', inner: '#ece4f8', shawl: '#8a7ab0', hairStyle: 'long', pin: 'jade', ribbon: '#a090d0', lip: '#b8506a', height: 0.98, swordColor: '#c0a8ff' }), 'yuanyao'),
    chapters: [
      { id: 'y0', title: '求木', req: {}, hint: '在乱星海魁星岛一带',
        text: '一名黑衣女修在坊市里四处打听，一遍遍地问：「请问……可有人知道养魂木的下落？多少灵石我都愿意出。」\n\n她手中捧着一个小小的魂瓶，瓶中有一缕极淡的残魂，正在一点点消散。',
        choices: [
          { label: '问她缘由', favor: 15, reply: '「这是我的姐妹妍丽。」她低头看着魂瓶，「她为了救我，被魔头打散了肉身。若找不到养魂木，她撑不过三年。」\n\n「我叫元瑶。道友若有消息，求你告诉我。」' },
          { label: '摇头离开', favor: 0, reply: '她失望地垂下眼，继续去问下一个人。' },
        ] },
      { id: 'y1', title: '养魂木', req: { favor: 15, item: 'mat_yanghunmu' }, hint: '寻得一截养魂木',
        text: '你取出那截养魂木时，元瑶的手抖得几乎接不住。\n\n「这……这是真的养魂木？」她眼泪夺眶而出，「道友，你要什么？灵石、法宝、我的命——」',
        choices: [
          { label: '「什么都不要。救人要紧。」', favor: 40, flag: 'y_wood', take: { id: 'mat_yanghunmu', n: 1 }, tone: 'love', reply: '魂瓶里那缕残魂，在养魂木的滋养下渐渐凝实。\n\n元瑶跪坐在地上，又哭又笑。后来她对你说：「这份恩情，元瑶此生必报。不，此生不够，生生世世。」' },
          { label: '「用你的法宝来换。」', favor: 8, flag: 'y_wood', take: { id: 'mat_yanghunmu', n: 1 }, give: { id: 'art_qingning', n: 1 }, reply: '她毫不犹豫地交出了法宝，捧着养魂木走了。' },
        ] },
      { id: 'y2', title: '鬼道', req: { favor: 55, flag: 'y_wood' }, hint: '好感 55 以上',
        text: '妍丽的魂魄稳住了，元瑶却变了。她开始修习鬼道功法，周身阴气森森。\n\n「我只有走这条路，才能替妍丽重塑肉身。」她看着你，有些怯，「你……会不会觉得我成了魔修？」',
        choices: [
          { label: '「你走哪条路，都是元瑶。」', favor: 25, tone: 'love', reply: '她愣住了，眼眶慢慢红起来。\n\n「从来没有人……对我说过这样的话。」' },
          { label: '劝她慎重，鬼道凶险', favor: 10, reply: '「我知道。」她笑笑，「谢谢你担心我。」' },
        ] },
      { id: 'y3', title: '生生世世', req: { favor: 80, flag: 'y_wood' }, hint: '好感 80 以上',
        text: '「妍丽说，她看得出来。」元瑶的脸微微红了，「她说我每次提起你，眼睛里都有光。」\n\n「我说过要生生世世报答你。可是……我现在不想报恩了。」她鼓起勇气，「我想陪着你。不是因为欠你。」',
        choices: [
          { label: '「好。」', favor: 20, end: 'companion', tone: 'love', reply: '她笑起来，阴寒的鬼气里，竟透出几分暖意。\n\n（元瑶愿与你同行）' },
        ] },
    ],
  },
  {
    id: 'yinyue', name: '银月', title: '妖族器灵', portrait: './art/yinyue.webp',
    home: 'biling', realm: 3, stage: 0, faction: 'rogue', pers: 'aloof', age: 3000, color: '200,220,255',
    intro: '寄身于古宝中的妖族器灵，银发碧眸，记忆残缺。她似乎来历非凡，却连自己是谁都记不清了。',
    likes: ['pill_yanghun', 'mat_yaodan7', 'mat_yaodan9', 'item_yuanqi'],
    greet: ['（一缕银光在你身侧凝成少女身形）……你能看见我？', '主人……不，韩立。', '（她托腮看你）今天又想起了一点点从前的事。', '我在。一直都在。'],
    follow: '我本就寄身在你的储物袋里，去哪都一样。',
    bonus: { kind: 'sense', v: 0.15, text: '同行时神识 +15%，可识破隐匿' },
    look: withFace(base({ robe: '#e8ecf6', trim: '#8a9ac0', inner: '#ffffff', shawl: '#c8d4ec', hair: '#dfe4ee', hairStyle: 'halfup', pin: 'jade', ribbon: '#8aa0d0', lip: '#c86a80', eyeTint: '#3a8a8a', skin: '#f8ecea', earring: '#a8d8ff', swordColor: '#e0f0ff' }), 'yinyue'),
    chapters: [
      { id: 'w0', title: '器灵', req: {}, hint: '在乱星海碧灵岛一带',
        text: '你在一处坍塌的古修洞府里，捡到一面布满裂痕的古镜。镜面忽然泛起银光，一个银发少女的虚影浮了出来，茫然地看着四周。\n\n「这是……哪里？我是……谁？」她低头看自己半透明的手，「我只记得，我叫银月。」',
        choices: [
          { label: '「别怕。我带你出去。」', favor: 20, flag: 'w_take', reply: '她歪着头打量你，碧色的眼睛清澈得像山泉。\n\n「你身上……有让人安心的气息。」她化作一缕银光，钻进了古镜。\n\n从此，你的储物袋里多了一个话很少的器灵。' },
          { label: '「你是古宝的器灵？这宝物，我收下了。」', favor: 5, flag: 'w_take', reply: '她皱了皱眉，却也没说什么，化作银光回到镜中。' },
        ] },
      { id: 'w1', title: '残忆', req: { favor: 35, realm: 2 }, hint: '好感 35 以上',
        text: '深夜，银月忽然从镜中现身，捂着头蹲在地上，浑身颤抖。\n\n「我想起来了……一点点……」她声音发颤，「有一片很大的雪原……很多和我一样的族人……然后，是血。很多很多血。」\n\n她抬起头看你，眼中满是恐惧：「我是不是……做过很可怕的事？」',
        choices: [
          { label: '握住她冰凉的手：「过去的事，不必一个人扛。」', favor: 25, tone: 'love', reply: '她的手是虚的，你却好像真的握住了什么。\n\n她慢慢平静下来，靠着你坐了一夜。天亮时她说：「谢谢你。……我想，我不怕想起来了。」' },
          { label: '「也许忘了更好。」', favor: 8, reply: '她沉默了很久，轻轻点头：「……也许吧。」' },
        ] },
      { id: 'w2', title: '重塑', req: { favor: 70, realm: 3, item: 'pill_yanghun' }, hint: '结丹后，备好养魂丹',
        text: '「若能重塑灵体，我就不必再困在镜子里了。」银月看着你手中的养魂丹，「可那要耗费你很多心血……你真的愿意？」',
        choices: [
          { label: '「为你，值得。」', favor: 25, take: { id: 'pill_yanghun', n: 1 }, end: 'companion', tone: 'love', reply: '银光大盛。光芒散去后，一个银发少女赤足站在你面前，第一次有了真实的温度。\n\n她试探着碰了碰你的脸，忽然笑了：「原来……是暖的。」\n\n（银月愿与你同行）' },
        ] },
    ],
  },
];

export const BEAUTY_BY_ID: Record<string, BeautyDef> = Object.fromEntries(BEAUTIES.map((b) => [b.id, b]));
export function beautyLook(id: string): Look { return BEAUTY_BY_ID[id]?.look ?? base({}); }
