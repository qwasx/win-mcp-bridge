// 头部贴图（国风工笔淡彩，AI 绘制后抠图）。五个角度：正、3/4 正、侧、3/4 背、背；另一侧镜像。
const hanli_front = './game-assets/puppet/hanli/head_front.webp';
const hanli_q = './game-assets/puppet/hanli/head_q.webp';
const hanli_side = './game-assets/puppet/hanli/head_side.webp';
const hanli_qb = './game-assets/puppet/hanli/head_qb.webp';
const hanli_back = './game-assets/puppet/hanli/head_back.webp';

export const HEAD_SRC: Record<string, Record<string, string>> = {
  hanli: { front: hanli_front, q: hanli_q, side: hanli_side, qb: hanli_qb, back: hanli_back },
};
