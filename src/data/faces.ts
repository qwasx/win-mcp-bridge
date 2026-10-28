// 由 _frame_work/face_build.py 生成：每张 AI 脸的性别、肤色（脖子、手与背面头部跟着用）

export interface FaceInfo { sex: 'm' | 'f'; skin: string; tag: string }
export const FACES: Record<string, FaceInfo> = {
  hanli: { sex: 'm', skin: '#ecd7c0', tag: "二十岁左右的年轻男修士，相貌普通但干净清秀，单眼皮细长眼，眼神沉稳内敛，表情平静，略显朴实" },
  m1: { sex: 'm', skin: '#e6d3c2', tag: "十八岁左右清秀俊朗的少年修士，剑眉星目，鼻梁挺直，神情明朗" },
  m2: { sex: 'm', skin: '#dec7b2', tag: "二十五岁左右英武的青年剑修，浓剑眉，方下巴，目光锐利坚毅" },
  m3: { sex: 'm', skin: '#dfcdbc', tag: "二十二岁左右温文尔雅的书生，细长眉，眼神温和带笑，脸型瘦长" },
  m4: { sex: 'm', skin: '#ebd6c0', tag: "四十岁左右沉稳刚毅的中年男子，额头有浅纹，法令纹明显，目光深沉" },
  m5: { sex: 'm', skin: '#dac1a8', tag: "十六岁左右憨厚老实的少年，圆脸，浓眉大眼，脸颊饱满" },
  m6: { sex: 'm', skin: '#c3a796', tag: "二十八岁左右冷峻阴鸷的青年，狭长凤眼，薄唇，颧骨略高，神情冷漠" },
  m7: { sex: 'm', skin: '#e3ccb8', tag: "六十五岁左右慈祥的老者，满脸皱纹，白色长眉，眼角下垂，面容清癯" },
  m8: { sex: 'm', skin: '#e7d0b9', tag: "三十五岁左右粗犷彪悍的大汉，宽脸，粗眉，鼻翼宽大，皮肤黝黑，面相凶悍" },
  f1: { sex: 'f', skin: '#ead4c4', tag: "十八岁左右美丽温婉的年轻女修士，柳叶眉杏眼，樱桃小口，淡雅妆容" },
  f2: { sex: 'f', skin: '#e7d4c6', tag: "二十岁左右清冷绝美的仙子，丹凤眼，眉目如画，神情淡漠高冷，肌肤如雪，淡雅妆容" },
  f3: { sex: 'f', skin: '#eed0bb', tag: "十五岁左右娇俏可爱的少女，圆脸，大眼睛，小巧的鼻子，笑意盈盈" },
  f4: { sex: 'f', skin: '#ead3c1', tag: "二十四岁左右妩媚动人的女子，眼尾上挑的狐狸眼，红唇，眉眼含情" },
  f5: { sex: 'f', skin: '#e9d5c1', tag: "三十二岁左右端庄秀丽的妇人，鹅蛋脸，眉目温和，气质雍容" },
  f6: { sex: 'f', skin: '#eacfbb', tag: "二十二岁左右英气飒爽的女侠，眉毛略浓微挑，眼神明亮坚定，鼻梁挺直" },
  f7: { sex: 'f', skin: '#efd1bb', tag: "六十岁左右慈祥的老妇人，脸上有皱纹，眼角下垂，面容和蔼" },
  nangongwan: { sex: 'f', skin: '#ecdac8', tag: "二十岁左右清冷端丽的女修，瓜子脸，细长柳叶眉，眼神沉静淡然，淡粉色嘴唇，气质高洁" },
  dongxuaner: { sex: 'f', skin: '#ecd3c1', tag: "十八岁左右娇媚动人的少女，杏眼含笑，眉眼带媚，红唇，脸型圆润" },
  chenqiaoqian: { sex: 'f', skin: '#f1d8c6', tag: "十八岁左右温柔恬静的女弟子，鹅蛋脸，弯弯的眉毛，眼神温婉含笑" },
  mocaihuan: { sex: 'f', skin: '#efd2be', tag: "十二三岁天真活泼的小姑娘，圆脸，大大的眼睛，笑容灿烂，脸颊红润" },
  mupeiling: { sex: 'f', skin: '#e7d0c2', tag: "十九岁左右清秀温柔的女修，眉目秀气，嘴角带着柔和的微笑" },
  ziling: { sex: 'f', skin: '#e7cebd', tag: "二十二岁左右绝美妖娆的女子，凤眼，眉心一点红色花钿，神情神秘高贵，妆容淡雅自然" },
  yuanyao: { sex: 'f', skin: '#edcfb9', tag: "二十岁左右清丽哀婉的女修，眉眼略带忧愁，淡雅素净" },
  yinyue: { sex: 'f', skin: '#e5d1be', tag: "二十岁左右灵动狡黠的狐族少女，琥珀色眼睛，眼尾上挑，笑意盈盈，肤色白皙" },
};
