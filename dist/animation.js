import { tickAccessories } from "./avatars.js";

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (v) => {
  v = clamp(v);
  return v * v * (3 - 2 * v);
};
const mix = (a, b, t) => a + (b - a) * t;
export const ACTIONS = {
  throw: { duration: 0.46, release: 0.105 },
  kick: { duration: 0.42, release: 0.12 },
};
export function startAction(player, type, now, payload = null) {
  if (player.action && now - player.action.started < 0.18) return false;
  player.action = {
    type,
    started: now,
    ...ACTIONS[type],
    payload,
    released: false,
  };
  return true;
}

// All poses address a joint hierarchy. Locomotion, vertical motion and actions blend.
export function animateRig(rig, state, dt) {
  const t = state.time || 0;
  const motion = (rig.motion ||= { phase: 0, blend: 0, headLag: 0 });
  const speed = Math.min(1, (state.speed || 0) / 5.1);
  motion.blend = mix(
    motion.blend,
    speed,
    1 - Math.exp(-dt * (speed ? 15 : 10)),
  );
  motion.phase += dt * (7 + speed * 6) * motion.blend;
  const blend = motion.blend,
    phase = motion.phase;
  const stride = Math.sin(phase),
    lift = Math.max(0, Math.sin(phase * 2));
  rig.model.position.set(
    Math.sin(phase) * 0.018 * blend,
    Math.abs(Math.sin(phase)) * 0.032 * blend +
      Math.sin(t * 2.1) * 0.006 * (1 - blend),
    0,
  );
  rig.model.rotation.set(
    (state.localZ || 0) * 0.075 * blend,
    0,
    -(state.localX || 0) * 0.075 * blend,
  );
  rig.model.scale.set(1, 1, 1);
  rig.torso.rotation.set(
    0.02 + blend * 0.06,
    Math.sin(phase) * 0.09 * blend,
    Math.sin(phase) * 0.045 * blend,
  );
  rig.torso.position.y = 0.58;
  rig.head.position.y = 1.15 + Math.cos(phase * 2 - 0.4) * 0.012 * blend;
  motion.headLag = mix(
    motion.headLag,
    -rig.torso.rotation.y * 0.55,
    1 - Math.exp(-dt * 7),
  );
  rig.head.rotation.set(
    (state.lookPitch || 0) + Math.sin(t * 1.7) * 0.012,
    motion.headLag,
    -Math.sin(phase - 0.5) * 0.025 * blend,
  );
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1,
      legPhase = phase + i * Math.PI;
    const swing = Math.sin(legPhase),
      flight = Math.max(0, -swing);
    rig.legs[i].rotation.set(
      swing * 0.6 * blend * (state.localZ ?? 1),
      -(state.localX || 0) * 0.12 * blend,
      s * 0.025 - swing * 0.32 * blend * (state.localX || 0),
    );
    rig.knees[i].rotation.set(0.06 + flight * 0.78 * blend, 0, 0);
    rig.feet[i].rotation.set(
      -flight * 0.35 * blend + Math.max(0, swing) * 0.16 * blend,
      0,
      0,
    );
    rig.arms[i].rotation.set(-swing * 0.52 * blend, 0, s * 0.085);
    rig.arms[i].position.y = 0.12;
    rig.arms[i].scale.set(1, 1, 1);
    rig.elbows[i].rotation.set(-0.13 - flight * 0.25 * blend, 0, 0);
    rig.hands[i].scale.set(0.08, 0.09, 0.08);
  }
  if (state.grounded === false) {
    const rising = (state.vy || 0) > 0,
      tuck = rising ? clamp(state.vy / 13) : clamp(-state.vy / 11);
    rig.model.rotation.x += rising ? -0.09 : 0.13;
    rig.model.scale.set(
      rising ? 0.97 : 1,
      rising ? 1.04 : 1,
      rising ? 0.97 : 1,
    );
    for (let i = 0; i < 2; i++) {
      rig.legs[i].rotation.x = rising ? -0.28 - tuck * 0.4 : -0.16;
      rig.knees[i].rotation.x = rising ? 0.65 + tuck * 0.5 : 0.3;
      rig.arms[i].rotation.x = rising ? -0.5 - tuck * 0.6 : -0.2;
      rig.arms[i].rotation.z = (i ? 1 : -1) * (rising ? 0.2 : 0.42);
      rig.elbows[i].rotation.x = -0.35;
    }
  }
  const landing = state.landing || 0;
  if (landing > 0) {
    const compression = Math.sin(clamp(landing / 0.2) * Math.PI) * 0.13;
    rig.model.position.y -= compression * 0.28;
    rig.model.scale.set(
      1 + compression * 0.35,
      1 - compression,
      1 + compression * 0.35,
    );
    rig.knees.forEach((knee) => (knee.rotation.x += compression * 2.5));
  }
  const action = state.action;
  if (action) {
    const age = t - action.started,
      progress = clamp(age / action.duration),
      end = 1 - ease((progress - 0.65) / 0.35);
    if (action.type === "throw") {
      const wind = ease(progress / 0.24),
        snap = ease((progress - 0.24) / 0.18);
      rig.torso.rotation.y += mix(-0.5 * wind, 0.32, snap) * end;
      rig.torso.rotation.x -= 0.1 * Math.sin(progress * Math.PI);
      rig.arms[1].rotation.x = mix(0.8 * wind, -1.8, snap) * end;
      rig.arms[1].rotation.z = -0.28 * end;
      rig.elbows[1].rotation.x = mix(-1.7 * wind, -0.08, snap) * end;
      rig.arms[0].rotation.x = -0.4 * Math.sin(progress * Math.PI);
      rig.head.rotation.y -= rig.torso.rotation.y * 0.45;
    } else if (action.type === "kick") {
      const wind = ease(progress / 0.28),
        snap = ease((progress - 0.28) / 0.2);
      rig.legs[1].rotation.x = mix(0.65 * wind, -1.25, snap) * end;
      rig.knees[1].rotation.x = mix(0.9 * wind, 0.03, snap) * end;
      rig.feet[1].rotation.x = -0.25 * end;
      rig.model.rotation.z -= 0.13 * Math.sin(progress * Math.PI);
      rig.torso.rotation.x += 0.1 * Math.sin(progress * Math.PI);
      rig.arms[0].rotation.x = -0.6 * end;
      rig.arms[1].rotation.z = 0.6 * end;
    }
  }
  const blinkTime = (t + (state.seed || 0)) % 4.6;
  const blink =
    blinkTime > 4.43 ? Math.max(0.07, Math.abs(blinkTime - 4.515) / 0.085) : 1;
  rig.eyes.forEach((eye) => eye.scale.set(1, blink, 1));
  rig.brows.forEach((brow, i) => (brow.rotation.z = (i ? -1 : 1) * 0.09));
  rig.mouth.rotation.z = 0;
  rig.mouth.scale.set(1, 1, 1);
  rig.mouthOpen.visible = false;
  const emote = state.emote;
  if (emote) {
    const age = t - emote.started,
      strength =
        ease(age / 0.16) * (1 - ease((age - emote.duration + 0.3) / 0.3));
    applyEmote(rig, emote.type, age, strength);
  }
  if (state.hit > 0) rig.model.rotation.z += Math.sin(state.hit * 40) * 0.13;
  tickAccessories(rig, t);
}

function applyEmote(rig, type, t, s) {
  if (type === "heart") {
    rig.arms[0].rotation.set(-0.9 * s, 0.95 * s, 0.4 * s);
    rig.arms[1].rotation.set(-0.9 * s, -0.95 * s, -0.4 * s);
    rig.elbows.forEach((elbow) => (elbow.rotation.x = -1.35 * s));
    rig.head.rotation.z += Math.sin(t * 3) * 0.08 * s;
  }
  if (type === "applause") {
    const clap = (0.5 + Math.sin(t * 19) * 0.5) * s;
    for (let i = 0; i < 2; i++) {
      rig.arms[i].rotation.x = -1.05 * s;
      rig.arms[i].rotation.y = (i ? -1 : 1) * 0.2;
      rig.arms[i].rotation.z = (i ? -1 : 1) * (0.1 + clap * 0.9);
      rig.elbows[i].rotation.x = -0.75 * s;
    }
    rig.torso.rotation.x += Math.sin(t * 19) * 0.025 * s;
  }
  if (type === "salute") {
    rig.arms[1].position.y += 0.15 * s;
    rig.arms[1].scale.y = 1 + 0.85 * s;
    rig.arms[1].rotation.set(-2.5 * s, -0.15 * s, 0.1 * s);
    rig.elbows[1].rotation.x = -0.1 * s;
    rig.model.rotation.z = -0.025 * s;
    rig.head.rotation.x = 0.12 * s;
  }
  if (type === "fire" || type === "firework") {
    for (let i = 0; i < 2; i++) {
      rig.arms[i].rotation.x = -2.3 * s;
      rig.arms[i].rotation.z = (i ? 1 : -1) * 0.5 * s;
      rig.elbows[i].rotation.x = -0.3 * s;
    }
    rig.model.position.y += Math.max(0, Math.sin(t * 9)) * 0.06 * s;
  }
  if (type === "sad" || type === "tears") {
    rig.head.rotation.x = 0.32 * s;
    rig.model.rotation.x += 0.09 * s;
    rig.torso.position.y -= 0.05 * s;
    rig.brows.forEach((brow, i) => (brow.rotation.z = (i ? 1 : -1) * 0.35 * s));
    rig.mouth.scale.set(1, 0.5, 1);
    rig.arms.forEach((arm, i) => (arm.rotation.z = (i ? 1 : -1) * 0.16 * s));
    if (type === "tears") {
      rig.arms[1].rotation.x = -1.5 * s;
      rig.elbows[1].rotation.x = -1.1 * s;
      rig.head.rotation.z += Math.sin(t * 18) * 0.04 * s;
    }
  }
  if (type === "laugh") {
    rig.head.rotation.x = -0.18 * s;
    rig.model.rotation.x -= Math.abs(Math.sin(t * 11)) * 0.1 * s;
    rig.model.position.y += Math.abs(Math.sin(t * 11)) * 0.025 * s;
    rig.eyes.forEach((eye) => (eye.scale.y = 1 - 0.76 * s));
    rig.mouthOpen.visible = true;
    rig.mouth.scale.y = 1 + 0.8 * s;
    for (let i = 0; i < 2; i++) {
      rig.arms[i].rotation.x = -0.65 * s;
      rig.elbows[i].rotation.x = -0.8 * s;
    }
  }
  if (type === "moai") {
    rig.model.rotation.set(0, 0, 0);
    rig.head.rotation.set(-0.04 * s, 0, 0);
    rig.torso.rotation.set(0, 0, 0);
    rig.model.position.y = 0;
    rig.eyes.forEach((eye) => (eye.scale.y = 1 - 0.42 * s));
    rig.arms.forEach((arm) => arm.rotation.set(0, 0, 0));
    rig.elbows.forEach((elbow) => elbow.rotation.set(0, 0, 0));
  }
}
