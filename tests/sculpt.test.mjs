import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { sculptGeometry, scalpGeometry, garmentGeometry, strandGeometry, facialHairGeometry, hoodGeometry, tailGeometry } from "../dist/sculpt.js";
import { avatar, applyLook, disposeAvatar, LOOKS, FACIAL_HAIR, HAIRSTYLES } from "../dist/avatars.js";
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


test("facial hair, hood and animal tails remain continuous surfaces across their variants", () => {
  for (const style of FACIAL_HAIR.map(([id]) => id).filter((id) => id !== "none")) {
    const geometry = facialHairGeometry(style);
    validSurface(geometry);
    assert(geometry.attributes.position.count > 100);
    geometry.dispose();
  }
  const { geometry: hood } = hoodGeometry();
  validSurface(hood);
  hood.dispose();
  const tail = tailGeometry([[0, 0, 0], [0, 0, -0.2], [0, 0.1, -0.5]], [0.1, 0.15, 0.01], "#888888", "#eeeeee");
  validSurface(tail);
  assert(tail.attributes.color.array.every(Number.isFinite));
  tail.dispose();
});

test("beard stays below both eyes and leaves the lips uncovered", () => {
  for (const style of ["short-beard", "full-beard", "beard-only"]) {
    const geometry = facialHairGeometry(style), p = geometry.attributes.position, index = geometry.index;
    let leftSideburn = false, rightSideburn = false, chin = false;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const x = ids.reduce((sum, id) => sum + p.getX(id), 0) / 3;
      const y = ids.reduce((sum, id) => sum + p.getY(id), 0) / 3;
      for (const side of [-1, 1]) {
        const eye = Math.pow((x - side * 0.215) / 0.117, 2) + Math.pow((y - 0.02) / 0.125, 2);
        assert(eye >= 1, `${style}: hair crosses the ${side < 0 ? "left" : "right"} eye`);
      }
      const lips = Math.pow(x / 0.16, 2) + Math.pow((y + 0.255) / 0.065, 2);
      assert(lips >= 1, `${style}: hair covers the lips`);
      leftSideburn ||= x < -0.39 && y > -0.16;
      rightSideburn ||= x > 0.39 && y > -0.16;
      chin ||= Math.abs(x) < 0.14 && y < -0.36;
    }
    assert(leftSideburn && rightSideburn && chin, `${style}: missing continuous cheeks or chin`);
    geometry.dispose();
  }
});

test("beard and hairstyle choices survive profile serialization and use one face-attached patch", () => {
  for (const [style] of FACIAL_HAIR) {
    const p = JSON.parse(JSON.stringify({ id: "player", hairstyle: "parted", facialHair: style, hairColor: "#493339" }));
    const rig = avatar(p);
    assert.equal(rig.profile.facialHair, style);
    if (style === "none") assert(!rig.root.getObjectByName("avatar:facial-hair"));
    else {
      const hair = rig.root.getObjectByName("avatar:facial-hair");
      assert(hair);
      assert.equal(hair.parent, rig.face);
      assert(hair.children.every((child) => child.isMesh));
    }
    disposeAvatar(rig);
  }
  for (const [style] of HAIRSTYLES) {
    const rig = avatar({ id: "player", hairstyle: style, headwear: "none" });
    assert.equal(rig.profile.hairstyle, style);
    disposeAvatar(rig);
  }
});

test("reworked characters keep their attached pieces and secondary motion", () => {
  for (const id of ["wolf", "lion"]) {
    const rig = avatar(applyLook({ id: "player" }, id));
    const tail = rig.features.tail;
    assert.equal(tail.children.filter((child) => child.isMesh).length, 1);
    assert(tail.children[0].geometry.getAttribute("color"));
    animateRig(rig, { time: 0.2, grounded: true }, 0.1);
    const before = tail.rotation.y;
    animateRig(rig, { time: 1.1, grounded: true }, 0.1);
    assert.notEqual(tail.rotation.y, before);
    disposeAvatar(rig);
  }
  const soldier = avatar(applyLook({ id: "player" }, "soldier"));
  assert.equal(soldier.features["rocket-launcher"].parent, soldier.torso);
  disposeAvatar(soldier);
  const six = avatar(applyLook({ id: "player" }, "six"));
  const shell = six.features["raincoat-hood"].children.find((child) => child.isMesh);
  assert(shell.geometry.index.count > 2000);
  disposeAvatar(six);
});
