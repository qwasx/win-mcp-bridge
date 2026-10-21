// 第二十步：地表画材的异步加载（Node 测试环境没有 Image，自动跳过——着色器退回纯程序地表）
export const GROUND_TEX_SIZE = 768;
/** 各层平均色（预先算好，着色器用来把图块“去色调”后乘回程序配色，保留季节 / 干湿的大块变化） */
export const GROUND_AVG: number[][] = [
  // v0.42：雾山水墨样板草地 A/B 的实测平均色。
  [0.771, 0.763, 0.556], [0.643, 0.648, 0.453], [0.769, 0.680, 0.371], [0.741, 0.685, 0.529],
  // 第三十步：4、6~11 换成新的水墨图块；12 魔道赤土、13 阴地灰紫、14 海滩碎贝
  [0.664, 0.642, 0.557], [0.695, 0.674, 0.510], [0.962, 0.891, 0.736], [0.701, 0.673, 0.619],
  [0.934, 0.933, 0.930], [0.786, 0.657, 0.405], [0.598, 0.556, 0.501], [0.675, 0.610, 0.514],
  [0.369, 0.111, 0.085], [0.377, 0.360, 0.404], [0.906, 0.865, 0.793],
];
export const GROUND_LAYERS = GROUND_AVG.length;
let imgs: HTMLImageElement[] | null = null;
let started = false;

export function loadGroundTex() {
  if (started || typeof Image === 'undefined') return;
  started = true;
  import('./groundTexData').then(({ GROUND_SRC }) => {
    const out: HTMLImageElement[] = new Array(GROUND_SRC.length);
    let left = GROUND_SRC.length, bad = false;
    GROUND_SRC.forEach((src, i) => {
      const im = new Image();
      im.onload = () => { out[i] = im; if (--left === 0 && !bad) { imgs = out; } };
      im.onerror = () => { bad = true; console.warn('地表画材加载失败', i); };
      im.src = src;
    });
  }).catch((e) => console.warn('地表画材不可用', e));
}
export function groundImages() { return imgs; }
