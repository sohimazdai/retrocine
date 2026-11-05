// What can be thrown. Shared by the browser (simulation, visuals) and the server (cooldowns, explosions).
// maxSpeed is the launch speed of a normal throw; holding the right button raises it up to ×CHARGE_MAX.
// Heavier things have a lower top speed, so they fly shorter.
export const CHARGE_MAX = 1.6,
  CHARGE_TIME = 1.1,
  PROJECTILE_GRAVITY = 12;
export const PROJECTILES = [
  // Snowballs, tomatoes and rocks: at most twice a second (the server holds to it too).
  { id: "snow", key: "1", emoji: "❄️", label: "Снежок", mass: 0.2, radius: 0.09, maxSpeed: 19, impact: 3, cooldown: 0.5, color: "#faf5ff" },
  // Leaves no stain: bursts into juice and chunks that fly off and are gone.
  { id: "tomato", key: "2", emoji: "🍅", label: "Помидор", mass: 0.15, radius: 0.1, maxSpeed: 19, impact: 2, cooldown: 0.5, color: "#d8382b" },
  { id: "rock", key: "3", emoji: "🪨", label: "Камень", mass: 1, radius: 0.12, maxSpeed: 13, impact: 6, cooldown: 0.5, color: "#8b8680" },
  { id: "brick", key: "4", emoji: "🧱", label: "Кирпич", mass: 2.5, radius: 0.13, maxSpeed: 9, impact: 9, cooldown: 1, color: "#a8543b" },
  { id: "grenade", key: "5", emoji: "💣", label: "Граната", mass: 0.6, radius: 0.1, maxSpeed: 14, impact: 3, cooldown: 10, bounce: 0.35, fuse: 3, life: 3, explosion: { radius: 4.6, power: 15 }, color: "#4e5b3a" },
  { id: "fireball", key: "6", emoji: "🔥", label: "Фаербол", mass: 0.3, radius: 0.17, maxSpeed: 17, gravity: 0.45, impact: 4, cooldown: 5, explodeOnContact: true, life: 5, explosion: { radius: 3.8, power: 12 }, color: "#ff8a2a" },
  // Shatters where it lands: everyone within the radius is slowed by half and cannot sprint or push.
  { id: "icicle", key: "7", emoji: "🧊", label: "Сосулька", mass: 0.4, radius: 0.1, maxSpeed: 16, impact: 2, cooldown: 6, frostOnContact: true, life: 4, frost: { radius: 2.8, seconds: 3 }, color: "#bfe8ff" },
  // Not thrown but set down at your feet; stepped on by anyone, it blinks and goes off 3 s later.
  { id: "mine", key: "8", emoji: "🧨", label: "Мина", place: true, cooldown: 10, mine: { radius: 3.8, power: 14, fuse: 3000, arm: 1200, trigger: 0.6 }, color: "#3d4a32" },
  // Лук: натянуть тетиву — и стрела летит втрое быстрее снежка, почти по прямой (тяжесть ей почти не
  // мешает), и втыкается, куда попала. Зажатая правая кнопка — тетива туже, ещё быстрее.
  { id: "bow", key: "9", emoji: "🏹", label: "Лук", action: "bow", mass: 0.1, radius: 0.04, maxSpeed: 48, gravity: 0.3, pace: 0.97, impact: 3, cooldown: 0.9, life: 3, sticks: 3, orient: true, color: "#c9a26a" },
  // Пистолет: выстрел без замаха, пуля летит прямо (без тяжести) 150 м/с — через всё поле за полсекунды.
  { id: "pistol", key: "0", emoji: "🔫", label: "Пистолет", action: "pistol", mass: 0.03, radius: 0.025, maxSpeed: 150, gravity: 0, straight: true, impact: 2.5, cooldown: 0.4, life: 0.5, orient: true, color: "#ffd36b" },
];
export const projectile = (id) => PROJECTILES.find((p) => p.id === id) || PROJECTILES[0];

// Launch velocity from `from` toward `to` with at most `speed`. A throw prefers a natural arc
// (horizontal speed ~70% of the top speed — `pace` —, so stronger throws fly flatter and faster); when
// the target is out of reach it becomes the longest possible throw (45°) and lands short. An arrow
// goes at nearly full speed (pace 0.97).
export function launchVelocity(from, to, speed, gravity = PROJECTILE_GRAVITY, pace = 0.7) {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    dy = to.y - from.y,
    d = Math.hypot(dx, dz) || 1e-6,
    ux = dx / d,
    uz = dz / d;
  const preferred = Math.max(0.12, d / (pace * speed));
  let best = null;
  for (let t = 0.06; t <= 5; t += 0.01) {
    const vh = d / t,
      vy = (dy + 0.5 * gravity * t * t) / t;
    if (Math.hypot(vh, vy) > speed) continue;
    if (!best || Math.abs(t - preferred) < Math.abs(best.t - preferred)) best = { t, vh, vy };
  }
  if (best) return { x: ux * best.vh, y: best.vy, z: uz * best.vh, reach: true, time: best.t };
  const s = speed * Math.SQRT1_2;
  return { x: ux * s, y: s, z: uz * s, reach: false, time: (2 * s) / gravity };
}
// A lobbed throw at a fixed launch angle (basketball shots fall into the ring from above). If the
// target is too high for that angle, the angle steepens.
export function arcVelocity(from, to, degrees, gravity) {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    dy = to.y - from.y,
    d = Math.hypot(dx, dz) || 1e-6;
  for (let a = degrees; a < 85; a += 2) {
    const th = (a * Math.PI) / 180,
      drop = d * Math.tan(th) - dy;
    if (drop <= 0.05) continue;
    const v = Math.sqrt((gravity * d * d) / (2 * Math.cos(th) ** 2 * drop)),
      vh = v * Math.cos(th);
    return { x: (dx / d) * vh, y: v * Math.sin(th), z: (dz / d) * vh, speed: v };
  }
  return { x: 0, y: Math.sqrt(2 * gravity * Math.max(0.5, dy)), z: 0, speed: 0 };
}
