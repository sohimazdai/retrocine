import * as T from "three";
import { box, ball, material } from "./avatars.js";

export const EMOTIONS = [
  ["heart", "❤️", "Сердце"],
  ["fire", "🔥", "Огонь"],
  ["applause", "👏", "Аплодисменты"],
  ["salute", "🫡", "Отдать честь"],
  ["firework", "🎆", "Фейерверк"],
  ["sad", "😔", "Грусть"],
  ["tears", "😭", "Слёзы"],
  ["laugh", "😂", "Смех"],
  ["moai", "🗿", "Истукан"],
];
const heartShape = new T.Shape();
heartShape.moveTo(0, -0.25);
heartShape.bezierCurveTo(-0.6, 0.05, -0.42, 0.6, 0, 0.3);
heartShape.bezierCurveTo(0.42, 0.6, 0.6, 0.05, 0, -0.25);
const heartGeometry = new T.ExtrudeGeometry(heartShape, {
  depth: 0.12,
  bevelEnabled: true,
  bevelSegments: 2,
  steps: 1,
  bevelSize: 0.035,
  bevelThickness: 0.035,
});
const sparkGeometry = new T.SphereGeometry(0.035, 7, 6),
  coneGeometry = new T.ConeGeometry(0.15, 0.55, 8);
const red = new T.MeshStandardMaterial({
  color: "#f277a3",
  emissive: "#da457a",
  emissiveIntensity: 0.3,
  roughness: 0.4,
});

export class EmotionEffects {
  constructor(scene) {
    this.scene = scene;
    this.effects = [];
  }
  start(player, type, now) {
    const aliases = {
      "💜": "heart",
      "❤️": "heart",
      "🔥": "fire",
      "👏": "applause",
      "🎉": "firework",
      "🎆": "firework",
      "😂": "laugh",
      "👋": "salute",
      "⏰": "firework",
    };
    type = aliases[type] || type;
    if (!EMOTIONS.some((e) => e[0] === type)) type = "heart";
    for (const old of this.effects.filter((e) => e.player === player))
      this.remove(old);
    const duration = type === "firework" ? 3.6 : type === "moai" ? 4 : 3;
    player.emote = { type, started: now, duration };
    const group = new T.Group(),
      pieces = [];
    if (type === "heart") {
      const heart = new T.Mesh(heartGeometry, red);
      heart.scale.setScalar(0.7);
      group.add(heart);
    }
    if (type === "fire")
      for (let i = 0; i < 7; i++) {
        const flame = new T.Mesh(
          coneGeometry,
          material(i % 2 ? "#ffb849" : "#f47c3d"),
        );
        flame.position.set(
          Math.sin(i * 2.4) * 0.2,
          (i % 3) * 0.08,
          Math.cos(i * 2.4) * 0.15,
        );
        group.add(flame);
        pieces.push(flame);
      }
    if (type === "moai") {
      box(group, 0.48, 0.65, 0.37, "#8e929b", 0, 0, 0, 0.07);
      box(group, 0.42, 0.1, 0.05, "#6c717d", 0, 0.13, 0.2, 0.02);
      box(group, 0.105, 0.29, 0.15, "#9da1a8", 0, -0.01, 0.24, 0.02);
      box(group, 0.25, 0.03, 0.025, "#606571", 0, -0.2, 0.2, 0.01);
      for (const x of [-0.14, 0.14])
        box(group, 0.08, 0.028, 0.03, "#454b58", x, 0.07, 0.21, 0.008);
    }
    if (type === "sad") {
      const cloud = new T.Group();
      for (let i = 0; i < 4; i++)
        ball(
          cloud,
          "#8c90ad",
          (i - 1.5) * 0.15,
          Math.sin(i) * 0.05,
          0,
          0.17,
          0.11,
          0.1,
        );
      group.add(cloud);
    }
    if (type === "laugh" || type === "tears") {
      for (let i = 0; i < 6; i++) {
        const tear = ball(group, "#87c8f2", 0, 0, 0, 0.035, 0.065, 0.035, 0.2);
        pieces.push(tear);
      }
    }
    if (type === "applause" || type === "salute") {
      for (let i = 0; i < 6; i++) {
        const spark = new T.Mesh(sparkGeometry, material("#ead9a6"));
        group.add(spark);
        pieces.push(spark);
      }
    }
    if (type === "firework") {
      for (let i = 0; i < 44; i++) {
        const mesh = new T.Mesh(
          sparkGeometry,
          material(["#ef9ebb", "#c1a7ff", "#f5d68b", "#93dec9"][i % 4]),
        );
        group.add(mesh);
        pieces.push(mesh);
      }
    }
    this.scene.add(group);
    this.effects.push({ player, type, group, pieces, started: now, duration });
  }
  remove(effect) {
    this.scene.remove(effect.group);
    this.effects = this.effects.filter((e) => e !== effect);
    if (effect.player.emote?.started === effect.started)
      effect.player.emote = null;
  }
  update(now) {
    for (const e of [...this.effects]) {
      const age = now - e.started;
      if (age > e.duration) {
        this.remove(e);
        continue;
      }
      const scale = Math.min(1, age * 7, (e.duration - age) * 5);
      e.group.position.set(e.player.x, e.player.y + 2.03, e.player.z);
      e.group.scale.setScalar(Math.max(0.001, scale));
      if (e.type === "heart") {
        e.group.position.y += age * 0.22;
        e.group.rotation.y = Math.sin(age * 2) * 0.28;
        e.group.scale.multiplyScalar(1 + Math.sin(age * 8) * 0.06);
      }
      if (e.type === "fire")
        e.pieces.forEach((m, i) => {
          m.scale.y = 0.8 + Math.sin(age * 16 + i) * 0.3;
          m.rotation.z = Math.sin(age * 9 + i) * 0.18;
        });
      if (e.type === "moai") e.group.rotation.y = -0.22;
      if (e.type === "sad") e.group.position.y += Math.sin(age * 2) * 0.05;
      if (e.type === "laugh" || e.type === "tears") {
        e.group.position.y = e.player.y + 1.17;
        e.group.rotation.y = e.player.angle;
        e.pieces.forEach((m, i) => {
          const drop = (age * 1.5 + i / 6) % 1;
          m.position.set(
            (i % 2 ? 1 : -1) * (0.23 + drop * 0.16),
            -0.04 - drop * 0.65,
            0.39,
          );
          m.scale.y = 0.7 + drop * 0.4;
        });
      }
      if (e.type === "applause" || e.type === "salute")
        e.pieces.forEach((m, i) => {
          const angle = (i * Math.PI) / 3;
          m.position.set(
            Math.sin(angle) * (0.35 + Math.sin(age * 13) * 0.1),
            Math.cos(angle) * 0.22,
            0,
          );
        });
      if (e.type === "firework") {
        e.pieces.forEach((m, i) => {
          const cycle = (age + (i > 21 ? 0.65 : 0)) % 1.5,
            progress = Math.max(0, cycle - 0.3),
            angle = i * 2.4;
          const elevation = (((i * 7) % 13) / 13) * Math.PI;
          const spread = progress * 1.8;
          m.visible = cycle > 0.3;
          m.position.set(
            Math.sin(angle) * Math.sin(elevation) * spread,
            Math.cos(elevation) * spread + 0.8 - progress * progress * 1.3,
            Math.cos(angle) * spread * 0.7,
          );
          m.scale.setScalar(Math.max(0.1, 1.6 - progress));
        });
      }
    }
  }
}
