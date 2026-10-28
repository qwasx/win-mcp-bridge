// 头部贴图（国风工笔淡彩，AI 绘制后抠图）。五个角度：正、3/4 正、侧、3/4 背、背；另一侧镜像。
import hanli_front from '../assets/puppet/hanli/head_front.webp?inline';
import hanli_q from '../assets/puppet/hanli/head_q.webp?inline';
import hanli_side from '../assets/puppet/hanli/head_side.webp?inline';
import hanli_qb from '../assets/puppet/hanli/head_qb.webp?inline';
import hanli_back from '../assets/puppet/hanli/head_back.webp?inline';

export const HEAD_SRC: Record<string, Record<string, string>> = {
  hanli: { front: hanli_front, q: hanli_q, side: hanli_side, qb: hanli_qb, back: hanli_back },
};
