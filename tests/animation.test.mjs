import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { avatar } from "../dist/avatars.js";
import { animateRig } from "../dist/animation.js";

test("clapping hands meet and separate during the applause cycle", () => {
  const rig = avatar({ id: "test" });
  let nearest = Infinity,
    farthest = 0;
  for (let time = 0.3; time < 1; time += 0.01) {
    animateRig(
      rig,
      {
        time,
        grounded: true,
        emote: { type: "applause", started: 0, duration: 3 },
      },
      0.01,
    );
    rig.root.updateMatrixWorld(true);
    const distance = rig.hands[0]
      .getWorldPosition(new T.Vector3())
      .distanceTo(rig.hands[1].getWorldPosition(new T.Vector3()));
    nearest = Math.min(nearest, distance);
    farthest = Math.max(farthest, distance);
  }
  assert(nearest < 0.16);
  assert(farthest > 0.35);
});
test("salute raises the right hand to the head and releases the pose afterwards", () => {
  const rig = avatar({ id: "test" });
  animateRig(
    rig,
    {
      time: 0.8,
      grounded: true,
      emote: { type: "salute", started: 0, duration: 3 },
    },
    0.016,
  );
  rig.root.updateMatrixWorld(true);
  const hand = rig.hands[1].getWorldPosition(new T.Vector3()),
    head = rig.head.getWorldPosition(new T.Vector3());
  assert(hand.y > head.y);
  assert(hand.distanceTo(head) < 0.65);
  animateRig(rig, { time: 4, grounded: true }, 0.016);
  assert.equal(rig.arms[1].scale.y, 1);
  assert.equal(rig.arms[1].position.y, 0.12);
});
test("flame hair changes shape over time in all uses of the rig", () => {
  const rig = avatar({ id: "test", hairstyle: "flame" });
  animateRig(rig, { time: 0.2, grounded: true }, 0.016);
  const before = rig.flames.map((m) => m.scale.y);
  animateRig(rig, { time: 0.4, grounded: true }, 0.016);
  assert(rig.flames.some((m, i) => m.scale.y !== before[i]));
});
