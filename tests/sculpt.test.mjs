import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { sculptGeometry, scalpGeometry, garmentGeometry, strandGeometry } from "../dist/sculpt.js";
import { avatar, applyLook, disposeAvatar, LOOKS } from "../dist/avatars.js";
import { animateRig } from "../dist/animation.js";

function validSurface(geometry) {
  for (const key of ["position", "normal"])
    assert(geometry.attributes[key].array.every(Number.isFinite), `${key} must be finite`);
  assert(geometry.index.array.every((i) => i < geometry.attributes.position.count));
}

test("sculpted surfaces have finite vertices and outward-facing normals", () => {
  const head = sculptGeometry(), scalp = scalpGeometry();
  const coat = garmentGeometry([[-0.4, 0, 0], [-0.39, 0.35, 0.25], [0.2, 0.2, 0.17], [0.21, 0, 0]], 0.08);
  const lock = strandGeometry([[0, 0, 0], [0, 0.3, 0], [0, 0.6, 0]], 0.05);
  for (const geometry of [head, scalp, coat, lock]) validSurface(geometry);
  const p = new T.Vector3(), n = new T.Vector3();
  for (const geometry of [head, coat, lock]) {
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).setY(0);
      n.fromBufferAttribute(normals, i).setY(0);
      if (p.length() > 0.01 && n.length() > 0.1)
        assert(p.dot(n) > 0, "side surface points outwards");
    }
  }
  coat.dispose(); lock.dispose();
});

test("disposing an avatar preserves shared sculpt surfaces but releases unique hair and fire", () => {
  const a = avatar(applyLook({ id: "a" }, "ciri"));
  const b = avatar(applyLook({ id: "b" }, "flame-princess"));
  let sharedDisposals = 0, uniqueDisposals = 0;
  const onShared = () => sharedDisposals++;
  for (const geometry of [sculptGeometry(), scalpGeometry()]) geometry.addEventListener("dispose", onShared);
  b.fireHair.geometry.addEventListener("dispose", () => uniqueDisposals++);
  b.fireMaterial.addEventListener("dispose", () => uniqueDisposals++);
  const strand = a.features["ashen-hair"].children.find((o) => o.geometry && ![scalpGeometry(), sculptGeometry(0.85)].includes(o.geometry));
  strand.geometry.addEventListener("dispose", () => uniqueDisposals++);
  disposeAvatar(b); disposeAvatar(a);
  assert.equal(sharedDisposals, 0);
  assert.equal(uniqueDisposals, 3);
  for (const geometry of [sculptGeometry(), scalpGeometry()]) geometry.removeEventListener("dispose", onShared);
});

test("animation preserves tailored hand proportions and animates the balloon", () => {
  for (const id of ["ciri", "little-sister"]) {
    const rig = avatar(applyLook({ id: "a" }, id));
    const scales = rig.hands.map((hand) => hand.scale.clone());
    for (const state of [{ time: 1, speed: 5, grounded: true }, { time: 2, emote: { type: "laugh", started: 1, duration: 3 } }, { time: 5 }]) {
      animateRig(rig, state, 0.1);
      rig.hands.forEach((hand, i) => assert(hand.scale.equals(scales[i])));
    }
    disposeAvatar(rig);
  }
  const pooh = avatar(applyLook({ id: "p" }, "winnie-pooh"));
  animateRig(pooh, { time: 0.1 }, 0.1);
  const before = pooh.features.balloon.rotation.z;
  animateRig(pooh, { time: 1 }, 0.1);
  assert.notEqual(pooh.features.balloon.rotation.z, before);
  disposeAvatar(pooh);
});

test("the removed firestarter preset is unavailable while flame princess remains selectable", () => {
  assert(!LOOKS.some((look) => look.id === "firestarter"));
  assert(LOOKS.some((look) => look.id === "flame-princess"));
  assert.equal(LOOKS.filter((look) => look.category === "basic").length, 5);
});
