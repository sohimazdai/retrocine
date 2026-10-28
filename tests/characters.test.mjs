import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { CHARACTERS } from "../dist/characters.js";
import { avatar, applyLook, disposeAvatar } from "../dist/avatars.js";
import { animateRig } from "../dist/animation.js";
import { EMOTIONS } from "../dist/emotions.js";
import { framePortrait } from "../dist/room.js";

test("all 22 characters keep identity across selecting, saving and returning to a basic avatar", () => {
  let profile = { id: "self", name: "Саша", x: 2, z: 3 };
  assert.equal(CHARACTERS.length, 22);
  for (const preset of CHARACTERS) {
    profile = applyLook(profile, preset.id);
    assert.equal(profile.id, "self");
    assert.equal(profile.name, "Саша");
    const restored = JSON.parse(JSON.stringify(profile));
    const rig = avatar(restored);
    assert.equal(rig.root.userData.character, preset.id);
    assert.equal(rig.profile.id, "self");
    assert(
      rig.root.getObjectByName(`${preset.id}:${Object.keys(rig.features)[0]}`),
    );
    disposeAvatar(rig);
  }
  profile = applyLook(profile, "everyday");
  const rig = avatar(profile);
  assert.equal(profile.character, null);
  assert.equal(rig.features, undefined);
  assert.equal(profile.headwear, "headphones");
  disposeAvatar(rig);
});

test("every character supports locomotion, jumps, throws, kicks and all nine emotions without invalid geometry", () => {
  for (const preset of CHARACTERS) {
    const rig = avatar(applyLook({ id: "self", name: "Игрок" }, preset.id));
    const states = [
      { time: 0.4, speed: 5.1, localX: 0.4, localZ: 0.8, grounded: true },
      { time: 0.5, speed: 4, grounded: false, vy: 8 },
      { time: 0.7, speed: 4, grounded: false, vy: -8 },
      {
        time: 0.2,
        grounded: true,
        action: { type: "throw", started: 0, duration: 0.46 },
      },
      {
        time: 0.2,
        grounded: true,
        action: { type: "kick", started: 0, duration: 0.42 },
      },
      ...EMOTIONS.map(([type]) => ({
        time: 0.6,
        grounded: true,
        emote: { type, started: 0, duration: 3 },
      })),
    ];
    for (const state of states) {
      animateRig(rig, state, 1 / 60);
      rig.root.updateMatrixWorld(true);
      rig.root.traverse((object) =>
        assert(
          object.matrixWorld.elements.every(Number.isFinite),
          `${preset.id}: ${object.name}`,
        ),
      );
      assert.equal(rig.elbows[0].parent, rig.arms[0]);
      assert.equal(rig.knees[1].parent, rig.legs[1]);
    }
    disposeAvatar(rig);
  }
});

test("ears, crowns, capes and tails remain fully framed in the participant square", () => {
  for (const preset of CHARACTERS) {
    const rig = avatar(applyLook({ id: "p", name: "Игрок" }, preset.id));
    const camera = new T.PerspectiveCamera(31, 1, 0.1, 20);
    const bounds = framePortrait(camera, rig),
      center = bounds.getCenter(new T.Vector3()).project(camera);
    assert(Math.abs(center.x) < 1e-6 && Math.abs(center.y) < 1e-6, preset.id);
    assert(bounds.getSize(new T.Vector3()).y < 3, preset.id);
    rig.root.traverseVisible((object) => {
      if (!object.isMesh) return;
      const p = object.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 8) {
        const v = new T.Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld)
          .project(camera);
        assert(
          Math.abs(v.x) < 0.83 && Math.abs(v.y) < 0.83,
          `${preset.id}: cropped ${object.name}`,
        );
      }
    });
    disposeAvatar(rig);
  }
});

test("signature accessories are volumetric, animated and removable independently of the character", () => {
  const labubu = avatar(applyLook({ id: "p", name: "Игрок" }, "labubu"));
  let teeth = 0;
  labubu.root.traverse((o) => {
    if (o.userData.tooth) {
      teeth++;
      assert(o.geometry.attributes.position.count > 3);
    }
  });
  assert.equal(teeth, 9);
  disposeAvatar(labubu);
  const bat = avatar(applyLook({ id: "p", name: "Игрок" }, "batman"));
  const before = bat.features.cape.rotation.x;
  animateRig(bat, { time: 1, speed: 5, grounded: true }, 0.1);
  assert.notEqual(bat.features.cape.rotation.x, before);
  const profile = {
    ...bat.profile,
    headwear: "none",
    outfit: "tshirt",
    footwear: "sneakers",
  };
  const custom = avatar(profile);
  assert.equal(custom.features["bat-cowl"], undefined);
  assert.equal(custom.features.cape, undefined);
  assert.equal(custom.root.userData.character, "batman");
  disposeAvatar(bat);
  disposeAvatar(custom);
  const fire = avatar(applyLook({ id: "p", name: "Игрок" }, "flame-princess"));
  animateRig(fire, { time: 0.2, grounded: true }, 0.1);
  const shape = fire.flames[0].scale.y;
  animateRig(fire, { time: 0.7, grounded: true }, 0.1);
  assert.notEqual(fire.flames[0].scale.y, shape);
  disposeAvatar(fire);
});

test("creating and disposing LEGO models never disposes shared helmet geometry", () => {
  const a = avatar(applyLook({ id: "p", name: "Игрок" }, "ice-king"));
  let disposed = 0;
  const crown = a.features["ice-crown"].children[0].geometry;
  crown.addEventListener("dispose", () => disposed++);
  const lego = avatar(applyLook({ id: "p", name: "Игрок" }, "lego-boy"));
  disposeAvatar(lego);
  assert.equal(disposed, 0);
  disposeAvatar(a);
  assert.equal(disposed, 0);
});
