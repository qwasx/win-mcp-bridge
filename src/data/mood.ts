export type TimeKey = 'dawn' | 'noon' | 'dusk' | 'night';
export type WeatherKey = 'clear' | 'rain' | 'snow' | 'fog';
export type AssetGroup = '远山' | '天空' | '烟岚' | '点景' | '后处理';
export type AssetStatus = 'live' | 'screen' | 'rework';

export interface MoodAsset {
  id: string;
  cn: string;
  group: AssetGroup;
  size: string;
  status: AssetStatus;
  blend: 'multiply' | 'screen' | 'normal';
  note: string;
  integration: string;
  used: boolean;
}

export interface SceneConfig {
  time: TimeKey;
  weather: WeatherKey;
  showFar: boolean;
  showSky: boolean;
  showMist: boolean;
  showSpots: boolean;
  showPost: boolean;
  showCloudShadow: boolean;
  mountain: number;
  mist: number;
  grain: number;
  parallax: number;
}

export const TIMES: { key: TimeKey; label: string; time: string; en: string }[] = [
  { key: 'dawn', label: '晨', time: '06:20', en: 'MORNING' },
  { key: 'noon', label: '午', time: '12:40', en: 'NOON' },
  { key: 'dusk', label: '暮', time: '18:10', en: 'DUSK' },
  { key: 'night', label: '夜', time: '22:30', en: 'NIGHT' },
];

export const WEATHERS: {
  key: WeatherKey;
  label: string;
  en: string;
  icon: string;
  hash: string;
}[] = [
  { key: 'clear', label: '晴', en: 'CLEAR', icon: '晴', hash: '#2f6470' },
  { key: 'rain', label: '雨', en: 'RAIN', icon: '雨', hash: '#6a7a88' },
  { key: 'snow', label: '雪', en: 'SNOW', icon: '雪', hash: '#b9c4c7' },
  { key: 'fog', label: '雾', en: 'MIST', icon: '雾', hash: '#c2bdab' },
];

export const TONE_MATRIX: Record<
  TimeKey,
  Record<WeatherKey, { color: string; opacity: number; blend: 'multiply' | 'soft-light' }>
> = {
  dawn: {
    clear: { color: '#cfe0d8', opacity: 0.12, blend: 'soft-light' },
    rain: { color: '#a8b8b4', opacity: 0.2, blend: 'multiply' },
    snow: { color: '#dde4e8', opacity: 0.15, blend: 'soft-light' },
    fog: { color: '#e2e0d4', opacity: 0.25, blend: 'soft-light' },
  },
  noon: {
    clear: { color: '#f4efe0', opacity: 0, blend: 'soft-light' },
    rain: { color: '#6a7a88', opacity: 0.18, blend: 'multiply' },
    snow: { color: '#c8d0d4', opacity: 0.12, blend: 'soft-light' },
    fog: { color: '#d8d6cc', opacity: 0.15, blend: 'multiply' },
  },
  dusk: {
    clear: { color: '#c89060', opacity: 0.15, blend: 'multiply' },
    rain: { color: '#4a5a64', opacity: 0.22, blend: 'multiply' },
    snow: { color: '#8a88a0', opacity: 0.15, blend: 'multiply' },
    fog: { color: '#b6a99c', opacity: 0.2, blend: 'multiply' },
  },
  night: {
    clear: { color: '#2a3a4e', opacity: 0.3, blend: 'multiply' },
    rain: { color: '#121a22', opacity: 0.4, blend: 'multiply' },
    snow: { color: '#aebbc4', opacity: 0.25, blend: 'multiply' },
    fog: { color: '#1b2426', opacity: 0.35, blend: 'multiply' },
  },
};

export const SKY_THEME: Record<
  TimeKey,
  { top: string; mid: string; horizon: string; glow: string; cloud: string; water: string; waterDeep: string; ink: string }
> = {
  dawn: {
    top: '#b9cfcb',
    mid: '#dbe5da',
    horizon: '#f3e5c5',
    glow: 'rgba(247, 225, 172, 0.72)',
    cloud: 'rgba(255, 251, 240, 0.62)',
    water: '#cfdcd2',
    waterDeep: '#8fa9a4',
    ink: '#26332f',
  },
  noon: {
    top: '#b9d3d0',
    mid: '#dce7dc',
    horizon: '#f4edd8',
    glow: 'rgba(252, 246, 216, 0.55)',
    cloud: 'rgba(255, 254, 247, 0.72)',
    water: '#ccdcd5',
    waterDeep: '#8aa7a2',
    ink: '#26332f',
  },
  dusk: {
    top: '#84959a',
    mid: '#c4b3a2',
    horizon: '#e7bd93',
    glow: 'rgba(241, 188, 135, 0.7)',
    cloud: 'rgba(248, 216, 183, 0.52)',
    water: '#c6b9a8',
    waterDeep: '#77888a',
    ink: '#2b2b28',
  },
  night: {
    top: '#132330',
    mid: '#223945',
    horizon: '#4c6267',
    glow: 'rgba(215, 226, 215, 0.3)',
    cloud: 'rgba(205, 219, 214, 0.16)',
    water: '#4c6268',
    waterDeep: '#1d2e35',
    ink: '#1a2421',
  },
};

export interface Preset {
  id: string;
  name: string;
  brush: string;
  time: TimeKey;
  weather: WeatherKey;
  quote: string;
  note: string;
  caption: string;
  mini: { sky: [string, string]; wash: string; ink: string; accent: string };
}

export const PRESETS: Preset[] = [
  {
    id: 'dawn-lake',
    name: '晨 · 镜湖',
    brush: '晓雾初开',
    time: 'dawn',
    weather: 'clear',
    quote: '一湖晓色收残雾，半壁青山入镜中。',
    note: '平远 · 深远 · 高远',
    caption: '镜湖 · 辰时 · 静水',
    mini: { sky: ['#d6e3d8', '#f4e7c8'], wash: '#2f6470', ink: '#31433c', accent: '#d9c79b' },
  },
  {
    id: 'dusk-village',
    name: '暮 · 村落炊烟',
    brush: '墟里炊烟',
    time: 'dusk',
    weather: 'clear',
    quote: '暧暧远人村，依依墟里烟。',
    note: '赭霞 · 炊烟 · 归帆',
    caption: '云梦泽 · 酉时 · 晚照',
    mini: { sky: ['#a5a5a2', '#ecc39a'], wash: '#b57d50', ink: '#37342e', accent: '#e8c79b' },
  },
  {
    id: 'night-stars',
    name: '夜 · 星汉渔火',
    brush: '星汉入湖',
    time: 'night',
    weather: 'clear',
    quote: '醉后不知天在水，满船清梦压星河。',
    note: '花青 · 月晕 · 渔火',
    caption: '镜湖 · 亥时 · 月白',
    mini: { sky: ['#152632', '#445d61'], wash: '#2a3a4e', ink: '#dbe2d4', accent: '#f0d9a2' },
  },
  {
    id: 'rain-marsh',
    name: '雨 · 烟雨泽',
    brush: '烟雨空蒙',
    time: 'noon',
    weather: 'rain',
    quote: '山色空蒙雨亦奇，一蓑烟雨任平生。',
    note: '雨幕 · 墨青 · 留白',
    caption: '云梦泽 · 午时 · 细雨',
    mini: { sky: ['#9ba9a6', '#d3d8cc'], wash: '#5f7773', ink: '#2b3835', accent: '#c9cec0' },
  },
];

const A = (a: MoodAsset) => a;

export const ASSETS: MoodAsset[] = [
  A({ id: 'far_mtn_1', cn: '远山 · 最远层', group: '远山', size: '2352 × 448', status: 'live', blend: 'multiply', used: true, integration: 'render.ts · 远景视差 0.05', note: '已裁去底部棋盘区，宣纸底转 alpha，下缘羽化。三层中淡到近乎一口气。' }),
  A({ id: 'far_mtn_2', cn: '远山 · 中层', group: '远山', size: '2048 × 512', status: 'live', blend: 'multiply', used: true, integration: 'render.ts · 远景视差 0.12', note: '峰形与瀑布留白保留，纸底抠净；镜像拼接供横向循环。' }),
  A({ id: 'far_mtn_3', cn: '远山 · 近层', group: '远山', size: '1856 × 576', status: 'live', blend: 'multiply', used: true, integration: 'render.ts · 远景视差 0.22', note: '青绿最完整的一张，保留米点树与小亭剪影。红底验收无白边。' }),
  A({ id: 'sky_dawn_mist', cn: '晨 · 雾带', group: '天空', size: '2480 × 432', status: 'rework', blend: 'normal', used: false, integration: 'render.ts · 天空叠加（未接）', note: '棋盘格被生成器烤进 RGB，红底可见整片灰格；待交付真 alpha。现由程序宣纸雾带替代。' }),
  A({ id: 'sky_dusk_glow', cn: '暮 · 赭霞', group: '天空', size: '2480 × 432', status: 'rework', blend: 'normal', used: false, integration: 'render.ts · 天空叠加（未接）', note: '同上：棋盘格底未分离；目前暮色由五层 CSS 色罩与渐变合成。' }),
  A({ id: 'sky_cloud_band', cn: '昼 · 流云横带', group: '天空', size: '2704 × 384', status: 'rework', blend: 'normal', used: false, integration: 'render.ts · 天空叠加（未接）', note: '云形可用，但灰格底会污染天空。程序流云已替代，等待返工稿。' }),
  A({ id: 'moon_full', cn: '满月 · 玉盘', group: '天空', size: '1024 × 1024', status: 'screen', blend: 'screen', used: true, integration: 'weather.ts · 月相 / 夜空', note: '黑底保留，以 screen 屏滤叠入夜空，月晕由径向渐变补一层。' }),
  A({ id: 'moon_crescent', cn: '蛾眉月', group: '天空', size: '1024 × 1024', status: 'rework', blend: 'screen', used: false, integration: 'weather.ts · 月相（未接）', note: '并非黑底：月牙周围是一圈浅色方块，screen 后形成可见方形。已退回返工，暮色弯月改用 CSS 绘制。' }),
  A({ id: 'sky_starriver', cn: '星汉', group: '天空', size: '2064 × 512', status: 'screen', blend: 'screen', used: true, integration: 'render.ts · 深夜晴天淡入', note: '深底棋盘经 24% 色阶压成纯黑、星屑保留，screen 淡入；只在夜 + 晴出现。' }),
  A({ id: 'rain_veil', cn: '雨幕 · 细雨丝', group: '天空', size: '1024 × 1024', status: 'rework', blend: 'normal', used: false, integration: 'render.ts · 镜头前雨层（未接）', note: '极淡雨丝与棋盘格难以分离，屏幕叠加会泛灰；场景暂用两层程序斜雨。' }),
  A({ id: 'mist_band_1', cn: '烟岚 · 平直', group: '烟岚', size: '2064 × 512', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 山腰雾带（未接）', note: '灰格底 + 白雾，无法抠净。本轮用 SVG 高斯弥散雾带替代，登记返工。' }),
  A({ id: 'mist_band_2', cn: '烟岚 · 起伏', group: '烟岚', size: '2064 × 512', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 湖面雾带（未接）', note: '同上。希望下轮出纯 RGBA、四周渐隐版本。' }),
  A({ id: 'mist_puff_1', cn: '水汽 · 团状', group: '烟岚', size: '1024 × 1024', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 湖雾贴片池（未接）', note: '初稿是白雾压在白格上，alpha 不可恢复；程序雾团已替代 230 个圆团。' }),
  A({ id: 'mist_puff_2', cn: '水汽 · 洇水', group: '烟岚', size: '1024 × 1024', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 湖雾贴片池（未接）', note: '同上；边缘有锯齿灰边，需重出透明稿。' }),
  A({ id: 'wild_geese', cn: '秋雁 · 人字阵', group: '点景', size: '2064 × 512', status: 'live', blend: 'normal', used: true, integration: 'scenery.ts · 雁阵事件 / ambience.ts', note: '墨剪影按亮度抠出，白格清除干净。场景内缓慢横越，可手动唤雁。' }),
  A({ id: 'lone_sail', cn: '孤帆', group: '点景', size: '896 × 1200', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 点景池（未接）', note: '帆体四周残留棋盘格，红底不合格。场景内孤帆为手绘 SVG。' }),
  A({ id: 'fishing_light', cn: '渔火', group: '点景', size: '1024 × 1024', status: 'rework', blend: 'screen', used: false, integration: 'scenery.ts · 夜湖渔火（未接）', note: '光晕内部烤进了棋盘格，压色阶后格纹仍在，screen 会把它放大成整片灰格。撤下，改用手绘灯点 + 倒影。' }),
  A({ id: 'cooking_smoke', cn: '炊烟', group: '点景', size: '592 × 1792', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 黄昏村落（未接）', note: '竖幅构图可用，但棋盘格底严重；本轮炊烟由 SVG 墨丝程序绘制。' }),
  A({ id: 'reed_marsh', cn: '芦苇荻花', group: '点景', size: '1456 × 720', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 黑水泽 / 江滩（未接）', note: '红底检查仍有整片格纹与色边，根部最明显。需重新交付透明底。' }),
  A({ id: 'lotus_withered', cn: '残荷', group: '点景', size: '1200 × 896', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 镜湖入冬（未接）', note: '折梗墨线有神，但底色为棋盘格，仅可作参考图；程序残荷替代。' }),
  A({ id: 'plum_branch', cn: '红梅一枝', group: '点景', size: '1024 × 1024', status: 'rework', blend: 'normal', used: false, integration: 'scenery.ts · 雪天村口（未接）', note: '花枝形态极好，棋盘格未分离；等真 alpha 后接入雪景。' }),
  A({ id: 'paper_grain', cn: '宣纸纤维', group: '后处理', size: '1024 × 1024', status: 'rework', blend: 'multiply', used: false, integration: 'render.ts · overlay 4–6%（未接）', note: '同样是棋盘格示意底，并非纸纤维；直接 multiply 会让整屏浮现方格。本轮以 CSS 纸纹 + 噪点替代。' }),
  A({ id: 'ink_vignette', cn: '淡墨暗角', group: '后处理', size: '1024 × 1024', status: 'rework', blend: 'multiply', used: false, integration: 'render.ts · 全屏后处理（未接）', note: '中心 70% 是灰白棋盘而非透明；在 multiply 下会把方格放大到全屏。已退回返工，场景改用四角径向淡墨。' }),
];

export const ASSET_STATS = {
  total: ASSETS.length,
  live: ASSETS.filter((a) => a.status === 'live').length,
  screen: ASSETS.filter((a) => a.status === 'screen').length,
  rework: ASSETS.filter((a) => a.status === 'rework').length,
  used: ASSETS.filter((a) => a.used).length,
};

export const STATUS_META: Record<AssetStatus, { label: string; short: string; className: string }> = {
  live: { label: '已修复 · 可接入', short: 'ALPHA OK', className: 'status-live' },
  screen: { label: '黑底 · 屏滤接入', short: 'SCREEN', className: 'status-screen' },
  rework: { label: '红底不合格 · 返工', short: 'REWORK', className: 'status-rework' },
};

export interface CheckItem {
  id: string;
  label: string;
  detail: string;
  result: 'pass' | 'fail' | 'pending';
}

export const CHECKS: CheckItem[] = [
  {
    id: 'seam',
    label: '远山长卷横向 offset 50% 自检',
    detail: '三层采用镜像拼接，无露白、无硬接缝，也未用 2×2 复制凑尺寸。',
    result: 'pass',
  },
  {
    id: 'alpha',
    label: '纯红底检查：无白边 / 色边 / 棋盘残留',
    detail: '6 / 23 可用：4 张真 alpha + 2 张黑底屏滤（月 / 星汉）。雾、炊烟、芦苇、梅枝、孤帆、渔火、蛾眉月、纸纹、暗角等 17 张底纹未分离，已登记返工。',
    result: 'fail',
  },
  {
    id: 'text',
    label: '画面内无文字、签名、乱码',
    detail: '23 张源素材逐一目检，均未发现文字或水印；匾额类本批未涉及。',
    result: 'pass',
  },
  {
    id: 'wallpaper',
    label: '四景截图均可当壁纸',
    detail: '晨·镜湖 / 暮·村落炊烟 / 夜·星汉渔火 / 雨·烟雨泽 已在本卷中合成。',
    result: 'pass',
  },
  {
    id: 'sky',
    label: '天空与时辰色罩到位',
    detail: '五层天空合成 + 5×4 色罩表落地；晨暮昼夜颜色已可切换。',
    result: 'pass',
  },
  {
    id: 'perf',
    label: 'gpubench 帧时间回归 < 1ms',
    detail: '本页为网页合成试验场，DOM 层帧率见控制台读数；游戏内 GPU pass 需真机复测。',
    result: 'pending',
  },
];
