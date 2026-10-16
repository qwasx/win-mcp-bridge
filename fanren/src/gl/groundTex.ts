// 第二十步：地表画材的异步加载（Node 测试环境没有 Image，自动跳过——着色器退回纯程序地表）
export const GROUND_TEX_SIZE = 768;
/** 各层平均色（预先算好，着色器用来把图块“去色调”后乘回程序配色，保留季节 / 干湿的大块变化） */
export const GROUND_AVG: number[][] = [
  [0.629, 0.723, 0.512], [0.655, 0.720, 0.506], [0.769, 0.680, 0.371], [0.741, 0.685, 0.529],
  [0.353, 0.335, 0.207], [0.695, 0.674, 0.510], [0.774, 0.643, 0.437], [0.541, 0.503, 0.411],
  [0.793, 0.869, 0.926], [0.471, 0.431, 0.370], [0.473, 0.442, 0.375], [0.580, 0.505, 0.382],
];
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
