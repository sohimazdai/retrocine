import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { avatar } from "../dist/avatars.js";
import { animateRig } from "../dist/animation.js";

test("heart: both hands come up in front of the chest, and the pose is let go afterwards", () => {
  const rig = avatar({ id: "test" });
  const hands = () => {
    rig.root.updateMatrixWorld(true);
    return rig.hands.map((h) => h.getWorldPosition(new T.Vector3()));
  };
  animateRig(rig, { time: 0.2, grounded: true }, 0.016);
  const rest = hands();
  animateRig(rig, { time: 0.8, grounded: true, emote: { type: "heart", started: 0, duration: 2.6 } }, 0.016);
  const up = hands();
  for (let i = 0; i < 2; i++) assert(up[i].y > rest[i].y + 0.1, "hands up");
  assert(up[0].distanceTo(up[1]) < rest[0].distanceTo(rest[1]), "hands together");
  animateRig(rig, { time: 4, grounded: true }, 0.016);
  const after = hands();
  for (let i = 0; i < 2; i++) assert(Math.abs(after[i].y - rest[i].y) < 0.02, "back at rest");
});
test("laugh: eyes squeezed shut and the mouth open; sadness droops the head; both let go afterwards", () => {
  const rig = avatar({ id: "test" });
  animateRig(rig, { time: 0.8, grounded: true, emote: { type: "laugh", started: 0, duration: 2.8 } }, 0.016);
  assert(rig.eyes.every((e) => e.scale.y < 0.5) && rig.mouthOpen.visible);
  animateRig(rig, { time: 0.8, grounded: true, emote: { type: "sad", started: 0, duration: 3 } }, 0.016);
  assert(rig.head.rotation.x > 0.2, "head down");
  animateRig(rig, { time: 5, grounded: true }, 0.016);
  assert(rig.eyes.every((e) => Math.abs(e.scale.y - 1) < 1e-6) && !rig.mouthOpen.visible);
});
test("the fire shader advances over time in all uses of the rig", () => {
  const rig = avatar({ id: "test", hairstyle: "flame" });
  assert(rig.fireHair?.isMesh && rig.fireMaterial, "flame hair is a shader mesh");
  animateRig(rig, { time: 0.2, grounded: true }, 0.016);
  const before = rig.fireMaterial.uniforms.uTime.value;
  animateRig(rig, { time: 0.4, grounded: true }, 0.016);
  assert.notEqual(rig.fireMaterial.uniforms.uTime.value, before);
});
