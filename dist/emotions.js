// Эмоции над аватаром: сердце, фейерверк, смех и грусть. Каждая всплывает над головой того, кто её
// нажал, и гаснет. Смайлики рисуются на холсте сами (а не шрифтом эмодзи), поэтому у всех выглядят
// одинаково, на любой системе.
import * as T from "three";

export const EMOTIONS = [
  ["heart", "❤️", "Сердце"],
  ["firework", "🎆", "Фейерверк"],
  ["laugh", "😂", "Смех"],
  ["sad", "😢", "Грусть"],
];
// Старые клиенты ещё присылают убранные эмоции: ближайшая из оставшихся или ничего.
const ALIASES = {
  "💜": "heart",
  "❤️": "heart",
  applause: "heart",
  "👏": "heart",
  "🎉": "firework",
  "🎆": "firework",
  "⏰": "firework",
  fire: "firework",
  "🔥": "firework",
  "😂": "laugh",
  tears: "sad",
  "😭": "sad",
  "😔": "sad",
  "😢": "sad",
};
export function emotionId(type) {
  const t = ALIASES[type] || type;
  return EMOTIONS.some((e) => e[0] === t) ? t : null;
}
export const EMOTION_TIME = { heart: 2.6, firework: 3.6, laugh: 2.8, sad: 3 };

const heartShape = new T.Shape();
heartShape.moveTo(0, -0.25);
heartShape.bezierCurveTo(-0.6, 0.05, -0.42, 0.6, 0, 0.3);
heartShape.bezierCurveTo(0.42, 0.6, 0.6, 0.05, 0, -0.25);
const heartGeometry = new T.ExtrudeGeometry(heartShape, { depth: 0.14, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 });
heartGeometry.center();
const sparkGeometry = new T.SphereGeometry(0.1, 8, 6),
  trailGeometry = new T.SphereGeometry(0.05, 6, 5);
// Sizes over the avatar: a heart and a smiley are bigger than its head, visible from the default camera.
const HEART = 2.3,
  FACE = 2.1,
  SPARKS = 72;
const FIREWORK_COLORS = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#ff9f1c"];

// A big smiley drawn on a canvas: "laugh" — tears of joy, "sad" — a frown and a tear.
const faces = new Map();
function faceTexture(kind, makeCanvas) {
  if (faces.has(kind)) return faces.get(kind);
  const n = 256,
    canvas = makeCanvas();
  canvas.width = canvas.height = n;
  const c = canvas.getContext("2d"),
    r = n * 0.42,
    cx = n / 2,
    cy = n / 2;
  // Face: a warm yellow with a soft highlight and a dark rim.
  const skin = c.createRadialGradient?.(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  if (skin) {
    skin.addColorStop(0, "#fff3a1");
    skin.addColorStop(0.55, "#ffd23f");
    skin.addColorStop(1, "#f4a51c");
  }
  c.fillStyle = skin || "#ffd23f";
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = n * 0.022;
  c.strokeStyle = "#a8650f";
  c.stroke();
  c.lineCap = "round";
  c.strokeStyle = c.fillStyle = "#5b3410";
  if (kind === "laugh") {
    // Eyes squeezed shut: two arcs.
    c.lineWidth = n * 0.035;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(cx + s * r * 0.38, cy - r * 0.12, r * 0.17, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }
    // A wide open laugh with a tongue.
    c.beginPath();
    c.moveTo(cx - r * 0.62, cy + r * 0.12);
    c.quadraticCurveTo(cx, cy + r * 0.32, cx + r * 0.62, cy + r * 0.12);
    c.quadraticCurveTo(cx + r * 0.5, cy + r * 0.82, cx, cy + r * 0.82);
    c.quadraticCurveTo(cx - r * 0.5, cy + r * 0.82, cx - r * 0.62, cy + r * 0.12);
    c.fillStyle = "#6e2412";
    c.fill();
    c.fillStyle = "#ffffff";
    c.fillRect(cx - r * 0.5, cy + r * 0.15, r, r * 0.13);
    c.fillStyle = "#ef6f6c";
    c.beginPath();
    c.ellipse?.(cx, cy + r * 0.66, r * 0.28, r * 0.14, 0, 0, Math.PI * 2);
    c.fill();
    // Tears of joy streaming out sideways.
    c.fillStyle = "#4cc3ff";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + s * r * 0.6, cy - r * 0.1);
      c.quadraticCurveTo(cx + s * r * 1.05, cy + r * 0.05, cx + s * r * 0.98, cy + r * 0.38);
      c.quadraticCurveTo(cx + s * r * 0.78, cy + r * 0.3, cx + s * r * 0.6, cy - r * 0.1);
      c.fill();
    }
  } else {
    // Brows up in the middle, round eyes, a frown and a tear.
    c.lineWidth = n * 0.03;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + s * r * 0.18, cy - r * 0.42);
      c.lineTo(cx + s * r * 0.55, cy - r * 0.3);
      c.stroke();
      c.beginPath();
      c.ellipse?.(cx + s * r * 0.36, cy - r * 0.08, r * 0.09, r * 0.13, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.lineWidth = n * 0.035;
    c.beginPath();
    c.arc(cx, cy + r * 0.62, r * 0.36, Math.PI * 1.2, Math.PI * 1.8);
    c.stroke();
    c.fillStyle = "#4cc3ff";
    c.beginPath();
    c.moveTo(cx + r * 0.36, cy + r * 0.04);
    c.quadraticCurveTo(cx + r * 0.52, cy + r * 0.3, cx + r * 0.36, cy + r * 0.4);
    c.quadraticCurveTo(cx + r * 0.2, cy + r * 0.3, cx + r * 0.36, cy + r * 0.04);
    c.fill();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  faces.set(kind, texture);
  return texture;
}

// A soft round glow for the firework flashes (one texture for all of them).
let glow = null;
function glowTexture(makeCanvas) {
  if (glow) return glow;
  const canvas = makeCanvas(),
    n = 128;
  canvas.width = canvas.height = n;
  const c = canvas.getContext("2d"),
    g = c.createRadialGradient?.(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (g) {
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
  }
  glow = new T.CanvasTexture(canvas);
  return glow;
}

export class EmotionEffects {
  // makeCanvas: где рисовать смайлики (в браузере — document.createElement("canvas")).
  constructor(scene, makeCanvas = () => document.createElement("canvas")) {
    this.scene = scene;
    this.makeCanvas = makeCanvas;
    this.effects = [];
  }
  start(player, type, now) {
    type = emotionId(type);
    if (!type) return;
    for (const old of this.effects.filter((e) => e.player === player)) this.remove(old);
    const duration = EMOTION_TIME[type];
    player.emote = { type, started: now, duration };
    const group = new T.Group(),
      pieces = [],
      owned = [];
    const own = (m) => (owned.push(m), m);
    let light = null;
    if (type === "heart") {
      // One big, bright red heart and a few small ones rising round it.
      // Without tone mapping: otherwise a bright red goes pink.
      const red = own(new T.MeshStandardMaterial({ color: "#ff1430", emissive: "#d0001c", emissiveIntensity: 0.55, roughness: 0.35, transparent: true, toneMapped: false }));
      const big = new T.Mesh(heartGeometry, red);
      big.scale.setScalar(HEART);
      group.add(big);
      pieces.push(big);
      for (let i = 0; i < 5; i++) {
        const small = new T.Mesh(heartGeometry, red);
        small.scale.setScalar(0.5);
        small.userData = { a: i * 1.26, delay: i * 0.22 };
        group.add(small);
        pieces.push(small);
      }
      light = new T.PointLight("#ff3355", 0, 5, 1.6);
    }
    if (type === "firework") {
      // Three bursts high above, each from a rocket with a sparkling trail; they glow and light up
      // everything round them.
      for (let b = 0; b < 3; b++) {
        const color = FIREWORK_COLORS[(b * 2 + Math.floor(now * 7)) % FIREWORK_COLORS.length],
          second = FIREWORK_COLORS[(b * 2 + 3 + Math.floor(now * 7)) % FIREWORK_COLORS.length];
        const mats = [color, second].map((c) => own(new T.MeshBasicMaterial({ color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })));
        const burst = { at: b * 0.7, x: (b - 1) * 1.4, y: 4.6 + (b % 2) * 0.9, sparks: [], trail: [], mats };
        for (let i = 0; i < SPARKS; i++) {
          const m = new T.Mesh(sparkGeometry, mats[i % 2]);
          const el = Math.acos(1 - (2 * (i + 0.5)) / SPARKS),
            az = i * 2.399;
          m.userData.dir = new T.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
          group.add(m);
          burst.sparks.push(m);
        }
        for (let i = 0; i < 6; i++) {
          const m = new T.Mesh(trailGeometry, mats[0]);
          group.add(m);
          burst.trail.push(m);
        }
        burst.light = new T.PointLight(color, 0, 18, 1.4);
        group.add(burst.light);
        // A flash where it bursts.
        burst.flash = new T.Sprite(own(new T.SpriteMaterial({ map: glowTexture(this.makeCanvas), color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })));
        burst.flash.visible = false;
        group.add(burst.flash);
        pieces.push(burst);
      }
    }
    if (type === "laugh" || type === "sad") {
      const mat = own(new T.SpriteMaterial({ map: faceTexture(type, this.makeCanvas), transparent: true, depthWrite: false }));
      const sprite = new T.Sprite(mat);
      sprite.scale.setScalar(FACE);
      group.add(sprite);
      pieces.push(sprite);
    }
    if (light) group.add(light);
    this.scene.add(group);
    this.effects.push({ player, type, group, pieces, owned, light, started: now, duration });
  }
  remove(effect) {
    this.scene.remove(effect.group);
    for (const m of effect.owned) m.dispose();
    this.effects = this.effects.filter((e) => e !== effect);
    if (effect.player.emote?.started === effect.started) effect.player.emote = null;
  }
  update(now) {
    for (const e of [...this.effects]) {
      const age = now - e.started;
      if (age > e.duration) {
        this.remove(e);
        continue;
      }
      // Pops out, floats up over the head, fades at the end.
      const pop = Math.min(1, age * 6),
        fade = Math.min(1, (e.duration - age) / 0.45),
        bounce = pop < 1 ? pop * (1.25 - 0.25 * pop) : 1 + Math.sin(Math.min(1, age * 2.2) * Math.PI) * 0.06;
      // Above the name label (it is at 2.85 m and is drawn over everything).
      e.group.position.set(e.player.x, e.player.y + 3.9, e.player.z);
      if (e.type === "heart") {
        e.group.position.y += age * 0.35;
        const [big, ...small] = e.pieces;
        const beat = 1 + Math.max(0, Math.sin(age * 9)) * 0.12 + Math.max(0, Math.sin(age * 9 - 0.9)) * 0.06;
        big.scale.setScalar(HEART * bounce * beat);
        big.rotation.y = Math.sin(age * 2) * 0.35;
        small.forEach((m) => {
          const t = Math.max(0, age - m.userData.delay);
          m.visible = t > 0;
          m.position.set(Math.sin(m.userData.a + t * 2) * 0.8, -0.4 + t * 0.7, Math.cos(m.userData.a + t * 2) * 0.4);
          m.scale.setScalar(0.5 * Math.min(1, t * 5));
        });
        e.owned[0].opacity = fade;
        e.light.intensity = 12 * fade * pop;
      }
      if (e.type === "laugh" || e.type === "sad") {
        const sprite = e.pieces[0];
        e.group.position.y += age * 0.22;
        sprite.scale.setScalar(FACE * bounce);
        // Laughing shakes with it; sadness droops slowly.
        sprite.material.rotation = e.type === "laugh" ? Math.sin(age * 22) * 0.12 : Math.sin(age * 1.6) * 0.05;
        if (e.type === "sad") sprite.position.y = -Math.min(0.25, age * 0.08);
        sprite.material.opacity = fade;
      }
      if (e.type === "firework") {
        e.group.position.y = e.player.y;
        for (const b of e.pieces) {
          const t = age - b.at,
            rise = 0.55;
          // The rocket goes up leaving a trail of sparks…
          b.trail.forEach((m, i) => {
            const k = Math.min(1, Math.max(0, t - i * 0.03) / rise);
            m.visible = t > 0 && t < rise;
            m.position.set(b.x * k, 1.6 + (b.y - 1.6) * k, 0);
            m.scale.setScalar(1 - i * 0.12);
          });
          // …and bursts into a glowing sphere of sparks that falls and fades.
          const p = t - rise;
          b.sparks.forEach((m) => {
            m.visible = p > 0 && p < 1.9;
            if (!m.visible) return;
            const spread = 2.6 * (1 - Math.exp(-p * 3.2));
            m.position.set(b.x + m.userData.dir.x * spread, b.y + m.userData.dir.y * spread - p * p * 0.55, m.userData.dir.z * spread);
            m.scale.setScalar(Math.max(0.2, 1.4 - p * 0.6));
          });
          const glow = p > 0 ? Math.max(0, 1 - p / 1.4) : 0;
          b.mats.forEach((m) => (m.opacity = Math.min(1, glow * 1.5 + (t > 0 && t < rise ? 1 : 0))));
          b.light.position.set(b.x, b.y, 0);
          b.flash.visible = p > 0 && p < 0.7;
          b.flash.position.set(b.x, b.y, 0);
          b.flash.scale.setScalar(4.2 * Math.min(1, p * 8));
          b.flash.material.opacity = Math.max(0, 1 - p / 0.7) ** 1.5;
          b.light.intensity = p > 0 ? 70 * Math.exp(-p * 3) : 0;
        }
      }
    }
  }
}
