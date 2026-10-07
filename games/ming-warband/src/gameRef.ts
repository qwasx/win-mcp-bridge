// Phaser 游戏实例引用（避免循环依赖）
import type Phaser from 'phaser';
export const ref: { game: Phaser.Game | null } = { game: null };
