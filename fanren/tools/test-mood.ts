import assert from 'node:assert/strict';
import { TIME_TINTS, moonPhase, timeMoodTint, type WeatherKind } from '../src/world/weather';

let checks=0;
for(const weather of ['clear','rain','snow','fog','storm','sand'] as WeatherKind[]){
  for(let i=0;i<=1000;i++){
    const v=timeMoodTint(i/1000,weather,.75);
    assert.ok(Number.isFinite(v.strength)&&v.strength>=0&&v.strength<=.401);
    v.rgb.forEach(c=>assert.ok(Number.isFinite(c)&&c>=0&&c<=1.001));checks++;
  }
  const start=timeMoodTint(0,weather),end=timeMoodTint(1,weather);
  assert.deepEqual(start,end);
  for(const phase of [.23,.5,.76]){
    const a=timeMoodTint(phase-.000001,weather),b=timeMoodTint(phase+.000001,weather);
    assert.ok(Math.abs(a.strength-b.strength)<.00001);
  }
}
assert.equal(TIME_TINTS.dawn.clear[0],'#cfe0d8');
assert.equal(TIME_TINTS.noon.clear[1],0);
assert.equal(moonPhase(0).visible,false);
assert.equal(moonPhase(14.765).full,true);
assert.ok(moonPhase(7).waxing&&!moonPhase(23).waxing);
console.log(`PASS ${checks} continuous time/weather samples, cyclic boundary, palette anchors and lunar phases.`);