// director.js — 导演：时间线推进 → 车辆/场景状态 → 多机位手持长焦运镜 → 粒子发射 → HUD/眩光
import * as THREE from 'three';
import { CFG, CAPTIONS, createTimeline } from './timeline.js';
import { handheld, clamp, lerp, smoothstep, rand } from './util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qx = new THREE.Quaternion();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _look = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// 多机位（模拟时间轴，秒）
const SHOTS = [
  { t0: 0.0, t1: 3.3, name: 'CAM-01 · 全景长焦', pos: [58, 6, 52], fov: [22, 19], amp: [.5, .0030] },
  { t0: 3.3, t1: 6.0, name: 'CAM-02 · 爬升特写', pos: [-30, 8, 46], fov: [17, 15.5], amp: [.4, .0040] },
  { t0: 6.0, t1: 7.8, name: 'CAM-03 · 顶点倒挂', pos: [13, 4.5, 30], fov: [10, 9], amp: [.15, .0050] },
  { t0: 7.8, t1: 12.1, name: 'CAM-04 · 降落跟踪', pos: [40, 10, 48], fov: [27, 30], amp: [.55, .0042] },
  { t0: 12.1, t1: 999, name: 'CAM-05 · 接地', pos: [17, 2.6, 21], pos1: [14.5, 2.3, 18.5], fov: [24, 21], amp: [.35, .0034] },
];

export class Director {
  constructor({ scene, camera, world, car, particles, hud, flares }) {
    Object.assign(this, { scene, camera, world, car, particles, hud, flares });
    this.t = 0;
    this.shake = 0;
    this.pulseT = [0, 0, 0, 0];
    this.spr = { y: 0, vy: 0, pitch: 0, vpitch: 0 };
    this.acc = { dust: 0, trickle: 0, shimmer: 0, jet: 0, mist: 0 };
    this.didSparks = false;
    this.shotIdx = -1;
    this.look = new THREE.Vector3(0, 5, 0);
    this.prevPose = null;
    this.vel = new THREE.Vector3();
    this.bellyWorld = new THREE.Vector3();
    this.fanI = 0; this.retroI = 0; this.magI = 0;
    this.badgeT = 0;
    this.reset();
  }

  reset() {
    this.tl = createTimeline();
    this.didSparks = false;
    this.shotIdx = -1;
    this.spr = { y: 0, vy: 0, pitch: 0, vpitch: 0 };
    this.prevPose = null;
    this.badgeT = 2.2;
    this.pulseT = [0, 0, 0, 0];
  }

  onEvent(ev) {
    switch (ev.type) {
      case 'caption': this.hud.caption(CAPTIONS[ev.id]); break;
      case 'pulse': this.firePulse(ev.side); break;
      case 'contact': {
        const v = clamp(ev.v / 5, .4, 1.2);
        this.spr.vy = -ev.v * .55;
        this.spr.vpitch = -ev.v * .12;
        this.shake = Math.max(this.shake, .9 * v);
        // 接地尘雾爆发
        for (let i = 0; i < 90; i++) {
          const a = rand(Math.PI * 2), r = rand(.6, 3.2);
          this.particles.spawn(this.tl.st.xLand + Math.cos(a) * r, .25, Math.sin(a) * r,
            Math.cos(a) * rand(2, 6), rand(.3, 1.4), Math.sin(a) * rand(2, 6),
            { life: rand(1.2, 2.2), s0: 1.6, s1: 4.6, r: .78, gcol: .82, b: .9, a: .17, grav: -.25, drag: .9 });
        }
        for (let i = 0; i < 26; i++) {
          const a = rand(Math.PI * 2);
          this.particles.spawn(this.tl.st.xLand + rand(-1.4, 1.4), .3, rand(-1, 1),
            Math.cos(a) * rand(2, 5), rand(1, 3), Math.sin(a) * rand(2, 5),
            { life: rand(.9, 1.6), s0: .35, s1: 1.6, r: .42, gcol: .38, b: .32, a: .3, grav: -4, drag: .6 });
        }
        this.strobeBurst = 1.4;
        break;
      }
      case 'fadeout': break;
      case 'loop': this.reset(); break;
    }
  }

  firePulse(side) {
    // side: ±1 → 车体局部 ±z 一对 RCS 喷射
    const pose = this.pose;
    const q = this.car.group.quaternion;
    const sideDir = new THREE.Vector3(0, 0, side).applyQuaternion(q);
    const localX = [1.6, -1.6];
    for (const lx of localX) {
      const off = new THREE.Vector3(lx, -.05, side * .95).applyQuaternion(q);
      const p0 = this.car.group.position.clone().add(off);
      for (let i = 0; i < 42; i++) {
        const d = sideDir.clone().multiplyScalar(rand(9, 15))
          .add(new THREE.Vector3(rand(-2, 2), rand(-1.5, 2.5), rand(-2, 2)));
        this.particles.spawn(p0.x, p0.y, p0.z, d.x, d.y, d.z,
          { life: rand(.22, .4), s0: .3, s1: .85, r: .85, gcol: .92, b: 1, a: .6, grav: 0, drag: 1.8 });
      }
    }
    const idx = side > 0 ? 0 : 1;
    this.pulseT[idx] = 1; this.pulseT[idx + 2] = 1;
    this.jetLightPulse = 1;
    this.shake = Math.max(this.shake, .25);
  }

  update(dtWall, camera, freeCam) {
    const st = this.tl.step(dtWall);
    this.t = st.t;
    if (st.events.length) {
      for (const ev of st.events) this.onEvent(ev);
      st.events.length = 0;
    }
    this.badgeT = Math.max(0, this.badgeT - dtWall);

    const pose = this.pose = this.tl.pose();
    const car = this.car;

    // —— 车辆位姿 ——
    car.group.position.set(pose.p[0], pose.p[1], pose.p[2]);
    _x.set(pose.f[0], pose.f[1], pose.f[2]);
    _y.set(pose.u[0], pose.u[1], pose.u[2]);
    _z.crossVectors(_x, _y);
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    if (st.jig) { _qx.setFromAxisAngle(_x, st.jig); _q.multiply(_qx); }
    car.group.quaternion.copy(_q);

    // 车速估计（用于镜头提前量）
    if (this.prevPose && dtWall > 0) {
      const nv = new THREE.Vector3(pose.p[0], pose.p[1], pose.p[2]).sub(this.prevPose).divideScalar(dtWall);
      this.vel.lerp(nv, .35);
    } else this.vel.set((st.mode === 'road' || st.mode === 'fadein') ? -CFG.roadV : 0, 0, 0);
    this.prevPose = new THREE.Vector3(pose.p[0], pose.p[1], pose.p[2]);

    // —— 悬架弹簧 ——
    const grounded = st.mode === 'landed';
    const targetY = grounded ? -0.13 : (st.mode === 'fall' ? .05 : 0);
    const k = grounded ? 260 : 120, c = grounded ? 15 : 9;
    this.spr.vy += (-k * (this.spr.y - targetY) - c * this.spr.vy) * dtWall;
    this.spr.y += this.spr.vy * dtWall;
    this.spr.vpitch += (-190 * this.spr.pitch - 12 * this.spr.vpitch) * dtWall;
    this.spr.pitch += this.spr.vpitch * dtWall;
    car.setSuspension(this.spr.y, this.spr.pitch * .5);

    // —— 车轮 ——
    car.setSpin(st.wheelW, dtWall);

    // —— 喷口视觉 ——
    const tt = this.t;
    const bellyF = st.retroMode === 'belly' ? st.throttle : 0;
    const shoulderF = st.retroMode === 'shoulder' ? st.throttle : 0;
    car.setNozzleGroup(car.plumes.belly, bellyF, tt);
    car.setNozzleGroup(car.plumes.shoulder, shoulderF, tt);
    const pulseMax = Math.max(...this.pulseT);
    car.setNozzleGroup(car.plumes.side, pulseMax, tt);
    for (let i = 0; i < 4; i++) this.pulseT[i] = Math.max(0, this.pulseT[i] - dtWall * 5.5);
    car.jetLight.intensity = 90 * Math.max(bellyF, shoulderF * .8, pulseMax * .6);
    this.jetLightPulse = Math.max(0, (this.jetLightPulse || 0) - dtWall * 6);
    car.headSpot.intensity = (st.mode === 'fadein' || st.mode === 'road' || st.mode === 'ascent') ? 700 : 60;

    // —— 吸附风扇 / 磁环 ——
    this.fanI = (st.maglock ? 1 : 0);
    car.setFan(this.fanI, tt);
    this.magI = st.maglock ? 1 : 0;
    this.world.setMaglock(this.magI, tt);

    // —— 频闪灯 ——
    this.strobeBurst = Math.max(0, (this.strobeBurst || 0) - dtWall);
    for (let i = 0; i < 4; i++) {
      let f = 0;
      if (st.mode === 'landed' || st.mode === 'fall') {
        const ph = (this.t * 1.6 + i * .25) % 1;
        f = (ph < .12 || (ph > .2 && ph < .3)) ? 1 : 0;
        if (this.strobeBurst > 0) f = Math.max(f, (Math.sin(this.t * 40 + i * 2) > 0 ? 1 : .3));
      }
      this.world.setStrobe(i, f * .9, tt);
    }
    this.world.flicker(tt);

    // —— 粒子发射 ——
    this.emitParticles(st, dtWall);

    // —— 相机 ——
    if (!freeCam) this.updateCamera(camera, st, dtWall);

    // —— HUD 数据 ——
    const cap3 = this.car.group.position;
    this.bellyWorld.set(0, -.5, 0).applyQuaternion(_q).add(cap3);
    this.hudState = {
      t: st.t,
      speedKmh: this.tl.speed() * 3.6,
      alt: Math.max(0, pose.p[1] - CFG.rideH),
      gLoad: this.tl.gLoad(),
      attDeg: this.tl.attitudeDeg(),
      fade: st.fade,
      fadeIn: 1 - smoothstep(0, .8, st.t),
      badge: this.badgeT > 0 ? Math.min(1, this.badgeT) * (Math.sin(this.t * 6) > -.3 ? 1 : .3) : 0,
      retOn: st.mode !== 'fadein' && st.mode !== 'road',
      retCol: st.mode === 'hang' || st.mode === 'jiggle' ? '#ffb45e' : st.mode === 'fall' ? '#ff7a5c' : '#5dff9a',
      retSub: st.mode === 'hang' ? 'MAG-LOCK 吸附锁定' : st.mode === 'fall'
        ? (st.retroMode === 'shoulder' ? '反推点火 · 回正中' : '着陆缓冲') : '目标跟踪',
      carPos: cap3,
      fanTxt: st.maglock ? '● 锁定' : (st.mode === 'ascent' && st.s > CFG.S * .8) || st.mode === 'jiggle' ? '吸附中' : (st.mode === 'fall' ? '已释放' : '待机'),
      fanCol: st.maglock ? '#5dff9a' : st.mode === 'jiggle' ? '#ffb45e' : st.mode === 'fall' ? '#ff7a5c' : '#8a94a4',
      retroTxt: st.throttle > 0 ? (st.retroMode === 'belly' ? '腹部喷口 · 点火' : '肩部喷口 · 点火') : '关闭',
      retroCol: st.throttle > 0 ? (Math.sin(this.t * 30) > 0 ? '#bfe4ff' : '#7fb8e8') : '#8a94a4',
      attTxt: st.mode === 'ascent' ? `爬升 ${Math.round(this.tl.attitudeDeg())}°`
        : st.mode === 'hang' || st.mode === 'jiggle' ? '180° 倒挂'
        : st.mode === 'fall' ? `回正 ${Math.round(this.tl.attitudeDeg())}°`
        : st.mode === 'landed' ? '0° 正常 ✓' : '0°',
      attCol: st.mode === 'landed' ? '#5dff9a' : st.mode === 'fall' ? '#ffb45e' : '#ddd',
    };

    // 眩光强度
    this.retroI = Math.max(bellyF, shoulderF * .85);
  }

  emitParticles(st, dt) {
    const P = this.particles, car = this.car, pose = this.pose;
    const acc = this.acc;
    const q = car.group.quaternion;
    const emitN = (rate, dt, fn) => {
      acc[fn.name] = (acc[fn.name] || 0) + rate * dt;
      const n = acc[fn.name] | 0;
      acc[fn.name] -= n;
      for (let i = 0; i < n; i++) fn(i);
    };

    // 进场尘土
    if (st.mode === 'fadein' || st.mode === 'road' || (st.mode === 'ascent' && st.s < 4)) {
      emitN(110, dt, function dust() {
        const side = Math.random() < .5 ? .84 : -.84;
        const p = new THREE.Vector3(-1.5, -.5, side).applyQuaternion(q).add(car.group.position);
        P.spawn(p.x, Math.max(.15, p.y), p.z,
          -CFG.roadV * .22 + rand(-1.5, 1.5), rand(.5, 2.6), rand(-1.6, 1.6),
          { life: rand(.8, 1.4), s0: .4, s1: rand(1.6, 2.6), r: .5, gcol: .46, b: .4, a: .17, grav: -1.2, drag: .9 });
      });
    }
    // 入轨火花
    if (st.mode === 'ascent' && !this.didSparks && st.s > .5) {
      this.didSparks = true;
      for (let i = 0; i < 30; i++) {
        P.spawn(rand(-1.5, 1.5), .3, rand(-1.5, 1.5),
          rand(-8, -2), rand(1, 5), rand(-5, 5),
          { life: rand(.3, .6), s0: .14, s1: .04, r: 1, gcol: .8, b: .45, a: .85, grav: -12, drag: .5 });
      }
    }
    // 倒挂：轮拱落尘（表达倒置）+ 风扇微光粒子
    if (st.maglock) {
      emitN(13, dt, function trickle() {
        const wx = rand(-1.5, 1.5), wz = rand(-.9, .9);
        const p = new THREE.Vector3(wx, -.55, wz).applyQuaternion(q).add(car.group.position);
        P.spawn(p.x, p.y, p.z, rand(-.4, .4), rand(-.4, 0), rand(-.4, .4),
          { life: rand(1.1, 1.9), s0: .1, s1: .3, r: .56, gcol: .56, b: .6, a: .32, grav: -8, drag: .05 });
      });
      emitN(55, dt, function shimmer() {
        const fx = [-1.3, 1.3][Math.random() * 2 | 0], fz = [-.55, .55][Math.random() * 2 | 0];
        const p = new THREE.Vector3(fx + rand(-.1, .1), -.48, fz + rand(-.1, .1)).applyQuaternion(q).add(car.group.position);
        const suck = new THREE.Vector3(0, -1, 0).applyQuaternion(q).multiplyScalar(2.6); // 流向车底与轨道的吸附间隙
        P.spawn(p.x, p.y, p.z, suck.x, suck.y, suck.z,
          { life: rand(.08, .16), s0: .2, s1: .34, r: .7, gcol: .88, b: 1, a: .4, grav: 0, drag: 0 });
      });
    }
    // 反推冷气射流
    if (st.throttle > 0 && (st.retroMode === 'belly' || st.retroMode === 'shoulder')) {
      const rate = 230 * st.throttle;
      emitN(rate, dt, function jet() {
        const isBelly = st.retroMode === 'belly';
        const local = isBelly
          ? new THREE.Vector3([-1.05, 0, 1.05][Math.random() * 3 | 0] + rand(-.06, .06), -.46, rand(-.06, .06))
          : new THREE.Vector3([1.42, -1.42][Math.random() * 2 | 0], .56, ([-.5, .5][Math.random() * 2 | 0]) + rand(-.06, .06));
        const p = local.clone().applyQuaternion(q).add(car.group.position);
        const dir = new THREE.Vector3(0, isBelly ? -1 : 1, 0).applyQuaternion(q);
        dir.x += rand(-.09, .09); dir.z += rand(-.09, .09);
        const sp = rand(15, 24) * (0.7 + .3 * st.throttle);
        dir.multiplyScalar(sp);
        P.spawn(p.x, p.y, p.z, dir.x, dir.y, dir.z,
          { life: rand(.35, .7), s0: .3, s1: rand(.9, 1.4), r: .84, gcol: .91, b: 1, a: .5, grav: 0, drag: .55 });
      });
      // 近地雾化
      if (st.mist) {
        const alt = car.group.position.y - CFG.rideH;
        emitN(200 * (1 - alt / 10) + 30, dt, function mist() {
          const a = rand(Math.PI * 2), r = rand(.5, 2.6);
          P.spawn(car.group.position.x + Math.cos(a) * r, rand(.15, .5), Math.sin(a) * r,
            Math.cos(a) * rand(1.5, 5), rand(.2, .8), Math.sin(a) * rand(1.5, 5),
            { life: rand(1.2, 2), s0: 1.4, s1: rand(3.4, 4.8), r: .74, gcol: .79, b: .88, a: .15, grav: -.2, drag: .85 });
        });
      }
    }
    P.update(dt);
  }

  updateCamera(camera, st, dt) {
    // 选机位
    let idx = 0;
    for (let i = 0; i < SHOTS.length; i++) if (st.t >= SHOTS[i].t0) idx = i;
    const shot = SHOTS[idx];
    if (idx !== this.shotIdx) {
      const first = this.shotIdx === -1;
      this.shotIdx = idx;
      if (!first) { this.hud.cut(shot.name); this.shake = Math.max(this.shake, .18); }
      else this.hud.cut(shot.name);
    }
    const u = clamp((st.t - shot.t0) / (shot.t1 - shot.t0), 0, 1);
    const hh = handheld(this.t * .9, idx * 7.7);
    const base = shot.pos1
      ? [lerp(shot.pos[0], shot.pos1[0], u), lerp(shot.pos[1], shot.pos1[1], u), lerp(shot.pos[2], shot.pos1[2], u)]
      : shot.pos;
    const shake = this.shake * this.shake;
    this.shake *= Math.exp(-3.4 * dt);
    camera.position.set(
      base[0] + hh.x * shot.amp[0] + rand(-1, 1) * shake * .3,
      base[1] + hh.y * shot.amp[0] + rand(-1, 1) * shake * .3,
      base[2] + hh.z * shot.amp[0],
    );
    // 视线：目标 + 速度提前量（长焦跟摇）
    const lead = this.vel.clone().multiplyScalar(.12);
    _look.copy(this.car.group.position).add(lead);
    const k = 1 - Math.exp(-12 * dt);
    this.look.lerp(_look, k);
    camera.lookAt(this.look);
    // 手持角噪声（长焦放大）
    const fscale = 20 / camera.fov;
    camera.rotateX(hh.rx * shot.amp[1] * fscale + rand(-1, 1) * shake * .01);
    camera.rotateY(hh.ry * shot.amp[1] * fscale + rand(-1, 1) * shake * .01);
    camera.rotateZ(hh.rz * shot.amp[1] * fscale * .8);
    // FOV
    const fovT = lerp(shot.fov[0], shot.fov[1], u) + hh.x * .12;
    if (Math.abs(camera.fov - fovT) > .01) {
      camera.fov += (fovT - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }
  }
}
